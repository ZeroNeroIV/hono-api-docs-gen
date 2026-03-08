// @bun
// src/describe.ts
var routeRegistry = new Map;
function registryKey(method, path) {
  return `${method.toUpperCase()}:${path}`;
}
function getRegistry() {
  return routeRegistry;
}
function getRouteMetadata(method, path) {
  return routeRegistry.get(registryKey(method, path));
}
function clearRegistry() {
  routeRegistry.clear();
}
function describe(method, path, metadata) {
  routeRegistry.set(registryKey(method, path), metadata);
  return async (_c, next) => {
    await next();
  };
}
function registerRoute(method, path, metadata) {
  routeRegistry.set(registryKey(method, path), metadata);
}

// src/parser.ts
function parseRoutes(app) {
  const seen = new Set;
  const routes = [];
  for (const route of app.routes) {
    const method = route.method.toUpperCase();
    const key = `${method}:${route.path}`;
    if (seen.has(key))
      continue;
    seen.add(key);
    routes.push({
      method,
      path: route.path,
      handleName: route.handler?.name || undefined,
      metadata: getRouteMetadata(method, route.path)
    });
  }
  return routes;
}

// src/config.ts
var defaultConfig = {
  title: "API Documentation",
  description: "",
  version: "1.0.0",
  servers: [],
  tags: [],
  docsPath: "/docs",
  exclude: [],
  theme: {
    primaryColor: "#4f46e5",
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    sidebarColor: "#f8fafc",
    accentColor: "#6366f1"
  }
};
function createConfig(config = {}) {
  return {
    title: config.title ?? defaultConfig.title,
    description: config.description ?? defaultConfig.description,
    version: config.version ?? defaultConfig.version,
    servers: config.servers ?? defaultConfig.servers,
    tags: config.tags ?? defaultConfig.tags,
    docsPath: config.docsPath ?? defaultConfig.docsPath,
    exclude: config.exclude ?? defaultConfig.exclude,
    theme: { ...defaultConfig.theme, ...config.theme }
  };
}

