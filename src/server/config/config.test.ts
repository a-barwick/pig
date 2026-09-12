import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createConfigService } from './index';
import { SettingsManager } from '@earendil-works/pi-coding-agent';
import type { ConfigService } from '../../shared/contracts';

let root: string; let project: string; let agent: string; let service: ConfigService;
const text = (name = 'review', body = 'Review the actual changed files.') => `---\nname: ${name}\ndescription: Review changes\n---\n\n${body}\n`;
beforeEach(() => { root = realpathSync(mkdtempSync(join(tmpdir(), 'pi-config-'))); project = join(root, 'project'); agent = join(root, 'agent'); mkdirSync(join(project, '.pi'), {recursive:true}); mkdirSync(agent); service = createConfigService({agentDir:agent}); });
afterEach(() => rmSync(root, {recursive:true,force:true}));

describe('scoped pi settings', () => {
  it('preserves unrelated data and credentials on disk but exposes only safe fields, and removes overrides for inheritance', async () => {
    const global = { defaultThinkingLevel:'high', defaultProvider:'test', defaultModel:'model', apiKey:'secret-never-return', metadata:{keep:[1,2]}, modelThinkingLevels:{'test/other':'max'} };
    writeFileSync(join(agent,'settings.json'),JSON.stringify(global));
    const original = {theme:'custom',compaction:{enabled:false},extension:{credential:'also-private'}};
    writeFileSync(join(project,'.pi/settings.json'),JSON.stringify(original));
    const initial = await service.settings({projectPath:project,scope:'project'});
    expect(initial.effectiveThinking).toBe('high'); expect(JSON.stringify(initial)).not.toContain('also-private'); expect(JSON.stringify(initial)).not.toContain('secret');
    const result = await service.saveSettings({projectPath:project,scope:'project',expectedRevision:initial.revision,thinking:'medium'});
    expect(result.ok).toBe(true); expect(JSON.parse(readFileSync(join(project,'.pi/settings.json'),'utf8'))).toEqual({...original,defaultThinkingLevel:'medium'});
    const saved = await service.settings({projectPath:project,scope:'project'}); expect(saved.effectiveThinking).toBe('medium');
    await service.saveSettings({projectPath:project,scope:'project',expectedRevision:saved.revision,thinking:null});
    expect((await service.settings({projectPath:project,scope:'project'})).effectiveThinking).toBe('high');
    expect(JSON.parse(readFileSync(join(agent,'settings.json'),'utf8'))).toEqual(global);
    expect(JSON.parse(readFileSync(join(project,'.pi/settings.json'),'utf8'))).toEqual(original);
  });
  it('merges per-model thinking, preserves unknown entries, and uses per-model precedence above default', async () => {
    writeFileSync(join(agent,'settings.json'),JSON.stringify({defaultProvider:'test',defaultModel:'m',defaultThinkingLevel:'high',modelThinkingLevels:{'test/m':'max','test/other':'low'}}));
    writeFileSync(join(project,'.pi/settings.json'),JSON.stringify({modelThinkingLevels:{'future/model':{unknown:true}}}));
    let view = await service.settings({projectPath:project,scope:'project'});
    await service.saveSettings({projectPath:project,scope:'project',expectedRevision:view.revision,thinking:'medium'});
    view = await service.settings({projectPath:project,scope:'project'}); expect(view.effectiveThinking).toBe('max');
    await service.saveSettings({projectPath:project,scope:'project',expectedRevision:view.revision,modelThinking:{provider:'test',id:'m',level:'low'}});
    view = await service.settings({projectPath:project,scope:'project'}); expect(view.effectiveThinking).toBe('low');
    await service.saveSettings({projectPath:project,scope:'project',expectedRevision:view.revision,modelThinking:{provider:'test',id:'m',level:null}});
    expect((await service.settings({projectPath:project,scope:'project'})).effectiveThinking).toBe('max');
    expect(JSON.parse(readFileSync(join(project,'.pi/settings.json'),'utf8')).modelThinkingLevels['future/model']).toEqual({unknown:true});
  });
  it('rejects outside edits and can restore exact prior bytes with undo', async () => {
    const path = join(project,'.pi/settings.json'); const before = '{ "theme": "x", "metadata": [1, 2] }\n'; writeFileSync(path,before);
    const initial = await service.settings({projectPath:project,scope:'project'});
    writeFileSync(path,'{"outside": true}');
    expect(await service.saveSettings({projectPath:project,scope:'project',expectedRevision:initial.revision,thinking:'high'})).toMatchObject({ok:false,conflict:true});
    expect(readFileSync(path,'utf8')).toBe('{"outside": true}'); writeFileSync(path,before);
    const saved = await service.saveSettings({projectPath:project,scope:'project',expectedRevision:initial.revision,thinking:'high'});
    if (!saved.ok) throw new Error(saved.message);
    expect(saved.applied).toBe(false); expect((await service.undo({projectPath:project,path,expectedRevision:saved.revision})).ok).toBe(true); expect(readFileSync(path,'utf8')).toBe(before);
  });
  it('refuses malformed settings without replacing them', async () => {
    const path = join(project,'.pi/settings.json'); writeFileSync(path,'{invalid secret');
    expect(await service.saveSettings({projectPath:project,scope:'project',expectedRevision:'x',thinking:'medium'})).toMatchObject({ok:false,conflict:false}); expect(readFileSync(path,'utf8')).toBe('{invalid secret');
  });
});
describe('skill revisions and resource boundaries', () => {
  it('creates, reads, edits, detects outside edit on save and undo, and restores the previous revision', async () => {
    const created = await service.saveSkill({projectPath:project,name:'review',scope:'project',expectedRevision:null,content:text()}); if (!created.ok) throw new Error(created.message);
    const [file] = await service.skills(project); expect(file.content).toBe(text());
    const saved = await service.saveSkill({projectPath:project,resourceId:file.resourceId,name:file.name,scope:file.scope,expectedRevision:file.revision,content:text('review','Different instructions.')}); if (!saved.ok) throw new Error(saved.message);
    writeFileSync(file.path,text('review','Outside edit'));
    expect(await service.saveSkill({projectPath:project,resourceId:file.resourceId,name:file.name,scope:file.scope,expectedRevision:saved.revision,content:text()})).toMatchObject({ok:false,conflict:true});
    expect(await service.undo({projectPath:project,path:file.path,expectedRevision:saved.revision})).toMatchObject({ok:false,conflict:true});
    writeFileSync(file.path,text('review','Different instructions.'));
    expect((await service.undo({projectPath:project,path:file.path,expectedRevision:saved.revision})).ok).toBe(true); expect((await service.readSkill({projectPath:project,resourceId:file.path})).content).toBe(text());
  });
  it('undoing creation removes only the newly created file and create-only cannot overwrite', async () => {
    const input = {projectPath:project,name:'review',scope:'project' as const,expectedRevision:null,content:text()};
    const first = await service.saveSkill(input); if (!first.ok) throw new Error(first.message);
    expect(await service.saveSkill(input)).toMatchObject({ok:false,conflict:true});
    expect((await service.undo({projectPath:project,path:first.path,expectedRevision:first.revision})).ok).toBe(true); expect(existsSync(first.path)).toBe(false);
  });
  it('rejects arbitrary paths, traversal names, symlink directories and settings symlinks', async () => {
    const outside = join(root,'outside'); mkdirSync(outside); writeFileSync(join(outside,'SKILL.md'),text());
    await expect(service.readSkill({projectPath:project,resourceId:join(outside,'SKILL.md')})).rejects.toThrow('allowed');
    expect(await service.saveSkill({projectPath:project,name:'../../outside',scope:'project',expectedRevision:null,content:text('../../outside')})).toMatchObject({ok:false});
    symlinkSync(outside,join(project,'.pi/skills'));
    expect(await service.skills(project)).toEqual([]);
    expect(await service.saveSkill({projectPath:project,name:'review',scope:'project',expectedRevision:null,content:text()})).toMatchObject({ok:false});
    symlinkSync(join(outside,'SKILL.md'),join(project,'.pi/settings.json'));
    await expect(service.settings({projectPath:project,scope:'project'})).rejects.toThrow('Symbolic');
    expect(readFileSync(join(outside,'SKILL.md'),'utf8')).toBe(text());
  });
  it('supports explicit configured local skill resources without allowing unrelated siblings', async () => {
    const path = join(root,'configured.md'); writeFileSync(path,text()); writeFileSync(join(agent,'settings.json'),JSON.stringify({skills:[path]}));
    expect((await service.skills(project)).map(s=>s.path)).toContain(path);
    const sibling = join(root,'secret.md'); writeFileSync(sibling,'secret'); await expect(service.readSkill({projectPath:project,resourceId:sibling})).rejects.toThrow('allowed');
  });
});

