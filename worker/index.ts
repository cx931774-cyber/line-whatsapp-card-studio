/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const probe = url.searchParams.get("probe") || "";
    if (/^[a-f0-9]{16}$/.test(probe) && (url.pathname.startsWith("/c/") || url.pathname.startsWith("/api/images/"))) {
      const context = JSON.stringify({destination:request.headers.get("sec-fetch-dest"),mode:request.headers.get("sec-fetch-mode"),site:request.headers.get("sec-fetch-site"),origin:request.headers.get("origin"),refererHost:(()=>{try{return new URL(request.headers.get("referer") || "").hostname;}catch{return null;}})()});
      ctx.waitUntil(env.DB.prepare("INSERT INTO preview_diagnostics (probe, path, method, user_agent, status, created_at, request_context) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(probe, url.pathname, request.method, (request.headers.get("user-agent") || "").slice(0,300), response.status, Math.floor(Date.now()/1000),context).run().catch(() => {}));
    }
    return response;
  },
};

export default worker;
