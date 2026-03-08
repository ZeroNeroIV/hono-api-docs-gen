import type { Hono } from "hono";
import type { ParsedRoute } from "./types";
/**
 * Introspect a Hono app's route registry and enrich each route
 * with any metadata previously registered via `describe()` or `registerRoute()`.
 */
export declare function parseRoutes(app: Hono): ParsedRoute[];
