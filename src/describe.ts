import type { MiddlewareHandler } from "hono";
import type { RouteMetadata } from "./types";

// ─── Global Route Metadata Registry ─────────────────────────────────────────

export interface RegistryKey {
  method: string;
  path: string;
}

const routeRegistry = new Map<string, RouteMetadata>();

function registryKey(method: string, path: string): string {
  return `${method.toUpperCase()}:${path}`;
}

/**
 * Get all registered route metadata.
 */
export function getRegistry(): Map<string, RouteMetadata> {
  return routeRegistry;
}

/**
 * Look up metadata for a specific method + path.
 */
export function getRouteMetadata(
  method: string,
  path: string,
): RouteMetadata | undefined {
  return routeRegistry.get(registryKey(method, path));
}

/**
 * Clear all registered metadata (useful for testing).
 */
export function clearRegistry(): void {
  routeRegistry.clear();
}

// ─── describe() — Decorator-style metadata attachment ───────────────────────

/**
 * Attach Swagger-like metadata to a route.
 *
 * Usage (decorator style — place before the handler in the middleware chain):
 *
 * ```ts
 * app.get(
 *   "/users",
 *   describe("GET", "/users", {
 *     summary: "List all users",
 *     tags: ["Users"],
 *     parameters: [
 *       { name: "page", in: "query", type: "integer", description: "Page number" },
 *     ],
 *     responses: {
 *       200: { description: "Successful response", schema: { type: "array", items: { type: "object" } } },
 *       401: { description: "Unauthorized" },
 *     },
 *   }),
 *   (c) => c.json([])
 * );
 * ```
 */
export function describe(
  method: string,
  path: string,
  metadata: RouteMetadata,
): MiddlewareHandler {
  routeRegistry.set(registryKey(method, path), metadata);

  // Pass-through middleware — does nothing at request time, purely declarative
  return async (_c, next) => {
    await next();
  };
}

// ─── describeRoute() — Shorter alternative without method/path ──────────────

/**
 * Create a metadata descriptor that auto-registers when the parser runs.
 * You register it manually:
 *
 * ```ts
 * import { registerRoute } from "@zeronerov/hono-api-docs-gen";
 *
 * registerRoute("GET", "/users", {
 *   summary: "List all users",
 *   tags: ["Users"],
 *   responses: { 200: { description: "OK" } },
 * });
 * ```
 */
export function registerRoute(
  method: string,
  path: string,
  metadata: RouteMetadata,
): void {
  routeRegistry.set(registryKey(method, path), metadata);
}
