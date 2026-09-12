export type Thinking = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
export type Scope = 'project' | 'global';
export interface ModelInfo { id: string; provider: string; name: string; }
export interface ToolDefinition { name: string; description: string; parameters: unknown; active: boolean; source: string; path?: string; }
export interface ToolCall { id: string; name: string; args: unknown; result?: unknown; status: 'running'|'completed'|'failed'|'cancelled'; startedAt: number; endedAt?: number; outputNote?: string; }
export interface Message { id: string; role: 'user'|'assistant'|'toolResult'|'system'; text: string; thinking?: string; toolCalls?: ToolCall[]; error?: string; }
export interface Resource { kind: 'skill'|'extension'|'instruction'|'prompt'; name: string; path: string; loaded: boolean; source: string; reason?: string; }
export interface Dialog { id: string; kind: 'select'|'confirm'|'input'|'editor'|'unsupported'; title: string; message?: string; options?: string[]; initialValue?: string; }
export interface Snapshot { sessionId: string; projectPath: string; sessionFile?: string; status: 'idle'|'running'|'stopping'|'error'; messages: Message[]; tools: ToolDefinition[]; resources: Resource[]; model?: ModelInfo; thinking: Thinking; models: ModelInfo[]; dialogs: Dialog[]; error?: string; cursor: number; trust: { trusted: boolean; reason: string }; trial?: { path: string; revision: string; invocation: string; loaded: boolean }; }
export interface RuntimeEvent { cursor: number; sessionId: string; kind: 'snapshot'|'error'|'accepted'|'cancel_requested'; snapshot?: Snapshot; requestId?: string; message?: string; }
export interface SessionInfo { id: string; path: string; name: string; updatedAt: string; }
export interface Accepted { accepted: true; sessionId: string; requestId: string; }
export interface SkillFile { resourceId: string; name: string; description: string; path: string; scope: Scope; content: string; revision: string; }
export type SaveResult = { ok: true; revision: string; path: string; applied: false } | { ok: false; conflict: boolean; message: string; currentRevision?: string };
export interface SettingsView { scope: Scope; path: string; revision: string; model?: ModelInfo; thinking?: Thinking; effectiveModel?: ModelInfo; effectiveThinking: Thinking; source: string; }
export interface RuntimeService {
 open(input: {projectPath: string; sessionPath?: string}): Promise<Snapshot>;
 snapshot(): Snapshot | null;
 sessions(projectPath: string): Promise<SessionInfo[]>;
 send(input: {sessionId: string; requestId: string; text: string}): Promise<Accepted>;
 steer(input: {sessionId: string; requestId: string; text: string}): Promise<Accepted>;
 stop(sessionId: string): Promise<{requested: true}>;
 select(input: {sessionId: string; model?: {provider: string; id: string}; thinking?: Thinking}): Promise<Snapshot>;
 trust(projectPath: string): Promise<Snapshot>;
 answer(input: {dialogId: string; value?: string | boolean; cancelled?: boolean}): Promise<void>;
 trial(input: {projectPath: string; resourceId: string; revision: string; prompt: string}): Promise<Snapshot>;
 events(signal?: AbortSignal): AsyncIterable<RuntimeEvent>;
 dispose(): Promise<void>;
}
export interface ConfigService {
 skills(projectPath: string): Promise<SkillFile[]>;
 readSkill(input: {projectPath: string; resourceId: string}): Promise<SkillFile>;
 saveSkill(input: {projectPath: string; resourceId?: string; name: string; scope: Scope; expectedRevision: string | null; content: string}): Promise<SaveResult>;
 undo(input: {projectPath: string; path: string; expectedRevision: string}): Promise<SaveResult>;
 settings(input: {projectPath: string; scope: Scope}): Promise<SettingsView>;
 saveSettings(input: {projectPath: string; scope: Scope; expectedRevision: string; model?: {provider: string; id: string} | null; thinking?: Thinking | null}): Promise<SaveResult>;
}
