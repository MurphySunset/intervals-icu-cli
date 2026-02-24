import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { homedir } from "os";
import {
  getConfigPaths,
  getConfigDir,
  getSchemaMetaPath,
  getSchemaIndexPath,
  getSchemaPath,
  getSchemaMeta,
  isSchemaStale,
  schemaIndexExists,
  needsSync,
  saveSchemaMeta,
  loadSchemaIndex,
  saveSchemaIndex,
  saveSchema,
  generateIndex,
  loadFallbackSchema,
  setFileSystem,
  resetFileSystem,
  ensureConfigDir,
} from "../src/api/schema";
import type { OpenAPISpec, FileSystem, SchemaIndex } from "../src/api/schema";

function getExpectedConfigDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
  return join(homeDir, ".config", "intervals-icu-cli");
}

function createMockFs(files: Record<string, string> = {}): FileSystem {
  const storage = { ...files };
  return {
    existsSync: (path: string) => path in storage,
    readFileSync: (path: string, encoding?: string) => {
      if (!(path in storage)) throw new Error(`ENOENT: ${path}`);
      return storage[path];
    },
    writeFileSync: (path: string, data: string) => {
      storage[path] = data;
    },
    mkdirSync: (path: string, options?: { recursive: boolean }) => {
      storage[`${path}/.keep`] = "";
    },
  };
}

describe("getConfigPaths", () => {
  test("returns at least one path", () => {
    const paths = getConfigPaths();
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]).toContain(".config");
    expect(paths[0]).toContain("intervals-icu-cli");
  });

  test("includes USERPROFILE path on WSL/Windows when different from HOME", () => {
    const originalUserprofile = process.env.USERPROFILE;
    const originalHome = process.env.HOME;
    
    process.env.USERPROFILE = "/mnt/c/Users/test";
    process.env.HOME = "/home/testuser";
    
    const paths = getConfigPaths();
    expect(paths.length).toBe(2);
    expect(paths[0]).toContain("testuser");
    expect(paths[1]).toContain("test");
    
    process.env.USERPROFILE = originalUserprofile;
    process.env.HOME = originalHome;
  });
});

describe("getConfigDir", () => {
  test("returns first existing path", () => {
    const expectedDir = getExpectedConfigDir();
    const mockFs = createMockFs({
      [join(expectedDir, "schema.json")]: "{}",
    });
    setFileSystem(mockFs);
    
    const dir = getConfigDir();
    expect(dir).toBe(expectedDir);
    
    resetFileSystem();
  });

  test("returns first path if none exist", () => {
    const mockFs = createMockFs();
    setFileSystem(mockFs);
    
    const paths = getConfigPaths();
    const dir = getConfigDir();
    expect(dir).toBe(paths[0]);
    
    resetFileSystem();
  });
});

describe("ensureConfigDir", () => {
  test("creates directory if not exists", () => {
    const mockFs = createMockFs();
    setFileSystem(mockFs);
    
    const dir = ensureConfigDir();
    expect(mockFs.existsSync(dir) || mockFs.existsSync(`${dir}/.keep`)).toBe(true);
    
    resetFileSystem();
  });
});

describe("path getters", () => {
  test("getSchemaMetaPath includes schema-meta.json", () => {
    const path = getSchemaMetaPath();
    expect(path).toContain("schema-meta.json");
  });

  test("getSchemaIndexPath includes schema-index.json", () => {
    const path = getSchemaIndexPath();
    expect(path).toContain("schema-index.json");
  });

  test("getSchemaPath includes schema.json", () => {
    const path = getSchemaPath();
    expect(path).toContain("schema.json");
  });
});

describe("getSchemaMeta", () => {
  test("returns null if file does not exist", () => {
    const mockFs = createMockFs();
    setFileSystem(mockFs);
    
    const meta = getSchemaMeta();
    expect(meta).toBeNull();
    
    resetFileSystem();
  });

  test("returns parsed meta if file exists", () => {
    const expectedDir = getExpectedConfigDir();
    const mockFs = createMockFs({
      [join(expectedDir, "schema-meta.json")]: JSON.stringify({
        lastSynced: "2024-01-15T10:00:00.000Z",
        source: "remote",
      }),
    });
    setFileSystem(mockFs);
    
    const meta = getSchemaMeta();
    expect(meta).not.toBeNull();
    expect(meta?.lastSynced).toBe("2024-01-15T10:00:00.000Z");
    expect(meta?.source).toBe("remote");
    
    resetFileSystem();
  });

  test("returns null if JSON is invalid", () => {
    const expectedDir = getExpectedConfigDir();
    const mockFs = createMockFs({
      [join(expectedDir, "schema-meta.json")]: "not valid json",
    });
    setFileSystem(mockFs);
    
    const meta = getSchemaMeta();
    expect(meta).toBeNull();
    
    resetFileSystem();
  });
});