describe('failure recovery', () => {
  it('does not leak malformed JSON contents through reads', async () => {
    writeFileSync(join(agent, 'settings.json'), '{"apiKey":"sensitive-value", broken');
    await expect(service.settings({projectPath:project,scope:'global'})).rejects.toThrow('Settings JSON is invalid');
    try { await service.settings({projectPath:project,scope:'global'}); } catch (error) { expect(String(error)).not.toContain('sensitive-value'); }
  });
  it('rejects a skill replaced with a symlink after discovery', async () => {
    const created = await service.saveSkill({projectPath:project,name:'review',scope:'project',expectedRevision:null,content:text()}); if (!created.ok) throw new Error(created.message);
    const external = join(root, 'external.md'); writeFileSync(external, 'keep untouched');
    rmSync(created.path); symlinkSync(external, created.path);
    expect(await service.saveSkill({projectPath:project,resourceId:created.path,name:'review',scope:'project',expectedRevision:created.revision,content:text('review','overwrite')})).toMatchObject({ok:false});
    expect(await service.undo({projectPath:project,path:created.path,expectedRevision:created.revision})).toMatchObject({ok:false});
    expect(readFileSync(external,'utf8')).toBe('keep untouched');
  });
  it('inherits provider and model independently, and edits global settings without deleting unknown fields', async () => {
    writeFileSync(join(agent,'settings.json'),JSON.stringify({defaultProvider:'test',defaultModel:'original',other:{nested:true}}));
    writeFileSync(join(project,'.pi/settings.json'),JSON.stringify({defaultModel:'project-model'}));
    expect((await service.settings({projectPath:project,scope:'project'})).effectiveModel).toMatchObject({provider:'test',id:'project-model'});
    const before = await service.settings({projectPath:project,scope:'global'});
    const saved = await service.saveSettings({projectPath:project,scope:'global',expectedRevision:before.revision,thinking:'max'}); expect(saved.ok).toBe(true);
    expect(JSON.parse(readFileSync(join(agent,'settings.json'),'utf8'))).toEqual({defaultProvider:'test',defaultModel:'original',other:{nested:true},defaultThinkingLevel:'max'});
    expect(JSON.parse(readFileSync(join(project,'.pi/settings.json'),'utf8'))).toEqual({defaultModel:'project-model'});
  });
  it('undoes a first settings save back to absence without touching global config', async () => {
    const view = await service.settings({projectPath:project,scope:'project'});
    const saved = await service.saveSettings({projectPath:project,scope:'project',expectedRevision:view.revision,thinking:'low'}); if (!saved.ok) throw new Error(saved.message);
    expect((await service.undo({projectPath:project,path:saved.path,expectedRevision:saved.revision})).ok).toBe(true);
    expect(existsSync(saved.path)).toBe(false); expect(existsSync(join(agent,'settings.json'))).toBe(false);
  });
});

