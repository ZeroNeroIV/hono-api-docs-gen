// Core middleware
export { docs } from "./middleware";

// Decorator-style API
export { describe, registerRoute, getRegistry, getRouteMetadata, clearRegistry } from "./describe";

// Parser & generator (advanced usage)
export { parseRoutes } from "./parser";
export { generateDocHtml } from "./generator";

// Config
export { createConfig, defaultConfig } from "./config";

// Types
export type {
  DocConfig,
  ParsedRoute,
  RouteMetadata,
  SchemaDefinition,
  SchemaProperty,
  SchemaType,
  ParameterDefinition,
  ParameterLocation,
  RequestBodyDefinition,
  ResponseDefinition,
  TagDefinition,
  ServerDefinition,
} from "./types";
