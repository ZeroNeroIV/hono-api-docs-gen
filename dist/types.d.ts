export type SchemaType = "string" | "number" | "integer" | "boolean" | "array" | "object";
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
export interface RequestBodyDefinition {
    description?: string;
    required?: boolean;
    contentType?: string;
    schema: SchemaDefinition;
}
export interface ResponseDefinition {
    description: string;
    contentType?: string;
    schema?: SchemaDefinition;
    headers?: Record<string, {
        description?: string;
        type: SchemaType;
    }>;
}
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
export interface ParsedRoute {
    method: string;
    path: string;
    handleName?: string;
    metadata?: RouteMetadata;
}
export interface TagDefinition {
    name: string;
    description?: string;
}
export interface ServerDefinition {
    url: string;
    description?: string;
}
export interface DocConfig {
    title?: string;
    description?: string;
    version?: string;
    servers?: ServerDefinition[];
    tags?: TagDefinition[];
    docsPath?: string;
    exclude?: Array<{
        method?: string;
        path?: string;
    }>;
    theme?: {
        primaryColor?: string;
        backgroundColor?: string;
        textColor?: string;
        sidebarColor?: string;
        accentColor?: string;
    };
}
