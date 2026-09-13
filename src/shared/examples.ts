import type { ToolCall, SaveResult } from "./contracts";
// Test/development contract examples, never inserted in runtime state.
export const toolLifecycle: ToolCall[] = [
  {
    id: "call-1",
    name: "bash",
    args: { command: "pwd" },
    status: "running",
    startedAt: 1,
  },
  {
    id: "call-1",
    name: "bash",
    args: { command: "pwd" },
    status: "completed",
    startedAt: 1,
    endedAt: 2,
    result: { content: [{ type: "text", text: "/tmp/example" }] },
  },
];
export const saveConflict: SaveResult = {
  ok: false,
  conflict: true,
  message: "File changed outside the app. Your draft is preserved.",
  currentRevision: "new-sha256",
};
