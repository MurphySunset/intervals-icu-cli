import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig, getAuthHeader, Config, FileSystem } from "../src/config";

const mockFs: FileSystem = {
  existsSync: () => false,
  readFileSync: () => "",
};

describe("loadConfig", () => {
  let originalEnv: any;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.INTERVALS_ICU_API_KEY;
    delete process.env.INTERVALS_ICU_BASE_URL;
    delete process.env.INTERVALS_ICU_TIMEOUT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads from environment variable", () => {
    const testFs: FileSystem = {
      ...mockFs,
      existsSync: () => false,
    };

    process.env.INTERVALS_ICU_API_KEY = "test-api-key";
    process.env.INTERVALS_ICU_BASE_URL = "https://test.icu";
    process.env.INTERVALS_ICU_TIMEOUT = "5000";

    const config = loadConfig(undefined, testFs);

    expect(config.apiKey).toBe("test-api-key");
    expect(config.baseUrl).toBe("https://test.icu");
    expect(config.timeout).toBe(5000);
  });

  it("loads from global config file", () => {
    const testFs: FileSystem = {
      existsSync: (path) => path.toString().includes("config.json"),
      readFileSync: () => JSON.stringify({ apiKey: "global-key", baseUrl: "https://global.icu" }),
    };

    const config = loadConfig(undefined, testFs);

    expect(config.apiKey).toBe("global-key");
    expect(config.baseUrl).toBe("https://global.icu");
    expect(config.timeout).toBe(30000);
  });

  it("loads from local .env file", () => {
    const testFs: FileSystem = {
      existsSync: (path) => path.toString().includes(".env"),
      readFileSync: (path) => {
        if (path.toString().includes(".env")) {
          return "INTERVALS_ICU_API_KEY=local-key\nINTERVALS_ICU_BASE_URL=https://local.icu\nINTERVALS_ICU_TIMEOUT=6000";
        }
        return "";
      },
    };

    const config = loadConfig(undefined, testFs);

    expect(config.apiKey).toBe("local-key");
    expect(config.baseUrl).toBe("https://local.icu");
    expect(config.timeout).toBe(6000);
  });

  it("priority: flag > env", () => {
    const testFs: FileSystem = {
      existsSync: () => true,
      readFileSync: (path) => {
        if (path.toString().includes("flag-config.json")) {
          return JSON.stringify({ apiKey: "flag-key", baseUrl: "https://flag.icu" });
        }
        return "";
      },
    };

    process.env.INTERVALS_ICU_API_KEY = "env-key";

    const config = loadConfig("flag-config.json", testFs);

    expect(config.apiKey).toBe("flag-key");
    expect(config.baseUrl).toBe("https://flag.icu");
  });

  it("priority: env > global", () => {
    const testFs: FileSystem = {
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ apiKey: "global-key", baseUrl: "https://global.icu" }),
    };

    process.env.INTERVALS_ICU_API_KEY = "env-key";

    const config = loadConfig(undefined, testFs);

    expect(config.apiKey).toBe("env-key");
  });

  it("priority: global > local", () => {
    const testFs: FileSystem = {
      existsSync: () => true,
      readFileSync: (path) => {
        if (path.toString().includes(".env")) {
          return "INTERVALS_ICU_API_KEY=local-key";
        }
        return JSON.stringify({ apiKey: "global-key" });
      },
    };

    const config = loadConfig(undefined, testFs);

    expect(config.apiKey).toBe("global-key");
  });

  it("priority: flag > env > global > local (full chain)", () => {
    const testFs: FileSystem = {
      existsSync: () => true,
      readFileSync: (path) => {
        if (path.toString().includes("flag-config.json")) {
          return JSON.stringify({ apiKey: "flag-key", baseUrl: "https://flag.icu", timeout: 4000 });
        }
        if (path.toString().includes("config.json")) {
          return JSON.stringify({ apiKey: "global-key", baseUrl: "https://global.icu", timeout: 5000 });
        }
        return "INTERVALS_ICU_API_KEY=local-key\nINTERVALS_ICU_BASE_URL=https://local.icu\nINTERVALS_ICU_TIMEOUT=6000";
      },
    };

    process.env.INTERVALS_ICU_API_KEY = "env-key";

    const config = loadConfig("flag-config.json", testFs);

    expect(config.apiKey).toBe("flag-key");
    expect(config.baseUrl).toBe("https://flag.icu");
    expect(config.timeout).toBe(4000);
  });

  it("WSL/Windows: checks both HOME and USERPROFILE paths", () => {
    let checkedPaths: string[] = [];
    const testFs: FileSystem = {
      existsSync: (path) => {
        const pathStr = path.toString();
        if (pathStr.includes(".config") && pathStr.includes("config.json")) {
          checkedPaths.push(pathStr);
        }
        return false;
      },
      readFileSync: () => "",
    };

    process.env.USERPROFILE = "/mnt/c/Users/test";
    process.env.HOME = "/home/test";
    process.env.INTERVALS_ICU_API_KEY = "test-key";

    loadConfig(undefined, testFs);

    expect(checkedPaths).toHaveLength(2);
    expect(checkedPaths.length).toBe(2);
  });

  it("exits with code 4 when apiKey is missing", () => {
    const testFs: FileSystem = {
      ...mockFs,
      existsSync: () => false,
    };

    const exitSpy = () => { throw new Error("EXIT_4"); };
    const originalExit = process.exit;
    process.exit = exitSpy as any;

    try {
      loadConfig(undefined, testFs);
      expect.fail("Should have exited");
    } catch (e: any) {
      expect(e.message).toBe("EXIT_4");
    } finally {
      process.exit = originalExit;
    }
  });

  it("exits with code 1 when flag config file not found", () => {
    const testFs: FileSystem = {
      ...mockFs,
      existsSync: () => false,
    };

    const exitSpy = () => { throw new Error("EXIT_1"); };
    const originalExit = process.exit;
    process.exit = exitSpy as any;

    try {
      loadConfig("nonexistent.json", testFs);
      expect.fail("Should have exited");
    } catch (e: any) {
      expect(e.message).toBe("EXIT_1");
    } finally {
      process.exit = originalExit;
    }
  });

  it("exits with code 1 when flag config file has invalid JSON", () => {
    const testFs: FileSystem = {
      existsSync: () => true,
      readFileSync: () => "{ invalid json }",
    };

    const exitSpy = () => { throw new Error("EXIT_1"); };
    const originalExit = process.exit;
    process.exit = exitSpy as any;

    try {
      loadConfig("bad-json.json", testFs);
      expect.fail("Should have exited");
    } catch (e: any) {
      expect(e.message).toBe("EXIT_1");
    } finally {
      process.exit = originalExit;
    }
  });

  it("silently ignores global config with invalid JSON", () => {
    const testFs: FileSystem = {
      existsSync: () => true,
      readFileSync: () => "{ bad json }",
    };

    process.env.INTERVALS_ICU_API_KEY = "env-key";

    const config = loadConfig(undefined, testFs);

    expect(config.apiKey).toBe("env-key");
  });

  it("trims whitespace from apiKey", () => {
    const testFs: FileSystem = {
      existsSync: () => false,
      readFileSync: () => "",
    };

    process.env.INTERVALS_ICU_API_KEY = "  spaced-key  ";

    const config = loadConfig(undefined, testFs);

    expect(config.apiKey).toBe("spaced-key");
  });

  it("removes trailing slash from baseUrl", () => {
    const testFs: FileSystem = {
      existsSync: () => false,
      readFileSync: () => "",
    };

    process.env.INTERVALS_ICU_API_KEY = "test-key";
    process.env.INTERVALS_ICU_BASE_URL = "https://test.icu/";

    const config = loadConfig(undefined, testFs);

    expect(config.baseUrl).toBe("https://test.icu");
  });

  it("uses default baseUrl and timeout when not provided", () => {
    const testFs: FileSystem = {
      existsSync: () => false,
      readFileSync: () => "",
    };

    process.env.INTERVALS_ICU_API_KEY = "test-key";

    const config = loadConfig(undefined, testFs);

    expect(config.baseUrl).toBe("https://intervals.icu");
    expect(config.timeout).toBe(30000);
  });
});

describe("getAuthHeader", () => {
  it("produces correct Basic auth header", () => {
    const config: Config = {
      apiKey: "test-api-key",
      baseUrl: "https://intervals.icu",
      timeout: 30000,
    };

    const header = getAuthHeader(config);
    
    expect(header).toMatch(/^Basic /);
    const base64Part = header.replace("Basic ", "");
    const decoded = Buffer.from(base64Part, "base64").toString("utf-8");
    expect(decoded).toBe("API_KEY:test-api-key");
  });

  it("handles empty apiKey", () => {
    const config: Config = {
      apiKey: "",
      baseUrl: "https://intervals.icu",
      timeout: 30000,
    };

    const header = getAuthHeader(config);
    
    const base64Part = header.replace("Basic ", "");
    const decoded = Buffer.from(base64Part, "base64").toString("utf-8");
    expect(decoded).toBe("API_KEY:");
  });
});
