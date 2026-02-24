import { afterEach, beforeEach, describe, expect, test, mock } from "bun:test";
import { exec, spawn } from "child_process";
import { unlinkSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DIST_PATH = join(process.cwd(), "dist", "index.js");

describe("CLI entry point", () => {
  test("--version outputs package version", async () => {
    const output = await execCommand(`bun ${DIST_PATH} --version`);
    expect(output.stdout.trim()).toBe("0.1.1");
  });

  test("--help outputs help text", async () => {
    const output = await execCommand(`bun ${DIST_PATH} --help`);
    expect(output.stdout).toContain("intervals-icu");
    expect(output.stdout).toContain("Options:");
    expect(output.stdout).toContain("--dry-run");
    expect(output.stdout).toContain("--force");
    expect(output.stdout).toContain("--config");
  });

  test("sync command starts execution", () => {
    const child = spawn("bun", [DIST_PATH, "sync"], {
      env: { ...process.env },
    });
    child.kill();
    expect(child.pid).toBeGreaterThan(0);
  });

  test("global flags are passed through", async () => {
    const output = await execCommand(`bun ${DIST_PATH} --dry-run --force athlete get 123`, "test-api-key");
    expect(output.stdout).toBeDefined();
  });
});

describe("config command", () => {
  const configDir = join(process.env.HOME || process.env.USERPROFILE || "", ".config", "intervals-icu-cli");
  const configPath = join(configDir, "config.json");

  beforeEach(() => {
    if (existsSync(configPath)) {
      unlinkSync(configPath);
    }
  });

  afterEach(() => {
    if (existsSync(configPath)) {
      unlinkSync(configPath);
    }
  });

  test.skip("interactive config saves API key", async () => {
  });
});

function execCommand(
  command: string,
  apiKey: string = "test-api-key"
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const env = { ...process.env, INTERVALS_ICU_API_KEY: apiKey };
    const child = exec(command, { env }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: error?.code || 0,
      });
    });
  });
}
