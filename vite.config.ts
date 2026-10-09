import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** A short content hash, so a new map or model gets a new URL and no cache can serve the old one. */
const hashOf = (f: string): string => { try { return createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 10); } catch { return 'dev'; } };

/**
 * Runs the server functions in api/*.ts inside the Vite dev server, so `npm run dev`
 * is the whole game, server included. Each function exports GET and/or POST handlers
 * that take a Web Request and return a Web Response, which is also what Vercel and the Cloudflare Worker (worker/index.ts) run.
 */
function apiPlugin(): Plugin {
  return {
    name: 'haora-api',
    configureServer(server: ViteDevServer) {
      // Saves go to .data/*.json in local dev unless D1/Supabase settings are present.
      (globalThis as Record<string, unknown>).__haoraDevStore = async () => {
        const { FileStore } = await server.ssrLoadModule('/api/_lib/file-store.ts');
        return new FileStore('.data');
      };
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const m = url.pathname.match(/^\/api\/([a-z-]+)$/);
        if (!m) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`);
          const method = (req.method || 'GET').toUpperCase();
          const handler = mod[method];
          if (typeof handler !== 'function') { res.statusCode = 405; res.end('Method not allowed'); return; }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const request = new Request(url.href, { method, headers: req.headers as Record<string, string>, body: method === 'GET' || method === 'HEAD' ? undefined : body });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          if ((err as { code?: string }).code === 'ERR_LOAD_URL' || /Failed to load url/.test(String(err))) return next();
          console.error('[api]', err);
          res.statusCode = 500; res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'Server error', detail: String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [apiPlugin()],
  define: { __MAP_V__: JSON.stringify(hashOf('public/agartala-map.json')), __KIT_V__: JSON.stringify(hashOf('public/models/kit.glb')) },
  server: { port: 5191 },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as Parameters<typeof defineConfig>[0]);
