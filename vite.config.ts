import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { disposeProcessServices } from "./src/lib/server/service-owner.ts";
export default defineConfig({
  plugins: [sveltekit(), {
    name: 'pi-workspace-shutdown',
    configureServer(server) {
      // Vite handles SIGTERM; also close gracefully on a non-interactive SIGINT.
      const interrupt = () => { void server.close(); };
      process.once('SIGINT', interrupt);
      server.httpServer?.once('close', () => process.off('SIGINT', interrupt));
    },
    closeServer: disposeProcessServices,
  }],
  server: { host: "127.0.0.1", port: Number(process.env.PORT ?? 4317), strictPort: true },
});
