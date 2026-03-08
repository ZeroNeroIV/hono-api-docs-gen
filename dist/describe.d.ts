import type { MiddlewareHandler } from "hono";
import type { RouteMetadata } from "./types";
export interface RegistryKey {
    method: string;
    path: string;
}
/**
 * Get all registered route metadata.
 */
export declare function getRegistry(): Map<string, RouteMetadata>;
/**
 * Look up metadata for a specific method + path.
 */
export declare function getRouteMetadata(method: string, path: string): RouteMetadata | undefined;
/**
 * Clear all registered metadata (useful for testing).
 */
export declare function clearRegistry(): void;
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
export declare function describe(method: string, path: string, metadata: RouteMetadata): MiddlewareHandler;
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
export declare function registerRoute(method: string, path: string, metadata: RouteMetadata): void;
