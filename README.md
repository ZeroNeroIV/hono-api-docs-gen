# hono-api-docs

Auto-generate API documentation for [Hono](https://hono.dev) applications. Drop-in middleware that introspects your routes and serves a clean HTML documentation page -- no config files, no build step, no external dependencies.

## Installation

```bash
# bun
bun add hono-api-docs

# npm
npm install hono-api-docs

# pnpm
pnpm add hono-api-docs
```

> **Peer dependency:** `hono >= 4.0.0`

## Quick Start

```typescript
import { Hono } from "hono";
import { docs } from "hono-api-docs";

const app = new Hono();

app.get("/users", getUsers);
app.post("/users", createUser);
app.get("/users/:id", getUser);
app.delete("/users/:id", deleteUser);

app.use("/docs", docs(app));

export default app;
```

Visit `/docs` and you get a fully rendered documentation page listing every registered route, its HTTP method, path, and handler name.

## Configuration

Pass an optional config object as the second argument:

```typescript
app.use(
  "/docs",
  docs(app, {
    title: "My API v2",
    exclude: [
      { method: "GET", path: "/health" },
      { method: "GET", path: "/metrics" },
    ],
  })
);
```

### Options

| Option    | Type                                           | Default               | Description                          |
| --------- | ---------------------------------------------- | --------------------- | ------------------------------------ |
| `title`   | `string`                                       | `"API Documentation"` | Page title shown in the HTML output. |
| `exclude` | `Array<{ method?: string; path?: string }>`    | `[]`                  | Routes to hide from the docs page.   |

## Advanced Usage

### Using with Sub-routers

```typescript
import { Hono } from "hono";
import { docs } from "hono-api-docs";

const app = new Hono();
const api = new Hono();

api.get("/users", getUsers);
api.post("/users", createUser);

app.route("/api", api);
app.use("/docs", docs(app));

export default app;
```

All routes mounted via `.route()` are picked up automatically.

### Accessing Parsed Routes Directly

If you need the route data without the HTML (e.g. to build your own UI or export as JSON):

```typescript
import { parseRoutes } from "hono-api-docs";

const routes = parseRoutes(app);
// [
//   { method: "GET",    path: "/api/users",     handleName: "getUsers" },
//   { method: "POST",   path: "/api/users",     handleName: "createUser" },
//   { method: "GET",    path: "/api/users/:id",  handleName: "getUser" },
//   { method: "DELETE", path: "/api/users/:id",  handleName: "deleteUser" },
// ]
```

### Custom HTML Generation

Generate the HTML string yourself for more control:

```typescript
import { parseRoutes, generateDocHtml } from "hono-api-docs";

const routes = parseRoutes(app);
const html = generateDocHtml(routes, { title: "Internal API" });
```

## API Reference

### `docs(app, config?)`

Returns a Hono `MiddlewareHandler` that serves the documentation page.

| Parameter | Type        | Required | Description                     |
| --------- | ----------- | -------- | ------------------------------- |
| `app`     | `Hono`      | Yes      | Your Hono application instance. |
| `config`  | `DocConfig` | No       | Configuration options.          |

### `parseRoutes(app)`

Extracts all registered routes from a Hono app instance.

**Returns:** `ParsedRoute[]`

```typescript
interface ParsedRoute {
  method: string;
  path: string;
  handleName?: string;
}
```

### `generateDocHtml(routes, config?)`

Generates an HTML string from an array of parsed routes.

| Parameter | Type            | Required | Description            |
| --------- | --------------- | -------- | ---------------------- |
| `routes`  | `ParsedRoute[]` | Yes      | Array of parsed routes |
| `config`  | `DocConfig`     | No       | Configuration options  |

**Returns:** `string` (HTML)

## Generated Output

The docs page includes:

- Color-coded HTTP methods (GET = green, POST = blue, PUT = orange, DELETE = red, PATCH = purple)
- Route paths with parameter placeholders
- Handler function names (when available)
- Clean, minimal styling using `system-ui`

## Development

```bash
# Clone the repo
git clone https://github.com/ZeroNeroIV/hono-api-docs.git
cd hono-api-docs/packages/hono-api-docs

# Install dependencies
bun install

# Build
bun run build
```

## License

MIT