// src/generator.ts
function esc(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function isExcluded(r, exclude) {
  return exclude?.some((e) => {
    const methodMatch = !e.method || e.method.toUpperCase() === r.method;
    const pathMatch = !e.path || e.path === r.path;
    return methodMatch && pathMatch;
  }) ?? false;
}
function groupByTag(routes) {
  const groups = {};
  for (const route of routes) {
    const tags = route.metadata?.tags ?? ["default"];
    for (const tag of tags) {
      if (!groups[tag])
        groups[tag] = [];
      groups[tag].push(route);
    }
  }
  return groups;
}
function renderSchemaTable(schema, depth = 0) {
  if (!schema.properties) {
    if (schema.type === "array" && schema.items) {
      return `<div class="schema-type">Array of:</div>${renderSchemaTable(schema.items, depth)}`;
    }
    return `<span class="schema-type">${esc(schema.type)}</span>`;
  }
  let html = '<table class="schema-table">';
  html += "<thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead><tbody>";
  for (const [name, prop] of Object.entries(schema.properties)) {
    const isRequired = schema.required?.includes(name);
    const typeStr = formatPropertyType(prop);
    html += `<tr>
      <td><code>${esc(name)}</code>${isRequired ? '<span class="required-badge">required</span>' : ""}</td>
      <td><span class="schema-type">${esc(typeStr)}</span></td>
      <td>${esc(prop.description ?? "")}</td>
    </tr>`;
  }
  html += "</tbody></table>";
  return html;
}
function formatPropertyType(prop) {
  let t = prop.type;
  if (prop.format)
    t += ` (${prop.format})`;
  if (prop.nullable)
    t += " | null";
  if (prop.type === "array" && prop.items)
    t = `${prop.items.type}[]`;
  if (prop.enum)
    t += ` [${prop.enum.join(", ")}]`;
  return t;
}
function renderSchemaExample(schema) {
  if (schema.example !== undefined) {
    return JSON.stringify(schema.example, null, 2);
  }
  return JSON.stringify(buildExampleFromSchema(schema), null, 2);
}
function buildExampleFromSchema(schema) {
  if (schema.example !== undefined)
    return schema.example;
  switch (schema.type) {
    case "object": {
      const obj = {};
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = buildPropertyExample(prop);
        }
      }
      return obj;
    }
    case "array":
      return schema.items ? [buildExampleFromSchema(schema.items)] : [];
    case "string":
      return schema.enum ? schema.enum[0] : "string";
    case "number":
    case "integer":
      return schema.enum ? schema.enum[0] : 0;
    case "boolean":
      return true;
    default:
      return null;
  }
}
function buildPropertyExample(prop) {
  if (prop.example !== undefined)
    return prop.example;
  if (prop.default !== undefined)
    return prop.default;
  if (prop.enum)
    return prop.enum[0];
  switch (prop.type) {
    case "string":
      return prop.format === "email" ? "user@example.com" : prop.format === "date-time" ? "2025-01-01T00:00:00Z" : prop.format === "date" ? "2025-01-01" : prop.format === "uri" ? "https://example.com" : "string";
    case "number":
      return 0;
    case "integer":
      return 0;
    case "boolean":
      return true;
    case "array":
      return prop.items ? [buildExampleFromSchema(prop.items)] : [];
    case "object":
      if (prop.properties) {
        const obj = {};
        for (const [k, v] of Object.entries(prop.properties)) {
          obj[k] = buildPropertyExample(v);
        }
        return obj;
      }
      return {};
    default:
      return null;
  }
}
function renderParameters(params) {
  if (!params.length)
    return "";
  let html = '<div class="params-section"><h4>Parameters</h4>';
  html += '<table class="params-table"><thead><tr><th>Name</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>';
  for (const p of params) {
    html += `<tr>
      <td><code>${esc(p.name)}</code></td>
      <td><span class="param-in param-in-${p.in}">${esc(p.in)}</span></td>
      <td><span class="schema-type">${esc(p.type)}${p.format ? ` (${esc(p.format)})` : ""}</span></td>
      <td>${p.required ? '<span class="required-badge">yes</span>' : "no"}</td>
      <td>${esc(p.description ?? "")}</td>
    </tr>`;
  }
  html += "</tbody></table></div>";
  return html;
}
function renderRequestBody(body) {
  let html = '<div class="request-body-section"><h4>Request Body';
  if (body.required)
    html += ' <span class="required-badge">required</span>';
  html += "</h4>";
  if (body.description)
    html += `<p class="section-desc">${esc(body.description)}</p>`;
  if (body.contentType)
    html += `<div class="content-type">Content-Type: <code>${esc(body.contentType)}</code></div>`;
  html += '<div class="schema-tabs">';
  html += '<button class="schema-tab active" data-target="schema">Schema</button>';
  html += '<button class="schema-tab" data-target="example">Example</button>';
  html += "</div>";
  html += `<div class="schema-panel schema-panel-schema active">${renderSchemaTable(body.schema)}</div>`;
  html += `<div class="schema-panel schema-panel-example"><pre class="example-json"><code>${esc(renderSchemaExample(body.schema))}</code></pre></div>`;
  html += "</div>";
  return html;
}
function renderResponses(responses) {
  let html = '<div class="responses-section"><h4>Responses</h4>';
  for (const [code, resp] of Object.entries(responses)) {
    const statusClass = Number(code) < 300 ? "status-success" : Number(code) < 400 ? "status-redirect" : Number(code) < 500 ? "status-client-error" : "status-server-error";
    html += `<div class="response-item">`;
    html += `<div class="response-header"><span class="status-code ${statusClass}">${esc(String(code))}</span> <span class="response-desc">${esc(resp.description)}</span></div>`;
    if (resp.schema) {
      html += '<div class="schema-tabs">';
      html += '<button class="schema-tab active" data-target="schema">Schema</button>';
      html += '<button class="schema-tab" data-target="example">Example</button>';
      html += "</div>";
      html += `<div class="schema-panel schema-panel-schema active">${renderSchemaTable(resp.schema)}</div>`;
      html += `<div class="schema-panel schema-panel-example"><pre class="example-json"><code>${esc(renderSchemaExample(resp.schema))}</code></pre></div>`;
    }
    html += "</div>";
  }
  html += "</div>";
  return html;
}
function renderRouteCard(route, index) {
  const meta = route.metadata;
  const methodLower = route.method.toLowerCase();
  const routeId = `route-${index}`;
  let html = `<div class="route-card method-${methodLower}" id="${routeId}">`;
  html += `<div class="route-header" onclick="toggleRoute('${routeId}')">`;
  html += `<span class="method-badge method-badge-${methodLower}">${esc(route.method)}</span>`;
  html += `<span class="route-path">${esc(route.path)}</span>`;
  if (meta?.summary)
    html += `<span class="route-summary">${esc(meta.summary)}</span>`;
  if (meta?.deprecated)
    html += '<span class="deprecated-badge">Deprecated</span>';
  html += '<span class="expand-icon">&#9662;</span>';
  html += "</div>";
  html += `<div class="route-body" id="${routeId}-body">`;
  if (meta?.description)
    html += `<p class="route-description">${esc(meta.description)}</p>`;
  if (meta?.parameters?.length) {
    html += renderParameters(meta.parameters);
  }
  if (meta?.requestBody) {
    html += renderRequestBody(meta.requestBody);
  }
  if (meta?.responses && Object.keys(meta.responses).length > 0) {
    html += renderResponses(meta.responses);
  }
  html += renderTryItOut(route, index);
  html += "</div>";
  html += "</div>";
  return html;
}
function extractPathParams(path) {
  const params = [];
  const colonRegex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match;
  while ((match = colonRegex.exec(path)) !== null) {
    params.push(match[1]);
  }
  const braceRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  while ((match = braceRegex.exec(path)) !== null) {
    if (!params.includes(match[1]))
      params.push(match[1]);
  }
  return params;
}
var METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);
function renderBodyHint(schema, description) {
  let html = '<div class="body-hint">';
  if (description) {
    html += `<p class="body-hint-desc">${esc(description)}</p>`;
  }
  if (!schema) {
    html += '<p class="body-hint-none">No schema defined \u2014 send any valid body.</p>';
    html += "</div>";
    return html;
  }
  if (schema.type === "object" && schema.properties) {
    html += '<div class="body-hint-fields">';
    html += '<div class="body-hint-title">Expected fields:</div>';
    html += '<table class="body-hint-table">';
    html += "<thead><tr><th>Field</th><th>Type</th><th>Status</th><th>Info</th></tr></thead><tbody>";
    for (const [name, prop] of Object.entries(schema.properties)) {
      const isRequired = schema.required?.includes(name);
      const typeStr = formatPropertyType(prop);
      const constraints = buildConstraintHints(prop);
      html += `<tr>`;
      html += `<td><code>${esc(name)}</code></td>`;
      html += `<td><span class="schema-type">${esc(typeStr)}</span></td>`;
      html += `<td>${isRequired ? '<span class="required-badge">required</span>' : '<span class="optional-badge">optional</span>'}</td>`;
      html += `<td>`;
      if (prop.description)
        html += `${esc(prop.description)}`;
      if (constraints)
        html += `${prop.description ? " \u2014 " : ""}${constraints}`;
      if (prop.default !== undefined)
        html += ` <span class="hint-default">Default: <code>${esc(String(prop.default))}</code></span>`;
      if (prop.example !== undefined)
        html += ` <span class="hint-example">e.g. <code>${esc(String(prop.example))}</code></span>`;
      html += `</td>`;
      html += `</tr>`;
    }
    html += "</tbody></table></div>";
  } else if (schema.type === "array" && schema.items) {
    html += `<div class="body-hint-fields">`;
    html += `<div class="body-hint-title">Expected: Array of <code>${esc(schema.items.type)}</code></div>`;
    if (schema.items.type === "object" && schema.items.properties) {
      html += renderBodyHintTableForObject(schema.items);
    }
    html += `</div>`;
  } else {
    html += `<div class="body-hint-fields">`;
    html += `<div class="body-hint-title">Expected: <code>${esc(schema.type)}</code></div>`;
    if (schema.description)
      html += `<p class="body-hint-desc">${esc(schema.description)}</p>`;
    html += `</div>`;
  }
  html += "</div>";
  return html;
}
function renderBodyHintTableForObject(schema) {
  if (!schema.properties)
    return "";
  let html = '<table class="body-hint-table">';
  html += "<thead><tr><th>Field</th><th>Type</th><th>Status</th><th>Info</th></tr></thead><tbody>";
  for (const [name, prop] of Object.entries(schema.properties)) {
    const isRequired = schema.required?.includes(name);
    const typeStr = formatPropertyType(prop);
    const constraints = buildConstraintHints(prop);
    html += `<tr>`;
    html += `<td><code>${esc(name)}</code></td>`;
    html += `<td><span class="schema-type">${esc(typeStr)}</span></td>`;
    html += `<td>${isRequired ? '<span class="required-badge">required</span>' : '<span class="optional-badge">optional</span>'}</td>`;
    html += `<td>`;
    if (prop.description)
      html += `${esc(prop.description)}`;
    if (constraints)
      html += `${prop.description ? " \u2014 " : ""}${constraints}`;
    if (prop.default !== undefined)
      html += ` <span class="hint-default">Default: <code>${esc(String(prop.default))}</code></span>`;
    if (prop.example !== undefined)
      html += ` <span class="hint-example">e.g. <code>${esc(String(prop.example))}</code></span>`;
    html += `</td>`;
    html += `</tr>`;
  }
  html += "</tbody></table>";
  return html;
}
function buildConstraintHints(prop) {
  const parts = [];
  if (prop.minimum !== undefined)
    parts.push(`min: ${prop.minimum}`);
  if (prop.maximum !== undefined)
    parts.push(`max: ${prop.maximum}`);
  if (prop.minLength !== undefined)
    parts.push(`minLen: ${prop.minLength}`);
  if (prop.maxLength !== undefined)
    parts.push(`maxLen: ${prop.maxLength}`);
  if (prop.pattern)
    parts.push(`pattern: ${prop.pattern}`);
  if (prop.enum)
    parts.push(`enum: [${prop.enum.join(", ")}]`);
  if (prop.format)
    parts.push(`format: ${prop.format}`);
  if (prop.nullable)
    parts.push("nullable");
  return parts.join(", ");
}
function renderTryItOut(route, index) {
  const tryId = `try-${index}`;
  const meta = route.metadata;
  let html = '<div class="try-it-out-section">';
  html += `<button class="try-it-btn" onclick="toggleTryIt('${tryId}')">Try it out</button>`;
  html += `<div class="try-it-panel" id="${tryId}">`;
  html += `<div class="try-field"><label>Server</label><select class="try-server" id="${tryId}-server"><option value="">Current origin</option></select></div>`;
  const autoPathParams = extractPathParams(route.path);
  const declaredPathParams = (meta?.parameters ?? []).filter((p) => p.in === "path");
  const declaredPathNames = new Set(declaredPathParams.map((p) => p.name));
  for (const p of declaredPathParams) {
    html += `<div class="try-field"><label>${esc(p.name)} <span class="param-in param-in-path">path</span>${p.required ? ' <span class="required-badge">required</span>' : ""}</label>`;
    html += `<input type="text" class="try-input" placeholder="${esc(p.description ?? p.name)}" data-param="${esc(p.name)}" data-in="path" /></div>`;
  }
  for (const name of autoPathParams) {
    if (declaredPathNames.has(name))
      continue;
    html += `<div class="try-field"><label>${esc(name)} <span class="param-in param-in-path">path</span> <span class="required-badge">required</span></label>`;
    html += `<input type="text" class="try-input" placeholder="${esc(name)}" data-param="${esc(name)}" data-in="path" /></div>`;
  }
  const declaredQueryParams = (meta?.parameters ?? []).filter((p) => p.in === "query");
  for (const p of declaredQueryParams) {
    html += `<div class="try-field"><label>${esc(p.name)} <span class="param-in param-in-query">query</span>${p.required ? ' <span class="required-badge">required</span>' : ""}</label>`;
    html += `<input type="text" class="try-input" placeholder="${esc(p.description ?? p.name)}" data-param="${esc(p.name)}" data-in="query" /></div>`;
  }
  html += `<div class="dynamic-params-section">`;
  html += `<div class="dynamic-params-header"><span class="dynamic-params-label">Query Parameters</span>`;
  html += `<button type="button" class="add-param-btn" onclick="addDynamicParam('${tryId}', 'query')">+ Add</button></div>`;
  html += `<div class="dynamic-params-list" id="${tryId}-dynamic-query"></div>`;
  html += `</div>`;
  const declaredHeaderParams = (meta?.parameters ?? []).filter((p) => p.in === "header");
  for (const p of declaredHeaderParams) {
    html += `<div class="try-field"><label>${esc(p.name)} <span class="param-in param-in-header">header</span>${p.required ? ' <span class="required-badge">required</span>' : ""}</label>`;
    html += `<input type="text" class="try-input" placeholder="${esc(p.description ?? p.name)}" data-param="${esc(p.name)}" data-in="header" /></div>`;
  }
  html += `<div class="dynamic-params-section">`;
  html += `<div class="dynamic-params-header"><span class="dynamic-params-label">Headers</span>`;
  html += `<button type="button" class="add-param-btn" onclick="addDynamicParam('${tryId}', 'header')">+ Add</button></div>`;
  html += `<div class="dynamic-params-list" id="${tryId}-dynamic-header"></div>`;
  html += `</div>`;
  if (METHODS_WITH_BODY.has(route.method)) {
    const hasSchema = !!meta?.requestBody?.schema;
    const schema = meta?.requestBody?.schema;
    const example = hasSchema ? renderSchemaExample(schema) : `{
  
}`;
    const contentType = meta?.requestBody?.contentType ?? "application/json";
    html += `<div class="try-field">`;
    html += `<label>Request Body${meta?.requestBody?.required ? ' <span class="required-badge">required</span>' : ""} <span class="content-type-label">${esc(contentType)}</span></label>`;
    html += renderBodyHint(schema, meta?.requestBody?.description);
    html += `<div class="body-content-type-row"><select class="try-content-type" id="${tryId}-content-type">`;
    html += `<option value="application/json"${contentType === "application/json" ? " selected" : ""}>application/json</option>`;
    html += `<option value="application/x-www-form-urlencoded"${contentType === "application/x-www-form-urlencoded" ? " selected" : ""}>application/x-www-form-urlencoded</option>`;
    html += `<option value="multipart/form-data"${contentType === "multipart/form-data" ? " selected" : ""}>multipart/form-data</option>`;
    html += `<option value="text/plain"${contentType === "text/plain" ? " selected" : ""}>text/plain</option>`;
    html += `</select></div>`;
    html += `<textarea class="try-body" id="${tryId}-body" rows="8">${esc(example)}</textarea>`;
    html += `</div>`;
  }
  html += `<button class="execute-btn" onclick="executeRequest(${index})">Execute</button>`;
  html += `<div class="try-response" id="${tryId}-response" style="display:none;">`;
  html += `<div class="response-status-line"><span>Status: </span><span id="${tryId}-status" class="response-status"></span></div>`;
  html += `<div class="response-time-line"><span>Time: </span><span id="${tryId}-time"></span></div>`;
  html += `<h5>Response Headers</h5><pre class="response-headers" id="${tryId}-resp-headers"></pre>`;
  html += `<h5>Response Body</h5><pre class="response-body" id="${tryId}-resp-body"></pre>`;
  html += "</div>";
  html += "</div>";
  html += "</div>";
  return html;
}
function generateDocHtml(routes, config) {
  const cfg = createConfig(config);
  const filtered = routes.filter((r) => !isExcluded(r, cfg.exclude));
  const grouped = groupByTag(filtered);
  const tagDescriptions = {};
  for (const t of cfg.tags) {
    tagDescriptions[t.name] = t.description ?? "";
  }
  let sidebarHtml = "";
  let mainHtml = "";
  let routeIndex = 0;
  const tagOrder = [
    ...cfg.tags.map((t) => t.name),
    ...Object.keys(grouped).filter((t) => !cfg.tags.some((ct) => ct.name === t))
  ];
  for (const tag of tagOrder) {
    const tagRoutes = grouped[tag];
    if (!tagRoutes?.length)
      continue;
    const tagId = `tag-${tag.replace(/[^a-zA-Z0-9]/g, "-")}`;
    sidebarHtml += `<div class="sidebar-tag">`;
    sidebarHtml += `<div class="sidebar-tag-name" onclick="toggleSidebarTag('${tagId}')">${esc(tag)} <span class="tag-count">${tagRoutes.length}</span></div>`;
    sidebarHtml += `<div class="sidebar-tag-routes" id="sidebar-${tagId}">`;
    for (const r of tagRoutes) {
      sidebarHtml += `<a class="sidebar-route" href="#route-${routeIndex}"><span class="method-dot method-dot-${r.method.toLowerCase()}"></span>${esc(r.method)} ${esc(r.path)}</a>`;
      routeIndex++;
    }
    sidebarHtml += "</div></div>";
    routeIndex -= tagRoutes.length;
    mainHtml += `<div class="tag-section" id="${tagId}">`;
    mainHtml += `<div class="tag-header" onclick="toggleTagSection('${tagId}')">`;
    mainHtml += `<h2>${esc(tag)}</h2>`;
    if (tagDescriptions[tag])
      mainHtml += `<p class="tag-desc">${esc(tagDescriptions[tag])}</p>`;
    mainHtml += '<span class="expand-icon">&#9662;</span>';
    mainHtml += "</div>";
    mainHtml += `<div class="tag-body" id="${tagId}-body">`;
    for (const r of tagRoutes) {
      mainHtml += renderRouteCard(r, routeIndex);
      routeIndex++;
    }
    mainHtml += "</div></div>";
  }
  const routeDataJson = JSON.stringify(filtered.map((r) => {
    const autoPathParams = extractPathParams(r.path);
    const declaredParams = r.metadata?.parameters ?? [];
    const declaredPathNames = new Set(declaredParams.filter((p) => p.in === "path").map((p) => p.name));
    const allPathParams = [
      ...declaredParams.filter((p) => p.in === "path").map((p) => p.name),
      ...autoPathParams.filter((n) => !declaredPathNames.has(n))
    ];
    return {
      method: r.method,
      path: r.path,
      pathParams: allPathParams,
      hasBody: METHODS_WITH_BODY.has(r.method),
      bodyContentType: r.metadata?.requestBody?.contentType ?? "application/json"
    };
  }));
  const serversJson = JSON.stringify(cfg.servers);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(cfg.title)}</title>