describe("isSchemaStale", () => {
  test("returns true if no meta exists", () => {
    const mockFs = createMockFs();
    setFileSystem(mockFs);
    
    expect(isSchemaStale()).toBe(true);
    
    resetFileSystem();
  });

  test("returns true if lastSynced is > 24h ago", () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const expectedDir = getExpectedConfigDir();
    const mockFs = createMockFs({
      [join(expectedDir, "schema-meta.json")]: JSON.stringify({
        lastSynced: oldDate,
        source: "remote",
      }),
    });
    setFileSystem(mockFs);
    
    expect(isSchemaStale()).toBe(true);
    
    resetFileSystem();
  });

  test("returns false if lastSynced is < 24h ago", () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const expectedDir = getExpectedConfigDir();
    const mockFs = createMockFs({
      [join(expectedDir, "schema-meta.json")]: JSON.stringify({
        lastSynced: recentDate,
        source: "remote",
      }),
    });
    setFileSystem(mockFs);
    
    expect(isSchemaStale()).toBe(false);
    
    resetFileSystem();
  });

  test("returns true if lastSynced is invalid date", () => {
    const expectedDir = getExpectedConfigDir();
    const mockFs = createMockFs({
      [join(expectedDir, "schema-meta.json")]: JSON.stringify({
        lastSynced: "invalid-date",
        source: "remote",
      }),
    });
    setFileSystem(mockFs);
    
    expect(isSchemaStale()).toBe(true);
    
    resetFileSystem();
  });
});

describe("schemaIndexExists", () => {
  test("returns false if file does not exist", () => {
    const mockFs = createMockFs();
    setFileSystem(mockFs);
    
    expect(schemaIndexExists()).toBe(false);
    
    resetFileSystem();
  });

  test("returns true if file exists", () => {
    const expectedDir = getExpectedConfigDir();
    const mockFs = createMockFs({
      [join(expectedDir, "schema-index.json")]: "{}",
    });
    setFileSystem(mockFs);
    
    expect(schemaIndexExists()).toBe(true);
    
    resetFileSystem();
  });
});

describe("needsSync", () => {
  test("returns true if index does not exist", () => {
    const mockFs = createMockFs();
    setFileSystem(mockFs);
    
    expect(needsSync()).toBe(true);
    
    resetFileSystem();
  });

  test("returns true if index exists but is stale", () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const expectedDir = getExpectedConfigDir();
    const mockFs = createMockFs({
      [join(expectedDir, "schema-index.json")]: "{}",
      [join(expectedDir, "schema-meta.json")]: JSON.stringify({
        lastSynced: oldDate,
        source: "remote",
      }),
    });
    setFileSystem(mockFs);
    
    expect(needsSync()).toBe(true);
    
    resetFileSystem();
  });

  test("returns false if index exists and is fresh", () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const expectedDir = getExpectedConfigDir();
    const mockFs = createMockFs({
      [join(expectedDir, "schema-index.json")]: "{}",
      [join(expectedDir, "schema-meta.json")]: JSON.stringify({
        lastSynced: recentDate,
        source: "remote",
      }),
    });
    setFileSystem(mockFs);
    
    expect(needsSync()).toBe(false);
    
    resetFileSystem();
  });
});

describe("saveSchemaMeta", () => {
  test("writes valid JSON with correct structure", () => {
    const storage: Record<string, string> = {};
    const mockFs: FileSystem = {
      existsSync: (path: string) => path in storage,
      readFileSync: (path: string) => storage[path],
      writeFileSync: (path: string, data: string) => {
        storage[path] = data;
      },
      mkdirSync: () => {},
    };
    setFileSystem(mockFs);
    
    saveSchemaMeta("remote");
    
    const metaPath = Object.keys(storage).find(p => p.includes("schema-meta.json"));
    expect(metaPath).toBeDefined();
    
    const meta = JSON.parse(storage[metaPath!]);
    expect(meta.source).toBe("remote");
    expect(meta.lastSynced).toBeDefined();
    expect(new Date(meta.lastSynced).getTime()).toBeLessThanOrEqual(Date.now());
    
    resetFileSystem();
  });
});

