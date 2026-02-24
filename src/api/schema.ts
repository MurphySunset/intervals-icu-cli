import { join } from "path";
import { homedir } from "os";
import * as fs from "fs";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface SchemaMeta {
  lastSynced: string;
  source: "remote" | "fallback";
}

export type SchemaIndex = Record<string, string[]>;

export interface OpenAPISpec {
  openapi: string;
  paths: Record<string, Record<string, any>>;
}

export interface FileSystem {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding?: string) => string;
  writeFileSync: (path: string, data: string) => void;
  mkdirSync: (path: string, options?: { recursive: boolean }) => void;
}

let fileSystem: FileSystem = fs as unknown as FileSystem;

export function setFileSystem(fs: FileSystem): void {
  fileSystem = fs;
}

export function resetFileSystem(): void {
  fileSystem = fs as unknown as FileSystem;
}

export function getConfigPaths(): string[] {
  const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
  const userHome = process.env.USERPROFILE || homedir();
  
  const paths = [join(homeDir, ".config", "intervals-icu-cli")];
  
  if (userHome && userHome !== homeDir) {
    paths.push(join(userHome, ".config", "intervals-icu-cli"));
  }
  
  return paths;
}

export function getConfigDir(): string {
  const paths = getConfigPaths();
  for (const p of paths) {
    if (fileSystem.existsSync(p)) {
      return p;
    }
  }
  return paths[0];
}

export function ensureConfigDir(): string {
  const dir = getConfigDir();
  if (!fileSystem.existsSync(dir)) {
    fileSystem.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getSchemaMetaPath(): string {
  return join(getConfigDir(), "schema-meta.json");
}

export function getSchemaIndexPath(): string {
  return join(getConfigDir(), "schema-index.json");
}

export function getSchemaPath(): string {
  return join(getConfigDir(), "schema.json");
}

export function getSchemaMeta(): SchemaMeta | null {
  const path = getSchemaMetaPath();
  if (!fileSystem.existsSync(path)) {
    return null;
  }
  try {
    const content = fileSystem.readFileSync(path, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function isSchemaStale(): boolean {
  const meta = getSchemaMeta();
  if (!meta) return true;
  const lastSync = new Date(meta.lastSynced).getTime();
  if (isNaN(lastSync)) return true;
  return Date.now() - lastSync > CACHE_TTL_MS;
}

export function schemaIndexExists(): boolean {
  return fileSystem.existsSync(getSchemaIndexPath());
}

export function needsSync(): boolean {
  if (!schemaIndexExists()) return true;
  return isSchemaStale();
}

export function saveSchemaMeta(source: "remote" | "fallback"): void {
  ensureConfigDir();
  const meta: SchemaMeta = {
    lastSynced: new Date().toISOString(),
    source,
  };
  fileSystem.writeFileSync(getSchemaMetaPath(), JSON.stringify(meta, null, 2));
}

export function loadSchemaIndex(): SchemaIndex {
  const path = getSchemaIndexPath();
  if (!fileSystem.existsSync(path)) {
    return {};
  }
  try {
    const content = fileSystem.readFileSync(path, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function saveSchemaIndex(index: SchemaIndex): void {
  ensureConfigDir();
  fileSystem.writeFileSync(getSchemaIndexPath(), JSON.stringify(index, null, 2));
}

export function saveSchema(spec: OpenAPISpec): void {
  ensureConfigDir();
  fileSystem.writeFileSync(getSchemaPath(), JSON.stringify(spec, null, 2));
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

export function generateIndex(spec: OpenAPISpec): SchemaIndex {
  const index: SchemaIndex = {};
  
  if (!spec.paths) return index;
  
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const methods: string[] = [];
    for (const method of HTTP_METHODS) {
      if (pathItem[method]) {
        methods.push(method.toUpperCase());
      }
    }
    if (methods.length > 0) {
      index[path] = methods;
    }
  }
  
  return index;
}

export function loadFallbackSchema(): OpenAPISpec | null {
  const internalPath = join(__dirname, "..", "data", "default-schema.json");
  if (!fileSystem.existsSync(internalPath)) {
    return null;
  }
  try {
    const content = fileSystem.readFileSync(internalPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
