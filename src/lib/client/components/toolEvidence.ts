import type { ToolCall } from "../../shared/contracts";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function toolEvidence(call: ToolCall) {
  const result = record(call.result);
  const details = record(result.details);
  const diff =
    typeof details.diff === "string"
      ? details.diff
      : typeof result.diff === "string"
        ? result.diff
        : undefined;
  const code = result.exitCode ?? details.exitCode;
  const exitCode =
    typeof code === "number" || typeof code === "string" ? code : undefined;
  const blocks = Array.isArray(result.content) ? result.content : [];
  const output = blocks
    .map(record)
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string);
  // Installed bash appends this exact line to its thrown error. Keep it quoted
  // as result-text evidence, not independently verified process metadata.
  const lastText = output.at(-1);
  const textStatus =
    call.name === "bash" && call.status === "failed"
      ? lastText?.match(/(?:^|\n\n)(Command exited with code -?\d+)\s*$/)?.[1]
      : undefined;
  return { diff, exitCode, textStatus };
}