${generateStyles(cfg)}
</head>
<body>
<div class="layout">
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1 class="sidebar-title">${esc(cfg.title)}</h1>
      ${cfg.version ? `<span class="version-badge">${esc(cfg.version)}</span>` : ""}
    </div>
    <div class="sidebar-search">
      <input type="text" id="search-input" placeholder="Filter endpoints..." oninput="filterRoutes()" />
    </div>
    <nav class="sidebar-nav">
      ${sidebarHtml}
    </nav>
  </aside>

  <!-- Main content -->
  <main class="main-content">
    <div class="main-header">
      <h1>${esc(cfg.title)} ${cfg.version ? `<span class="version-badge">${esc(cfg.version)}</span>` : ""}</h1>
      ${cfg.description ? `<p class="api-description">${esc(cfg.description)}</p>` : ""}
      ${cfg.servers.length ? `<div class="servers-info"><strong>Servers:</strong> ${cfg.servers.map((s) => `<code>${esc(s.url)}</code>${s.description ? ` - ${esc(s.description)}` : ""}`).join(" | ")}</div>` : ""}
    </div>
    <div class="routes-container">
      ${mainHtml}
    </div>
  </main>
</div>

${generateScript(routeDataJson, serversJson)}
</body>
</html>`;
}
function generateStyles(cfg) {
  const t = cfg.theme;
  return `<style>
