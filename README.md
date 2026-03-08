# @zeronerov/hono-api-docs-gen

Swagger-like API documentation for [Hono](https://hono.dev) applications. Drop-in middleware that introspects your routes and serves an interactive documentation page with **Try It Out**, request/response schemas, and more -- zero external dependencies.

## Features

- Interactive Swagger-style UI with collapsible endpoints grouped by tags
- **Try It Out** -- send requests directly from the docs page
- Auto-detected path parameters from `:param` and `{param}` patterns
- Request body editor with field hints showing types, required/optional, constraints
- Dynamic query parameter and header inputs
- Response status code documentation with schema display
- Sidebar navigation with search/filter
- JSON spec endpoint for programmatic consumption
- Customizable theme and docs path
- Zero runtime dependencies (peer dep: `hono >= 4.0.0`)

## Installation

```bash
# bun
bun add @zeronerov/hono-api-docs-gen

# npm
npm install @zeronerov/hono-api-docs-gen

# pnpm
pnpm add @zeronerov/hono-api-docs-gen
```

> **Peer dependency:** `hono >= 4.0.0`

## Quick Start

```typescript
import { Hono } from "hono";
import { docs } from "@zeronerov/hono-api-docs-gen";

const app = new Hono();

app.get("/users", (c) => c.json([]));
app.post("/users", (c) => c.json({ id: 1 }));
app.get("/users/:id", (c) => c.json({ id: c.req.param("id") }));
app.delete("/users/:id", (c) => c.text("deleted"));

// Serve docs at /docs (default)
app.use("*", docs(app));

export default app;
```

Visit `/docs` to see the interactive documentation page. Visit `/docs/json` for the raw JSON spec.

## Describing Routes

Use `describe()` to attach Swagger-like metadata to your routes. It acts as a pass-through middleware -- place it before your handler:

```typescript
import { Hono } from "hono";
import { docs, describe } from "@zeronerov/hono-api-docs-gen";

const app = new Hono();

app.get(
  "/users",
  describe("GET", "/users", {
    summary: "List all users",
    description: "Returns a paginated list of users",
    tags: ["Users"],
    parameters: [
      {
        name: "page",
        in: "query",
        type: "integer",
        description: "Page number",
        default: 1,
      },
      {
        name: "limit",
        in: "query",
        type: "integer",
        description: "Items per page",
        default: 20,
      },
    ],
    responses: {
      200: {
        description: "Successful response",
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "integer", description: "User ID" },
              name: { type: "string", description: "Full name" },
              email: { type: "string", format: "email", description: "Email address" },
            },
          },
        },
      },
    },
  }),
  (c) => c.json([]),
);

app.post(
  "/users",
  describe("POST", "/users", {
    summary: "Create a user",
    tags: ["Users"],
    requestBody: {
      required: true,
      description: "User data to create",
      contentType: "application/json",
      schema: {
        type: "object",
        required: ["name", "email"],
        properties: {
          name: { type: "string", description: "Full name", example: "Jane Doe" },
          email: { type: "string", format: "email", description: "Email address" },
          role: {
            type: "string",
            enum: ["admin", "user"],
            default: "user",
            description: "User role",
          },
        },
      },
    },
    responses: {
      201: { description: "User created" },
      400: { description: "Validation error" },
    },
  }),
  (c) => c.json({ id: 1 }, 201),
);

app.use("*", docs(app, { title: "My API", version: "2.0.0" }));

export default app;
```

### Alternative: `registerRoute()`

If you prefer not to add middleware to the handler chain, use `registerRoute()` to register metadata separately:

```typescript
import { registerRoute } from "@zeronerov/hono-api-docs-gen";

registerRoute("GET", "/health", {
  summary: "Health check",
  tags: ["System"],
  responses: { 200: { description: "OK" } },
});

app.get("/health", (c) => c.json({ status: "ok" }));
```

## Configuration

```typescript
app.use(
  "*",
  docs(app, {
    title: "My API",
    description: "A sample REST API",
    version: "2.0.0",
    docsPath: "/api-docs",
    servers: [
      { url: "https://api.example.com", description: "Production" },
      { url: "http://localhost:3000", description: "Local" },
    ],
    tags: [
      { name: "Users", description: "User management endpoints" },
      { name: "Auth", description: "Authentication endpoints" },
    ],
    exclude: [
      { method: "GET", path: "/health" },
      { path: "/internal" },
    ],
    theme: {
      primaryColor: "#4f46e5",
      backgroundColor: "#ffffff",
      textColor: "#1e293b",
      sidebarColor: "#f8fafc",
      accentColor: "#6366f1",
    },
  }),
);
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `"API Documentation"` | Page title |
| `description` | `string` | `""` | API description shown below the title |
| `version` | `string` | `"1.0.0"` | API version badge |
| `docsPath` | `string` | `"/docs"` | URL path where docs are served |
| `servers` | `ServerDefinition[]` | `[]` | Server URLs for the Try It Out dropdown |
| `tags` | `TagDefinition[]` | `[]` | Tag names/descriptions for grouping |
| `exclude` | `Array<{ method?, path? }>` | `[]` | Routes to hide (supports partial matching) |
| `theme` | `object` | *(see above)* | UI color customization |

## Route Metadata

The `describe()` and `registerRoute()` functions accept a `RouteMetadata` object:

```typescript
interface RouteMetadata {
  summary?: string;            // Short summary shown in the route header
  description?: string;        // Longer description shown when expanded
  tags?: string[];             // Tags for grouping (routes appear under each tag)
  deprecated?: boolean;        // Marks the endpoint as deprecated
  parameters?: ParameterDefinition[];
  requestBody?: RequestBodyDefinition;
  responses?: Record<number, ResponseDefinition>;
  security?: string[];
}
```

### Parameters

```typescript
interface ParameterDefinition {
  name: string;                        // Parameter name
  in: "path" | "query" | "header" | "cookie";
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  required?: boolean;
  enum?: (string | number)[];
  default?: unknown;
  example?: unknown;
  format?: string;                     // e.g. "email", "date-time", "uri"
}
```

> Path parameters are **auto-detected** from route patterns like `/users/:id` or `/users/{id}`. You only need to declare them explicitly if you want to add descriptions, types, or constraints.

### Request Body

```typescript
interface RequestBodyDefinition {
  description?: string;
  required?: boolean;
  contentType?: string;   // default: "application/json"
  schema: SchemaDefinition;
}
```

When a request body schema is defined, the Try It Out panel shows a **field hint table** above the textarea displaying each field's name, type, required/optional status, constraints, defaults, and examples.

For routes with body-capable methods (POST, PUT, PATCH, DELETE) that have no schema defined, the textarea still appears with a hint: *"No schema defined -- send any valid body."*

### Schema Definition

```typescript
interface SchemaDefinition {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];          // List of required field names
  items?: SchemaDefinition;     // For array types
  example?: unknown;
  enum?: (string | number)[];
}

