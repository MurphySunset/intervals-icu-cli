#!/usr/bin/env bun
import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join } from "path";

function copyRecursive(src: string, dest: string): void {
  const stat = statSync(src);
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    const files = readdirSync(src);
    for (const file of files) {
      copyRecursive(join(src, file), join(dest, file));
    }
  } else {
    copyFileSync(src, dest);
  }
}

const { execSync } = await import("child_process");

console.error("Building TypeScript...");
execSync("tsc", { stdio: "inherit" });

console.error("Copying data directory...");
mkdirSync("dist/data", { recursive: true });
copyRecursive("src/data", "dist/data");

console.error("Build complete.");