:root {
  --primary: ${t.primaryColor};
  --bg: ${t.backgroundColor};
  --text: ${t.textColor};
  --sidebar-bg: ${t.sidebarColor};
  --accent: ${t.accentColor};
  --border: #e2e8f0;
  --method-get: #22c55e;
  --method-post: #3b82f6;
  --method-put: #f59e0b;
  --method-delete: #ef4444;
  --method-patch: #a855f7;
  --method-head: #6b7280;
  --method-options: #06b6d4;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  color: var(--text);
  background: var(--bg);
  line-height: 1.6;
}

.layout { display: flex; min-height: 100vh; }

/* \u2500\u2500 Sidebar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.sidebar {
  width: 300px;
  min-width: 300px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  position: sticky;
  top: 0;
  height: 100vh;
}

.sidebar-header { padding: 1.25rem 1rem; border-bottom: 1px solid var(--border); }
.sidebar-title { font-size: 1rem; font-weight: 700; color: var(--primary); }
.sidebar-search { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); }
.sidebar-search input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}
.sidebar-search input:focus { border-color: var(--primary); }

.sidebar-nav { padding: 0.5rem 0; }
.sidebar-tag { border-bottom: 1px solid var(--border); }
.sidebar-tag-name {
  padding: 0.6rem 1rem;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
}
.sidebar-tag-name:hover { color: var(--primary); }
.tag-count {
  background: var(--border);
  padding: 0.1rem 0.5rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
}

.sidebar-tag-routes { padding: 0 0.5rem 0.5rem; }
.sidebar-route {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  color: var(--text);
  text-decoration: none;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar-route:hover { background: rgba(0,0,0,0.04); }
.method-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.method-dot-get { background: var(--method-get); }
.method-dot-post { background: var(--method-post); }
.method-dot-put { background: var(--method-put); }
.method-dot-delete { background: var(--method-delete); }
.method-dot-patch { background: var(--method-patch); }
.method-dot-head { background: var(--method-head); }
.method-dot-options { background: var(--method-options); }

/* \u2500\u2500 Main \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.main-content { flex: 1; padding: 2rem 2.5rem; max-width: 1000px; }
.main-header { margin-bottom: 2rem; }
.main-header h1 { font-size: 1.75rem; font-weight: 700; }
.api-description { color: #64748b; margin-top: 0.5rem; font-size: 0.95rem; }
.servers-info { margin-top: 0.75rem; font-size: 0.85rem; color: #64748b; }
.servers-info code { background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.8rem; }
.version-badge {
  background: var(--primary);
  color: #fff;
  padding: 0.15rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  vertical-align: middle;
}

/* \u2500\u2500 Tag section \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.tag-section { margin-bottom: 2rem; }
.tag-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 2px solid var(--border);
  cursor: pointer;
  user-select: none;
}
.tag-header h2 { font-size: 1.2rem; font-weight: 700; }
.tag-desc { color: #64748b; font-size: 0.9rem; }
.expand-icon { margin-left: auto; color: #94a3b8; font-size: 0.9rem; transition: transform 0.2s; }
.expanded .expand-icon { transform: rotate(180deg); }

/* \u2500\u2500 Route card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.route-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  margin: 0.75rem 0;
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.route-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

.route-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  user-select: none;
}

.method-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #fff;
  min-width: 60px;
  text-align: center;
  flex-shrink: 0;
}
.method-badge-get { background: var(--method-get); }
.method-badge-post { background: var(--method-post); }
.method-badge-put { background: var(--method-put); }
.method-badge-delete { background: var(--method-delete); }
.method-badge-patch { background: var(--method-patch); }
.method-badge-head { background: var(--method-head); }
.method-badge-options { background: var(--method-options); }

.route-path { font-family: "SF Mono", "Cascadia Code", "Fira Code", monospace; font-size: 0.9rem; font-weight: 600; }
.route-summary { color: #64748b; font-size: 0.85rem; margin-left: 0.5rem; }
.deprecated-badge {
  background: #fef2f2;
  color: #dc2626;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
}

/* Route body (expandable) */
.route-body {
  display: none;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
  background: #fafbfc;
}
.route-body.open { display: block; }