// Compare precedence against the installed pi implementation, not a duplicate fixture resolver.
it('matches installed pi 0.85.1 model-thinking resolution for trusted project defaults', async () => {
  writeFileSync(join(agent,'settings.json'),JSON.stringify({defaultProvider:'test',defaultModel:'m',defaultThinkingLevel:'high',modelThinkingLevels:{'test/m':'max'}}));
  writeFileSync(join(project,'.pi/settings.json'),JSON.stringify({defaultThinkingLevel:'medium',modelThinkingLevels:{'test/other':'low'}}));
  const sdk = SettingsManager.create(project, agent, {projectTrusted:true});
  const view = await service.settings({projectPath:project,scope:'project'});
  expect(view.effectiveModel?.provider).toBe(sdk.getDefaultProvider());
  expect(view.effectiveModel?.id).toBe(sdk.getDefaultModel());
  expect(view.effectiveThinking).toBe(sdk.getModelThinkingLevel('test','m') ?? sdk.getDefaultThinkingLevel() ?? 'medium');
  expect(view.effectiveModelThinkingLevels).toEqual(sdk.getAllModelThinkingLevels());
});

it.each([{defaultModel:'project-model'}, {defaultProvider:'project-provider'}])('reports and removes partial scoped model defaults: %j', async (partial) => {
  const global = {defaultProvider:'global-provider',defaultModel:'global-model'};
  writeFileSync(join(agent,'settings.json'),JSON.stringify(global));
  writeFileSync(join(project,'.pi/settings.json'),JSON.stringify({...partial,unrelated:{keep:true}}));
  const view = await service.settings({projectPath:project,scope:'project'});
  expect(view.model).toBeUndefined();
  expect(view.defaultProvider).toBe(partial.defaultProvider);
  expect(view.defaultModel).toBe(partial.defaultModel);
  const saved = await service.saveSettings({projectPath:project,scope:'project',expectedRevision:view.revision,model:null});
  expect(saved.ok).toBe(true);
  const after = await service.settings({projectPath:project,scope:'project'});
  expect(after.defaultProvider).toBeUndefined(); expect(after.defaultModel).toBeUndefined();
  expect(after.effectiveModel).toMatchObject({provider:'global-provider',id:'global-model'});
  expect(JSON.parse(readFileSync(join(project,'.pi/settings.json'),'utf8'))).toEqual({unrelated:{keep:true}});
  expect(JSON.parse(readFileSync(join(agent,'settings.json'),'utf8'))).toEqual(global);
});