describe("loadSchemaIndex", () => {
  test("returns empty object if file does not exist", () => {
    const mockFs = createMockFs();
    setFileSystem(mockFs);
    
    const index = loadSchemaIndex();
    expect(index).toEqual({});
    
    resetFileSystem();
  });

  test("returns parsed index if file exists", () => {
    const mockIndex: SchemaIndex = {
      "/api/v1/athlete/{id}": ["GET"],
      "/api/v1/athlete/{id}/activities": ["GET"],
    };
    const expectedDir = getExpectedConfigDir();
    const mockFs = createMockFs({
      [join(expectedDir, "schema-index.json")]: JSON.stringify(mockIndex),
    });
    setFileSystem(mockFs);
    
    const index = loadSchemaIndex();
    expect(index).toEqual(mockIndex);
    
    resetFileSystem();
  });

  test("returns empty object if JSON is invalid", () => {
    const expectedDir = getExpectedConfigDir();
    const mockFs = createMockFs({
      [join(expectedDir, "schema-index.json")]: "invalid json",
    });
    setFileSystem(mockFs);
    
    const index = loadSchemaIndex();
    expect(index).toEqual({});
    
    resetFileSystem();
  });
});

describe("saveSchemaIndex", () => {
  test("writes valid JSON index", () => {
    const storage: Record<string, string> = {};
    const mockFs: FileSystem = {
      existsSync: (path: string) => path in storage,
      readFileSync: (path: string) => storage[path],
      writeFileSync: (path: string, data: string) => {
        storage[path] = data;
      },
      mkdirSync: () => {},
    };
    setFileSystem(mockFs);
    
    const index: SchemaIndex = {
      "/api/v1/athlete/{id}": ["GET", "PUT"],
    };
    saveSchemaIndex(index);
    
    const indexPath = Object.keys(storage).find(p => p.includes("schema-index.json"));
    expect(indexPath).toBeDefined();
    expect(JSON.parse(storage[indexPath!])).toEqual(index);
    
    resetFileSystem();
  });
});

describe("saveSchema", () => {
  test("writes valid JSON schema", () => {
    const storage: Record<string, string> = {};
    const mockFs: FileSystem = {
      existsSync: (path: string) => path in storage,
      readFileSync: (path: string) => storage[path],
      writeFileSync: (path: string, data: string) => {
        storage[path] = data;
      },
      mkdirSync: () => {},
    };
    setFileSystem(mockFs);
    
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}": {
          get: { responses: {} },
        },
      },
    };
    saveSchema(spec);
    
    const schemaPath = Object.keys(storage).find(p => p.includes("schema.json") && !p.includes("index") && !p.includes("meta"));
    expect(schemaPath).toBeDefined();
    expect(JSON.parse(storage[schemaPath!])).toEqual(spec);
    
    resetFileSystem();
  });
});

describe("generateIndex", () => {
  test("extracts methods from OpenAPI paths", () => {
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}": {
          get: { responses: {} },
          put: { responses: {} },
        },
        "/api/v1/athlete/{id}/activities": {
          get: { responses: {} },
          post: { responses: {} },
        },
      },
    };
    
    const index = generateIndex(spec);
    
    expect(index["/api/v1/athlete/{id}"]).toEqual(["GET", "PUT"]);
    expect(index["/api/v1/athlete/{id}/activities"]).toEqual(["GET", "POST"]);
  });

  test("handles all HTTP methods", () => {
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/test": {
          get: {},
          post: {},
          put: {},
          patch: {},
          delete: {},
        },
      },
    };
    
    const index = generateIndex(spec);
    
    expect(index["/api/v1/test"]).toEqual(["GET", "POST", "PUT", "PATCH", "DELETE"]);
  });

  test("returns empty object if no paths", () => {
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {},
    };
    
    const index = generateIndex(spec);
    expect(index).toEqual({});
  });

  test("returns empty object if paths is undefined", () => {
    const spec = {
      openapi: "3.0.1",
    } as OpenAPISpec;
    
    const index = generateIndex(spec);
    expect(index).toEqual({});
  });

  test("skips non-HTTP method keys (x-, parameters, etc.)", () => {
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/test": {
          get: {},
          parameters: [],
          "x-custom": {},
        },
      },
    };
    
    const index = generateIndex(spec);
    
    expect(index["/api/v1/test"]).toEqual(["GET"]);
  });
});

describe("loadFallbackSchema", () => {
  test("loads bundled default-schema.json", () => {
    resetFileSystem();
    
    const schema = loadFallbackSchema();
    
    expect(schema).not.toBeNull();
    expect(schema?.openapi).toBe("3.0.1");
    expect(schema?.paths).toBeDefined();
    expect(Object.keys(schema?.paths || {}).length).toBeGreaterThan(0);
  });

  test("returns null if fallback file missing", () => {
    const mockFs = createMockFs();
    setFileSystem(mockFs);
    
    const schema = loadFallbackSchema();
    expect(schema).toBeNull();
    
    resetFileSystem();
  });
});
