import { request } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ConfigService, RuntimeService } from "../shared/contracts";
import { serve } from "./http";
let app: Awaited<ReturnType<typeof serve>>;
let cookie: string;
const runtime = {
  snapshot: () => null,
  dispose: async () => {},
  async *events(signal?: AbortSignal) {
    yield { cursor: 1, sessionId: "test", kind: "accepted", requestId: "test" };
    await new Promise<void>((r) =>
      signal?.addEventListener("abort", () => r(), { once: true }),
    );
  },
} as unknown as RuntimeService;
beforeAll(async () => {
  app = await serve(runtime, {} as ConfigService, 14317, true);
  const page = await fetch(app.origin);
  cookie = page.headers.get("set-cookie")!.split(";")[0];
});
afterAll(async () => {
  app.server.closeAllConnections();
  await app.close();
});
describe("loopback RPC and SSE boundary", () => {
  it("requires local session cookie", async () => {
    expect((await fetch(app.origin + "/trpc/state")).status).toBe(401);
  });
  it("accepts localhost with a matching origin", async () => {
    for (const path of ["/", "/trpc/state"]) {
      const status = await new Promise<number>((resolve) => {
        const req = request(
          app.origin + path,
          {
            headers: {
              host: "localhost:14317",
              origin: "http://localhost:14317",
              cookie,
            },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode!);
          },
        );
        req.end();
      });
      expect(status).toBe(200);
    }
  });
  it("rejects foreign origins, hosts and cross-site requests", async () => {
    for (const headers of [
      { cookie, origin: "https://evil.example" },
      { cookie, host: "evil.example:14317" },
      { cookie, host: "localhost:14317", origin: "http://127.0.0.1:14317" },
      { cookie, "sec-fetch-site": "cross-site" },
    ])
      expect(
        await new Promise<number>((resolve) => {
          const req = request(
            app.origin + "/trpc/state",
            { headers },
            (res) => {
              res.resume();
              resolve(res.statusCode!);
            },
          );
          req.end();
        }),
      ).toBe(403);
  });
  it("serves typed RPC to the local page", async () => {
    const r = await fetch(app.origin + "/trpc/state", { headers: { cookie } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ result: { data: null } });
  });
  it("delivers subscription events over SSE and closes on abort", async () => {
    const controller = new AbortController();
    const r = await fetch(app.origin + "/trpc/events", {
      headers: { cookie },
      signal: controller.signal,
    });
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    const reader = r.body!.getReader();
    let text = "";
    while (!text.includes("test")) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += new TextDecoder().decode(chunk.value);
    }
    expect(text).toContain("accepted");
    expect(text).toContain("requestId");
    controller.abort();
  });
});
