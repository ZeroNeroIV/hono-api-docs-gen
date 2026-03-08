import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { parseRoutes } from "./parser";
import { generateDocHtml } from "./generator";
import type { DocConfig } from "./types";
import { createConfig } from "./config";

/**
 * Hono middleware that serves interactive API documentation.
 *
 * By default, docs are served at `/docs`. You can override this
 * with the `docsPath` config option.
 *
 * Also serves a JSON endpoint at `{docsPath}/json` with the parsed
 * route data for programmatic consumption.
 *
 * ```ts
 * app.use("*", docs(app, { title: "My API", version: "2.0.0" }));
 * ```
 */
export function docs(app: Hono, config: DocConfig = {}): MiddlewareHandler {
  const cfg = createConfig(config);
  const basePath = cfg.docsPath.replace(/\/+$/, ""); // strip trailing slash

  return async (c, next) => {
    const reqPath = c.req.path;

    // Serve JSON spec
    if (reqPath === `${basePath}/json`) {
      const routes = parseRoutes(app);
      const filtered = routes.filter(
        (r) =>
          !cfg.exclude.some((e) => {
            const methodMatch = !e.method || e.method.toUpperCase() === r.method;
            const pathMatch = !e.path || e.path === r.path;
            return methodMatch && pathMatch;
          }),
      );

      return c.json({
        title: cfg.title,
        description: cfg.description,
        version: cfg.version,
        servers: cfg.servers,
        tags: cfg.tags,
        routes: filtered.map((r) => ({
          method: r.method,
          path: r.path,
          handler: r.handleName ?? null,
          ...r.metadata,
        })),
      });
    }

    // Serve HTML docs
    if (reqPath === basePath || reqPath === `${basePath}/`) {
      const routes = parseRoutes(app);
      const html = generateDocHtml(routes, config);
      return c.html(html);
    }

    await next();
  };
}
