import * as readline from "readline";
import { join } from "path";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";

export async function runConfigCommand(): Promise<void> {
  const configDir = join(homedir(), ".config", "intervals-icu-cli");
  const configPath = join(configDir, "config.json");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const apiKey = await new Promise<string>((resolve) => {
    rl.question("Enter your intervals.icu API key: ", resolve);
  });

  rl.close();

  const trimmedKey = apiKey.trim();

  if (!trimmedKey) {
    console.error("Error: API key cannot be empty");
    process.exit(1);
  }

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify({ apiKey: trimmedKey }, null, 2));
  console.error(`Config saved to ${configPath}`);
  process.exit(0);
}
