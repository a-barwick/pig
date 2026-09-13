// Explicit acceptance server: launch the same built adapter-node process that
// is used for local dogfooding, with temporary configuration and sessions.
import { resolve } from "node:path";
import { startBuiltServer } from "./helpers/server";

const rootArg = process.argv[2];
if (!rootArg) throw new Error("Usage: pnpm exec tsx scripts/test-server.ts <root>");
const app = await startBuiltServer({
  root: resolve(rootArg),
  port: Number(process.env.PORT ?? 4318),
  useExistingAuth: process.env.PI_DASHBOARD_USE_EXISTING_AUTH === "1",
  timeoutMs: 90_000,
});
console.log(app.origin);

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await app.stop();
  process.exit(0);
};
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => void close());

await new Promise<void>((resolve) => app.child.once("exit", () => resolve()));
if (!closing) {
  console.error("Built Kit server exited unexpectedly.");
  process.exit(1);
}
