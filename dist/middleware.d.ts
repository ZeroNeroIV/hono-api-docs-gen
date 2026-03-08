import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { DocConfig } from "./types";
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
export declare function docs(app: Hono, config?: DocConfig): MiddlewareHandler;