.route-description { color: #475569; margin-bottom: 1rem; font-size: 0.9rem; }

/* \u2500\u2500 Method-specific border accent \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.method-get { border-left: 3px solid var(--method-get); }
.method-post { border-left: 3px solid var(--method-post); }
.method-put { border-left: 3px solid var(--method-put); }
.method-delete { border-left: 3px solid var(--method-delete); }
.method-patch { border-left: 3px solid var(--method-patch); }
.method-head { border-left: 3px solid var(--method-head); }
.method-options { border-left: 3px solid var(--method-options); }

/* \u2500\u2500 Tables \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.params-table, .schema-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  margin: 0.5rem 0 1rem;
}
.params-table th, .schema-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  background: #f1f5f9;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 0.8rem;
  color: #475569;
}
.params-table td, .schema-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
}

.param-in {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}
.param-in-path { background: #dbeafe; color: #1d4ed8; }
.param-in-query { background: #dcfce7; color: #16a34a; }
.param-in-header { background: #fef3c7; color: #d97706; }
.param-in-cookie { background: #f3e8ff; color: #9333ea; }

.required-badge {
  display: inline-block;
  background: #fee2e2;
  color: #dc2626;
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
  margin-left: 0.3rem;
  vertical-align: middle;
}

.schema-type {
  font-family: "SF Mono", "Cascadia Code", "Fira Code", monospace;
  font-size: 0.8rem;
  color: var(--primary);
}

.section-desc { color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem; }
.content-type { font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem; }

/* \u2500\u2500 Schema tabs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.schema-tabs { display: flex; gap: 0; margin: 0.75rem 0 0; border-bottom: 1px solid var(--border); }
.schema-tab {
  padding: 0.4rem 1rem;
  border: none;
  background: none;
  font-size: 0.8rem;
  font-weight: 600;
  color: #94a3b8;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.schema-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
.schema-tab:hover { color: var(--text); }

.schema-panel { display: none; padding: 0.75rem 0; }
.schema-panel.active { display: block; }

.example-json {
  background: #1e293b;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  overflow-x: auto;
  line-height: 1.5;
}

/* \u2500\u2500 Responses \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.responses-section { margin-top: 1rem; }
.responses-section h4 { font-size: 0.95rem; margin-bottom: 0.5rem; }
.response-item { margin: 0.5rem 0; padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; }
.response-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem; }
.status-code {
  font-weight: 700;
  font-family: "SF Mono", "Cascadia Code", "Fira Code", monospace;
  font-size: 0.85rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}
.status-success { background: #dcfce7; color: #16a34a; }
.status-redirect { background: #dbeafe; color: #2563eb; }
.status-client-error { background: #fef3c7; color: #d97706; }
.status-server-error { background: #fee2e2; color: #dc2626; }
.response-desc { font-size: 0.85rem; color: #475569; }

/* \u2500\u2500 Try It Out \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.try-it-out-section { margin-top: 1.25rem; border-top: 1px solid var(--border); padding-top: 1rem; }
.try-it-btn {
  padding: 0.4rem 1rem;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.try-it-btn:hover { opacity: 0.9; }

.try-it-panel { display: none; margin-top: 1rem; }
.try-it-panel.open { display: block; }

.try-field { margin-bottom: 0.75rem; }
.try-field label { display: block; font-size: 0.8rem; font-weight: 600; color: #475569; margin-bottom: 0.25rem; }
.try-input, .try-body {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: "SF Mono", "Cascadia Code", "Fira Code", monospace;
  font-size: 0.8rem;
  outline: none;
  transition: border-color 0.2s;
}
.try-input:focus, .try-body:focus { border-color: var(--primary); }
.try-body { resize: vertical; min-height: 100px; }

.try-field select, .try-content-type {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.8rem;
  outline: none;
  background: #fff;
}

.body-content-type-row { margin-bottom: 0.5rem; }
.content-type-label {
  font-size: 0.7rem;
  font-weight: 500;
  color: #94a3b8;
  margin-left: 0.4rem;
}

/* \u2500\u2500 Body hint panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.body-hint {
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.82rem;
}
.body-hint-desc { color: #64748b; margin-bottom: 0.4rem; }
.body-hint-none { color: #94a3b8; font-style: italic; margin: 0; }
.body-hint-title {
  font-weight: 600;
  font-size: 0.8rem;
  color: #475569;
  margin-bottom: 0.4rem;
}
.body-hint-title code {
  background: #e2e8f0;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-size: 0.78rem;
}
.body-hint-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}
.body-hint-table th {
  text-align: left;
  padding: 0.3rem 0.5rem;
  background: #f1f5f9;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.body-hint-table td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
  color: #334155;
}
.body-hint-table code {
  background: #e2e8f0;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  font-size: 0.78rem;
}
.optional-badge {
  display: inline-block;
  background: #f0fdf4;
  color: #16a34a;
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
}
.hint-default, .hint-example {
  font-size: 0.75rem;
  color: #94a3b8;
}
.hint-default code, .hint-example code {
  background: #e2e8f0;
  color: #475569;
}

/* \u2500\u2500 Dynamic params (add query / header) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.dynamic-params-section { margin-bottom: 0.75rem; }
.dynamic-params-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}
.dynamic-params-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
}
.add-param-btn {
  padding: 0.2rem 0.6rem;
  background: transparent;
  border: 1px solid var(--primary);
  color: var(--primary);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.add-param-btn:hover { background: var(--primary); color: #fff; }

.dynamic-param-row {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.35rem;
  align-items: center;
}
.dynamic-param-row input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: "SF Mono", "Cascadia Code", "Fira Code", monospace;
  font-size: 0.8rem;
  outline: none;
}
.dynamic-param-row input:focus { border-color: var(--primary); }
.remove-param-btn {
  padding: 0.25rem 0.5rem;
  background: #fee2e2;
  color: #dc2626;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  flex-shrink: 0;
}
.remove-param-btn:hover { background: #fecaca; }

.execute-btn {
  padding: 0.5rem 1.5rem;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.execute-btn:hover { opacity: 0.9; }
.execute-btn:active { transform: scale(0.98); }

.try-response { margin-top: 1rem; }
.response-status-line, .response-time-line { font-size: 0.85rem; margin-bottom: 0.25rem; }
.response-status { font-weight: 700; font-family: monospace; }
.response-headers, .response-body {
  background: #1e293b;
  color: #e2e8f0;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0.25rem 0 0.75rem;
}

/* \u2500\u2500 Responsive \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

@media (max-width: 768px) {
  .layout { flex-direction: column; }
  .sidebar { width: 100%; min-width: 100%; height: auto; position: relative; border-right: none; border-bottom: 1px solid var(--border); }
  .main-content { padding: 1rem; }
}
</style>`;
}
function generateScript(routeDataJson, serversJson) {
  return `<script>
// Route data for "Try It Out"
const ROUTES = ${routeDataJson};
const SERVERS = ${serversJson};

// Populate server selects
document.addEventListener("DOMContentLoaded", function() {
  var selects = document.querySelectorAll(".try-server");
  for (var i = 0; i < selects.length; i++) {
    for (var j = 0; j < SERVERS.length; j++) {
      var opt = document.createElement("option");
      opt.value = SERVERS[j].url;
      opt.text = SERVERS[j].url + (SERVERS[j].description ? " (" + SERVERS[j].description + ")" : "");
      selects[i].appendChild(opt);
    }
  }
});

function toggleRoute(id) {
  var body = document.getElementById(id + "-body");
  if (body) body.classList.toggle("open");
  var card = document.getElementById(id);
  if (card) card.classList.toggle("expanded");
}

function toggleTryIt(id) {
  var panel = document.getElementById(id);
  if (panel) panel.classList.toggle("open");
}

function toggleSidebarTag(tagId) {
  var el = document.getElementById("sidebar-" + tagId);
  if (el) el.style.display = el.style.display === "none" ? "block" : (el.style.display === "block" ? "none" : "block");
}

function toggleTagSection(tagId) {
  var body = document.getElementById(tagId + "-body");
  var section = document.getElementById(tagId);
  if (body) body.style.display = body.style.display === "none" ? "block" : "none";
  if (section) section.classList.toggle("expanded");
}

// Schema / Example tabs
document.addEventListener("click", function(e) {
  if (!e.target.classList.contains("schema-tab")) return;
  var parent = e.target.parentElement;
  var target = e.target.getAttribute("data-target");
  var tabs = parent.querySelectorAll(".schema-tab");
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove("active");
  e.target.classList.add("active");

  // Find sibling panels
  var container = parent.parentElement;
  var panels = container.querySelectorAll(".schema-panel");
  for (var i = 0; i < panels.length; i++) {
    panels[i].classList.remove("active");
    if (panels[i].classList.contains("schema-panel-" + target)) {
      panels[i].classList.add("active");
    }
  }
});

// Search / filter
function filterRoutes() {
  var query = document.getElementById("search-input").value.toLowerCase();
  var cards = document.querySelectorAll(".route-card");
  for (var i = 0; i < cards.length; i++) {
    var header = cards[i].querySelector(".route-header");
    var text = header ? header.textContent.toLowerCase() : "";
    cards[i].style.display = text.includes(query) ? "" : "none";
  }
  // Also filter sidebar
  var sidebarRoutes = document.querySelectorAll(".sidebar-route");
  for (var i = 0; i < sidebarRoutes.length; i++) {
    var text = sidebarRoutes[i].textContent.toLowerCase();
    sidebarRoutes[i].style.display = text.includes(query) ? "" : "none";
  }
}

// \u2500\u2500 Dynamic parameter rows (add/remove query params and headers) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function addDynamicParam(tryId, paramType) {
  var container = document.getElementById(tryId + "-dynamic-" + paramType);
  if (!container) return;
  var row = document.createElement("div");
  row.className = "dynamic-param-row";
  row.innerHTML =
    '<input type="text" placeholder="Name" class="dynamic-key" />' +
    '<input type="text" placeholder="Value" class="dynamic-value" />' +
    '<button type="button" class="remove-param-btn" onclick="this.parentElement.remove()">x</button>';
  container.appendChild(row);
}

// \u2500\u2500 Execute request ("Try It Out") \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function executeRequest(index) {
  var route = ROUTES[index];
  var tryId = "try-" + index;
  var panel = document.getElementById(tryId);
  var serverSelect = document.getElementById(tryId + "-server");
  var baseUrl = serverSelect.value || window.location.origin;

  // 1. Build path \u2014 replace path params from inputs
  var path = route.path;
  var pathInputs = panel.querySelectorAll("input[data-in='path']");
  for (var i = 0; i < pathInputs.length; i++) {
    var name = pathInputs[i].getAttribute("data-param");
    var val = pathInputs[i].value || (":" + name);
    path = path.replace(":" + name, encodeURIComponent(val));
    path = path.replace("{" + name + "}", encodeURIComponent(val));
  }

  // 2. Build query string \u2014 declared + dynamic query params
  var queryParts = [];
  // Declared query params (static inputs)
  var declaredQueryInputs = panel.querySelectorAll("input[data-in='query']");
  for (var i = 0; i < declaredQueryInputs.length; i++) {
    var name = declaredQueryInputs[i].getAttribute("data-param");
    var val = declaredQueryInputs[i].value;
    if (val) queryParts.push(encodeURIComponent(name) + "=" + encodeURIComponent(val));
  }
  // Dynamic query params
  var dynamicQueryContainer = document.getElementById(tryId + "-dynamic-query");
  if (dynamicQueryContainer) {
    var rows = dynamicQueryContainer.querySelectorAll(".dynamic-param-row");
    for (var i = 0; i < rows.length; i++) {
      var key = rows[i].querySelector(".dynamic-key").value;
      var val = rows[i].querySelector(".dynamic-value").value;
      if (key) queryParts.push(encodeURIComponent(key) + "=" + encodeURIComponent(val));
    }
  }
  if (queryParts.length) path += "?" + queryParts.join("&");

  var url = baseUrl.replace(/\\/$/, "") + path;

  // 3. Build headers \u2014 declared + dynamic headers
  var headers = {};
  var declaredHeaderInputs = panel.querySelectorAll("input[data-in='header']");
  for (var i = 0; i < declaredHeaderInputs.length; i++) {
    var name = declaredHeaderInputs[i].getAttribute("data-param");
    var val = declaredHeaderInputs[i].value;
    if (val) headers[name] = val;
  }
  var dynamicHeaderContainer = document.getElementById(tryId + "-dynamic-header");
  if (dynamicHeaderContainer) {
    var rows = dynamicHeaderContainer.querySelectorAll(".dynamic-param-row");
    for (var i = 0; i < rows.length; i++) {
      var key = rows[i].querySelector(".dynamic-key").value;
      var val = rows[i].querySelector(".dynamic-value").value;
      if (key) headers[key] = val;
    }
  }

  // 4. Build fetch options
  var opts = { method: route.method, headers: headers };
  if (route.hasBody && route.method !== "GET" && route.method !== "HEAD") {
    var contentTypeEl = document.getElementById(tryId + "-content-type");
    var contentType = contentTypeEl ? contentTypeEl.value : route.bodyContentType;
    var bodyEl = document.getElementById(tryId + "-body");

    if (bodyEl && bodyEl.value) {
      if (contentType === "multipart/form-data") {
        // Let the browser set the content-type with boundary
        try {
          var jsonBody = JSON.parse(bodyEl.value);
          var formData = new FormData();
          for (var key in jsonBody) {
            formData.append(key, String(jsonBody[key]));
          }
          opts.body = formData;
        } catch(e) {
          opts.body = bodyEl.value;
          headers["Content-Type"] = contentType;
        }
      } else if (contentType === "application/x-www-form-urlencoded") {
        try {
          var jsonBody = JSON.parse(bodyEl.value);
          var parts = [];
          for (var key in jsonBody) {
            parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(jsonBody[key])));
          }
          opts.body = parts.join("&");
          headers["Content-Type"] = contentType;
        } catch(e) {
          opts.body = bodyEl.value;
          headers["Content-Type"] = contentType;
        }
      } else {
        opts.body = bodyEl.value;
        headers["Content-Type"] = contentType;
      }
    }
  }

  // 5. Show response area
  var responseEl = document.getElementById(tryId + "-response");
  var statusEl = document.getElementById(tryId + "-status");
  var timeEl = document.getElementById(tryId + "-time");
  var headersEl = document.getElementById(tryId + "-resp-headers");
  var bodyRespEl = document.getElementById(tryId + "-resp-body");

  responseEl.style.display = "block";
  statusEl.textContent = "Loading...";
  statusEl.className = "response-status";
  timeEl.textContent = "";
  headersEl.textContent = "";
  bodyRespEl.textContent = "";

  var start = performance.now();
  try {
    var resp = await fetch(url, opts);
    var elapsed = Math.round(performance.now() - start);
    timeEl.textContent = elapsed + "ms";

    statusEl.textContent = resp.status + " " + resp.statusText;
    if (resp.status < 300) statusEl.style.color = "#16a34a";
    else if (resp.status < 400) statusEl.style.color = "#2563eb";
    else if (resp.status < 500) statusEl.style.color = "#d97706";
    else statusEl.style.color = "#dc2626";

    // Response headers
    var hdrLines = [];
    resp.headers.forEach(function(value, key) { hdrLines.push(key + ": " + value); });
    headersEl.textContent = hdrLines.join("\\n");

    // Response body
    var respContentType = resp.headers.get("content-type") || "";
    var bodyText = await resp.text();
    if (respContentType.includes("json")) {
      try { bodyRespEl.textContent = JSON.stringify(JSON.parse(bodyText), null, 2); }
      catch(e) { bodyRespEl.textContent = bodyText; }
    } else {
      bodyRespEl.textContent = bodyText;
    }
  } catch (err) {
    var elapsed = Math.round(performance.now() - start);
    timeEl.textContent = elapsed + "ms";
    statusEl.textContent = "Error";
    statusEl.style.color = "#dc2626";
    bodyRespEl.textContent = err.toString();
  }
}
</script>`;
}

// src/middleware.ts
function docs(app, config = {}) {
  const cfg = createConfig(config);
  const basePath = cfg.docsPath.replace(/\/+$/, "");
  return async (c, next) => {
    const reqPath = c.req.path;
    if (reqPath === `${basePath}/json`) {
      const routes = parseRoutes(app);
      const filtered = routes.filter((r) => !cfg.exclude.some((e) => {
        const methodMatch = !e.method || e.method.toUpperCase() === r.method;
        const pathMatch = !e.path || e.path === r.path;
        return methodMatch && pathMatch;
      }));
      return c.json({
        title: cfg.title,
        description: cfg.description,
        version: cfg.version,
        servers: cfg.servers,
        tags: cfg.tags,
        routes: filtered.map((r) => ({
          method: r.method,
          path: r.path,
          handler: r.handleName ?? null,
          ...r.metadata
        }))
      });
    }
    if (reqPath === basePath || reqPath === `${basePath}/`) {
      const routes = parseRoutes(app);
      const html = generateDocHtml(routes, config);
      return c.html(html);
    }
    await next();
  };
}
export {
  registerRoute,
  parseRoutes,
  getRouteMetadata,
  getRegistry,
  generateDocHtml,
  docs,
  describe,
  defaultConfig,
  createConfig,
  clearRegistry
};
