import type { Hono } from "hono";
import type { ParsedRoute } from "./types";
import { getRouteMetadata } from "./describe";

/**
 * Introspect a Hono app's route registry and enrich each route
 * with any metadata previously registered via `describe()` or `registerRoute()`.
 */
export function parseRoutes(app: Hono): ParsedRoute[] {
  const seen = new Set<string>();
  const routes: ParsedRoute[] = [];

  for (const route of app.routes) {
    const method = route.method.toUpperCase();
    const key = `${method}:${route.path}`;

    // Hono may register duplicate entries (e.g. when multiple middleware are chained)
    if (seen.has(key)) continue;
    seen.add(key);

    routes.push({
      method,
      path: route.path,
      handleName: route.handler?.name || undefined,
      metadata: getRouteMetadata(method, route.path),
    });
  }

  return routes;
}