interface SchemaProperty {
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
```

### Responses

```typescript
interface ResponseDefinition {
  description: string;
  contentType?: string;
  schema?: SchemaDefinition;
  headers?: Record<string, { description?: string; type: SchemaType }>;
}
```

Response status codes are color-coded: 2xx green, 3xx blue, 4xx amber, 5xx red.

## Try It Out

Every route's expanded view includes a **Try It Out** panel with:

- **Server selector** -- choose from configured servers or use the current origin
- **Path parameters** -- auto-detected from `:param`/`{param}` patterns, with inputs pre-rendered
- **Query parameters** -- declared params get dedicated inputs; an "+ Add" button allows adding arbitrary key/value pairs
- **Headers** -- same pattern as query params, with declared + dynamic inputs
- **Request body** -- shown for POST/PUT/PATCH/DELETE with a content-type selector (JSON, form-urlencoded, multipart, text/plain), a field hint table when a schema is defined, and a pre-filled textarea with example JSON
- **Response display** -- shows status code, response time, headers, and formatted body

## JSON Spec Endpoint

A JSON representation of your API is available at `{docsPath}/json` (default: `/docs/json`):

```bash
curl http://localhost:3000/docs/json
```

Returns:

```json
{
  "title": "My API",
  "description": "...",
  "version": "2.0.0",
  "servers": [],
  "tags": [],
  "routes": [
    {
      "method": "GET",
      "path": "/users",
      "handler": "getUsers",
      "summary": "List all users",
      "tags": ["Users"],
      "parameters": [...],
      "responses": {...}
    }
  ]
}
```

## Advanced Usage

### Using with Sub-routers

```typescript
const app = new Hono();
const api = new Hono();

api.get("/users", getUsers);
api.post("/users", createUser);

app.route("/api", api);
app.use("*", docs(app));

export default app;
```

All routes mounted via `.route()` are picked up automatically.

### Accessing Parsed Routes Directly

```typescript
import { parseRoutes } from "@zeronerov/hono-api-docs-gen";

const routes = parseRoutes(app);
// [
//   { method: "GET", path: "/users", handleName: "getUsers", metadata: {...} },
//   { method: "POST", path: "/users", handleName: "createUser", metadata: {...} },
// ]
```

### Custom HTML Generation

```typescript
import { parseRoutes, generateDocHtml } from "@zeronerov/hono-api-docs-gen";

const routes = parseRoutes(app);
const html = generateDocHtml(routes, { title: "Internal API" });
```

### Registry Utilities

```typescript
import { getRegistry, getRouteMetadata, clearRegistry } from "@zeronerov/hono-api-docs-gen";

// Get all registered metadata
const registry = getRegistry(); // Map<string, RouteMetadata>

// Look up metadata for a specific route
const meta = getRouteMetadata("GET", "/users");

// Clear all metadata (useful in tests)
clearRegistry();
```

## Exports

| Export | Kind | Description |
| --- | --- | --- |
| `docs` | Function | Hono middleware that serves the docs UI and JSON spec |
| `describe` | Function | Decorator-style middleware to attach metadata to a route |
| `registerRoute` | Function | Imperative metadata registration (no middleware) |
| `parseRoutes` | Function | Extract routes from a Hono app as `ParsedRoute[]` |
| `generateDocHtml` | Function | Generate the HTML docs string from parsed routes |
| `createConfig` | Function | Merge user config with defaults |
| `defaultConfig` | Object | Default configuration values |
| `getRegistry` | Function | Get the full metadata registry |
| `getRouteMetadata` | Function | Look up metadata for a specific method + path |
| `clearRegistry` | Function | Clear all registered metadata |
| `DocConfig` | Type | Configuration options |
| `ParsedRoute` | Type | Enriched parsed route with metadata |
| `RouteMetadata` | Type | Route metadata (summary, tags, params, body, responses) |
| `SchemaDefinition` | Type | JSON-schema-like type definition |
| `SchemaProperty` | Type | Property within a schema |
| `SchemaType` | Type | `"string" \| "number" \| "integer" \| "boolean" \| "array" \| "object"` |
| `ParameterDefinition` | Type | Path/query/header/cookie parameter |
| `ParameterLocation` | Type | `"path" \| "query" \| "header" \| "cookie"` |
| `RequestBodyDefinition` | Type | Request body schema + metadata |
| `ResponseDefinition` | Type | Response schema + metadata |
| `TagDefinition` | Type | Tag name + description |
| `ServerDefinition` | Type | Server URL + description |

## Development

```bash
git clone https://github.com/ZeroNeroIV/hono-api-docs-gen.git
cd hono-api-docs-gen

bun install
bun run build
```

## License

MIT
