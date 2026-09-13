import { describe, expect, it } from "vitest";
import type { ToolCall } from "../../shared/contracts";
import { toolEvidence } from "./toolEvidence";
const call = (
  result: unknown,
  name = "bash",
  status: ToolCall["status"] = "failed",
): ToolCall => ({ id: "test", name, status, startedAt: 0, args: {}, result });

describe("provided tool evidence", () => {
  it("reads the installed edit details.diff shape and preserves its exact content", () => {
    expect(
      toolEvidence(
        call(
          {
            content: [
              { type: "text", text: "Successfully replaced 1 block(s)." },
            ],
            details: { diff: "-old\n+new", patch: "separate patch" },
          },
          "edit",
          "completed",
        ),
      ).diff,
    ).toBe("-old\n+new");
  });
  it("quotes the installed bash failure suffix without converting it to structured metadata", () => {
    const evidence = toolEvidence(
      call({
        content: [
          { type: "text", text: "stderr\n\nCommand exited with code 2" },
        ],
        details: {},
      }),
    );
    expect(evidence.textStatus).toBe("Command exited with code 2");
    expect(evidence.exitCode).toBeUndefined();
  });
  it("does not invent success, timeout, cancellation, or resumed outcomes", () => {
    for (const text of [
      "(no output)",
      "Command timed out after 5 seconds",
      "Command aborted",
    ]) {
      expect(
        toolEvidence(call({ content: [{ type: "text", text }] })).exitCode,
      ).toBeUndefined();
      expect(
        toolEvidence(call({ content: [{ type: "text", text }] })).textStatus,
      ).toBeUndefined();
    }
    for (const status of ["completed", "running", "unknown"] as const) {
      expect(
        toolEvidence(
          call(
            { content: [{ type: "text", text: "Command exited with code 2" }] },
            "bash",
            status,
          ),
        ).textStatus,
      ).toBeUndefined();
    }
  });
  it("retains explicit structured fields and handles missing results", () => {
    expect(
      toolEvidence(call({ exitCode: 0, diff: "provided diff" })),
    ).toMatchObject({ exitCode: 0, diff: "provided diff" });
    expect(toolEvidence(call(undefined))).toEqual({
      diff: undefined,
      exitCode: undefined,
      textStatus: undefined,
    });
  });
});
