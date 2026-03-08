import type { DocConfig } from "./types";

export const defaultConfig: DocConfig = {
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
    accentColor: "#6366f1",
  },
};

export function createConfig(config: DocConfig = {}): Required<DocConfig> {
  return {
    title: config.title ?? defaultConfig.title!,
    description: config.description ?? defaultConfig.description!,
    version: config.version ?? defaultConfig.version!,
    servers: config.servers ?? defaultConfig.servers!,
    tags: config.tags ?? defaultConfig.tags!,
    docsPath: config.docsPath ?? defaultConfig.docsPath!,
    exclude: config.exclude ?? defaultConfig.exclude!,
    theme: { ...defaultConfig.theme!, ...config.theme },
  };
}
