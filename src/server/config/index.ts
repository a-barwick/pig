import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { getAgentDir, parseFrontmatter } from '@earendil-works/pi-coding-agent';
import type { ConfigService, ModelInfo, SaveResult, Scope, SettingsView, SkillFile, Thinking } from '../../shared/contracts';

const revision = (bytes: string | null) => createHash('sha256').update(bytes === null ? '\0missing' : bytes).digest('hex');
const levels = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const thinking = (value: unknown): Thinking | undefined => typeof value === 'string' && levels.has(value) ? value as Thinking : undefined;
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const inside = (path: string, root: string) => { const part = relative(root, path); return part === '' || (!part.startsWith(`..${sep}`) && part !== '..' && !isAbsolute(part)); };

/** Canonicalize only the trusted base; reject symlinks in every resource component. */
function safePath(base: string, target: string): string {
  base = resolve(base); target = resolve(target);
  if (!inside(target, base)) throw new Error('Path is outside the allowed resource directory.');
  // Include base ancestors: a swapped .pi/skills or settings symlink must never grant access.
  let cursor = target;
  while (true) {
    try { if (lstatSync(cursor).isSymbolicLink()) throw new Error('Symbolic links are not editable resources.'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (cursor === base) break;
    cursor = dirname(cursor);
  }
  return target;
}
function read(path: string): string | null {
  try { if (!lstatSync(path).isFile()) throw new Error('Resource is not a regular file.'); return readFileSync(path, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
function json(bytes: string | null): Record<string, unknown> {
  if (bytes === null) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.replace(/^\uFEFF/, '')); }
  catch { throw new Error('Settings JSON is invalid. Fix it outside the app before saving.'); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Settings must contain a JSON object.');
  return parsed as Record<string, unknown>;
}
const model = (value: Record<string, unknown>): ModelInfo | undefined => typeof value.defaultProvider === 'string' && typeof value.defaultModel === 'string' ? { provider: value.defaultProvider, id: value.defaultModel, name: value.defaultModel } : undefined;
const thinkingMap = (value: unknown): Record<string, Thinking> => Object.fromEntries(Object.entries(object(value)).filter(([, level]) => thinking(level) !== undefined)) as Record<string, Thinking>;

/** agentDir isolates all global configuration in tests; no live config writes occur at creation. */
export function createConfigService(options: { agentDir?: string } = {}): ConfigService {
  const agentDir = resolve(options.agentDir ?? getAgentDir());
  const undoRecords = new Map<string, { before: string | null; revision: string; base: string }>();
  function project(path: string) {
    if (!isAbsolute(path)) throw new Error('Project path must be absolute.');
    const result = realpathSync(path);
    if (!lstatSync(result).isDirectory()) throw new Error('Project path must be a directory.');
    return result;
  }
  function baseFor(cwd: string, scope: Scope) { return scope === 'global' ? agentDir : project(cwd); }
  function settingsPath(cwd: string, scope: Scope) { const base = baseFor(cwd, scope); return safePath(base, scope === 'global' ? join(base, 'settings.json') : join(base, '.pi/settings.json')); }
  function roots(cwd: string): { base: string; path: string; scope: Scope; file?: boolean }[] {
    const p = project(cwd);
    const result: { base: string; path: string; scope: Scope; file?: boolean }[] = [
      { base: p, path: join(p, '.pi/skills'), scope: 'project' },
      { base: p, path: join(p, '.agents/skills'), scope: 'project' },
      { base: agentDir, path: join(agentDir, 'skills'), scope: 'global' },
    ];
    if (!options.agentDir) result.push({ base: homedir(), path: join(homedir(), '.agents/skills'), scope: 'global' });
    // Only explicit local paths are authorable. Package/glob resolution belongs to pi's runtime inventory.
    for (const scope of ['global', 'project'] as const) {
      const settings = json(read(settingsPath(cwd, scope)));
      for (const item of Array.isArray(settings.skills) ? settings.skills : []) {
        if (typeof item !== 'string' || /[!*?\[\]{}]/.test(item) || item.startsWith('-')) continue;
        const raw = item.replace(/^\+/, '').trim();
        if (!raw) continue;
        const path = resolve(dirname(settingsPath(cwd, scope)), raw.startsWith('~/') ? join(homedir(), raw.slice(2)) : raw);
        // An explicit configuration path grants its directory, but never a symlink target.
        const base = isAbsolute(path) ? sep : dirname(path);
        safePath(base, path);
        result.push({ base, path, scope, file: path.endsWith('.md') });
      }
    }
    return result;
  }
  function paths(cwd: string) {
    const found = new Map<string, { base: string; scope: Scope }>();
    for (const root of roots(cwd)) {
      function walk(path: string, top: boolean) {
        safePath(root.base, path);
        if (!existsSync(path)) return;
        if (lstatSync(path).isFile()) { if (path.endsWith('.md')) found.set(path, root); return; }
        const skill = join(path, 'SKILL.md');
        if (existsSync(skill)) { safePath(root.base, skill); found.set(skill, root); return; }
        for (const entry of readdirSync(path, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
          if (entry.isDirectory()) walk(join(path, entry.name), false);
          else if (top && entry.isFile() && entry.name.endsWith('.md')) found.set(join(path, entry.name), root);
        }
      }
      try { walk(root.path, true); } catch (error) { if ((error as Error).message.includes('Symbolic links')) continue; throw error; }
    }
    return found;
  }
  function skill(cwd: string, resourceId: string): SkillFile {
    const allowed = paths(cwd).get(resourceId);
    if (!allowed) throw new Error('Skill is not an allowed discovered resource.');
    safePath(allowed.base, resourceId);
    const content = read(resourceId);
    if (content === null) throw new Error('Skill no longer exists.');
    const { frontmatter } = parseFrontmatter(content);
    return { resourceId, path: resourceId, scope: allowed.scope, content, revision: revision(content), name: typeof frontmatter.name === 'string' ? frontmatter.name : dirname(resourceId).split(sep).pop()!, description: typeof frontmatter.description === 'string' ? frontmatter.description : '' };
  }
  function write(base: string, path: string, expected: string | null, content: string | null, record = true): SaveResult {
    safePath(base, path);
    const before = read(path);
    if (expected === null ? before !== null : revision(before) !== expected) return { ok: false, conflict: true, message: 'This file changed outside the workbench. Your draft is preserved. Reload the saved file before saving again.', currentRevision: revision(before) };
    mkdirSync(dirname(path), { recursive: true });
    safePath(base, path);
    if (content === null) { if (before !== null) unlinkSync(path); }
    else {
      const temp = join(dirname(path), `.workbench-${randomUUID()}.tmp`);
      try {
        writeFileSync(temp, content, { flag: 'wx', mode: before === null ? 0o600 : lstatSync(path).mode & 0o777 });
        safePath(base, path);
        if (revision(read(path)) !== revision(before)) return { ok: false, conflict: true, message: 'File changed during save. Draft preserved.', currentRevision: revision(read(path)) };
        renameSync(temp, path);
      } finally { if (existsSync(temp)) unlinkSync(temp); }
    }
    const next = revision(content);
    if (record) undoRecords.set(path, { before, revision: next, base });
    return { ok: true, revision: next, path, applied: false };
  }
  const guarded = (fn: () => SaveResult): SaveResult => { try { return fn(); } catch (error) { return { ok: false, conflict: false, message: error instanceof SyntaxError ? 'Settings JSON is invalid. Fix it outside the app before saving.' : (error as Error).message }; } };
  return {
    async skills(cwd) { return [...paths(cwd).keys()].map(path => skill(cwd, path)); },
    async readSkill(input) { return skill(input.projectPath, input.resourceId); },
    async saveSkill(input) { return guarded(() => {
      const { frontmatter, body } = parseFrontmatter(input.content);
      if (typeof frontmatter.name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(frontmatter.name) || frontmatter.name.length > 64) throw new Error('Skill frontmatter needs a lowercase hyphenated name (up to 64 characters).');
      if (typeof frontmatter.description !== 'string' || !frontmatter.description.trim() || frontmatter.description.length > 1024 || !body.trim()) throw new Error('Skill needs a description (up to 1024 characters) and instructions.');
      let path: string; let base: string;
      if (input.resourceId) {
        const allowed = paths(input.projectPath).get(input.resourceId);
        if (!allowed || allowed.scope !== input.scope) throw new Error('Skill is not an allowed resource in this scope.');
        path = input.resourceId; base = allowed.base;
      } else {
        if (input.expectedRevision !== null) throw new Error('New skills require a create-only revision.');
        if (input.name !== frontmatter.name) throw new Error('New skill name must match its frontmatter.');
        base = baseFor(input.projectPath, input.scope);
        path = join(base, input.scope === 'global' ? 'skills' : '.pi/skills', frontmatter.name, 'SKILL.md');
      }
      return write(base, path, input.expectedRevision, input.content);
    }); },
    async undo(input) { return guarded(() => {
      project(input.projectPath);
      const record = undoRecords.get(input.path);
      if (!record) throw new Error('No save to undo in this server session.');
      const settingsAllowed = ['project', 'global'].some(scope => settingsPath(input.projectPath, scope as Scope) === input.path);
      if (!settingsAllowed && !paths(input.projectPath).has(input.path)) throw new Error('Undo target is outside this project’s allowed resources.');
      if (record.revision !== input.expectedRevision) return { ok: false, conflict: true, message: 'Undo revision does not match the last save.' };
      const result = write(record.base, input.path, input.expectedRevision, record.before, false);
      if (result.ok) undoRecords.delete(input.path);
      return result;
    }); },
    async settings(input): Promise<SettingsView> {
      const path = settingsPath(input.projectPath, input.scope);
      const bytes = read(path); const local = json(bytes);
      const global = json(read(settingsPath(input.projectPath, 'global')));
      const effective = input.scope === 'project' ? { ...global, ...local } : local;
      const mergedLevels = { ...thinkingMap(global.modelThinkingLevels), ...thinkingMap(local.modelThinkingLevels) };
      const effectiveModel = model(effective);
      const key = effectiveModel && `${effectiveModel.provider}/${effectiveModel.id}`;
      const effectiveThinking = (key && mergedLevels[key]) || thinking(effective.defaultThinkingLevel) || 'medium';
      const source = key && mergedLevels[key] ? `Per-model override (${Object.hasOwn(thinkingMap(local.modelThinkingLevels), key) ? input.scope : 'global'}): ${key}` : thinking(local.defaultThinkingLevel) ? `${input.scope} default` : thinking(global.defaultThinkingLevel) ? 'global default' : 'pi built-in default';
      // Strict allowlist: never serialize arbitrary settings, auth, provider credentials, or extension config.
      return { scope: input.scope, path, revision: revision(bytes), defaultProvider: typeof local.defaultProvider === 'string' ? local.defaultProvider : undefined, defaultModel: typeof local.defaultModel === 'string' ? local.defaultModel : undefined, model: model(local), thinking: thinking(local.defaultThinkingLevel), effectiveModel, effectiveThinking, source, modelThinkingLevels: thinkingMap(local.modelThinkingLevels), effectiveModelThinkingLevels: mergedLevels };
    },
    async saveSettings(input) { return guarded(() => {
      const path = settingsPath(input.projectPath, input.scope); const settings = json(read(path));
      if (input.model !== undefined) {
        if (input.model === null) { delete settings.defaultProvider; delete settings.defaultModel; }
        else { settings.defaultProvider = input.model.provider; settings.defaultModel = input.model.id; }
      }
      if (input.thinking !== undefined) {
        if (input.thinking === null) delete settings.defaultThinkingLevel;
        else { if (!thinking(input.thinking)) throw new Error('Invalid thinking level.'); settings.defaultThinkingLevel = input.thinking; }
      }
      if (input.modelThinking !== undefined) {
        const { provider, id, level } = input.modelThinking;
        const overrides = { ...object(settings.modelThinkingLevels) }; const key = `${provider}/${id}`;
        if (level === null) delete overrides[key];
        else { if (!thinking(level)) throw new Error('Invalid thinking level.'); overrides[key] = level; }
        if (Object.keys(overrides).length) settings.modelThinkingLevels = overrides;
        else delete settings.modelThinkingLevels;
      }
      return write(baseFor(input.projectPath, input.scope), path, input.expectedRevision, `${JSON.stringify(settings, null, 2)}\n`);
    }); },
  };
}
