// ─── Schema Types ───────────────────────────────────────────────────────────

export type SchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object";

export interface SchemaProperty {
  type: SchemaType;
  description?: string;
  required?: boolean;
  enum?: (string | number)[];
  default?: unknown;
  example?: unknown;
  format?: string;
  items?: SchemaDefinition;
  properties?: Record<string, SchemaProperty>;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface SchemaDefinition {
  type: SchemaType;
  description?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  items?: SchemaDefinition;
  example?: unknown;
  enum?: (string | number)[];
}

// ─── Parameter Types ────────────────────────────────────────────────────────

export type ParameterLocation = "path" | "query" | "header" | "cookie";

export interface ParameterDefinition {
  name: string;
  in: ParameterLocation;
  description?: string;
  required?: boolean;
  type: SchemaType;
  enum?: (string | number)[];
  default?: unknown;
  example?: unknown;
  format?: string;
}

// ─── Request Body ───────────────────────────────────────────────────────────

export interface RequestBodyDefinition {
  description?: string;
  required?: boolean;
  contentType?: string;
  schema: SchemaDefinition;
}

// ─── Response Types ─────────────────────────────────────────────────────────

export interface ResponseDefinition {
  description: string;
  contentType?: string;
  schema?: SchemaDefinition;
  headers?: Record<string, { description?: string; type: SchemaType }>;
}

// ─── Route Metadata (decorator payload) ─────────────────────────────────────

export interface RouteMetadata {
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: ParameterDefinition[];
  requestBody?: RequestBodyDefinition;
  responses?: Record<number, ResponseDefinition>;
  security?: string[];
}

// ─── Parsed Route (enriched) ────────────────────────────────────────────────

export interface ParsedRoute {
  method: string;
  path: string;
  handleName?: string;
  metadata?: RouteMetadata;
}

// ─── Tag Info ───────────────────────────────────────────────────────────────

export interface TagDefinition {
  name: string;
  description?: string;
}

// ─── Server Info ────────────────────────────────────────────────────────────

export interface ServerDefinition {
  url: string;
  description?: string;
}

// ─── Doc Config ─────────────────────────────────────────────────────────────

export interface DocConfig {
  title?: string;
  description?: string;
  version?: string;
  servers?: ServerDefinition[];
  tags?: TagDefinition[];
  docsPath?: string;
  exclude?: Array<{ method?: string; path?: string }>;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    sidebarColor?: string;
    accentColor?: string;
  };
}
