import { Command } from "commander";
import { readFileSync } from "fs";
import { mapRoutesToCommands } from "./api/mapping.js";
import { loadConfig } from "./config.js";
import { needsSync, loadSchemaIndex, saveSchema, saveSchemaIndex, saveSchemaMeta, loadFallbackSchema, generateIndex as generateSchemaIndex } from "./api/schema.js";
import { runConfigCommand } from "./commands/config.js";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
const SPEC_URL = "https://intervals.icu/api/v1/docs";

async function performSync(): Promise<void> {
  try {
    console.error("Fetching OpenAPI spec from intervals.icu...");
    const response = await fetch(SPEC_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch spec: ${response.status}`);
    }
    const spec = await response.json();
    
    console.error("Caching schema...");
    saveSchema(spec);
    saveSchemaIndex(generateSchemaIndex(spec));
    saveSchemaMeta("remote");
    console.error("Schema cached successfully.");
  } catch (error) {
    console.error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error("Using fallback schema...");
    const fallbackSpec = loadFallbackSchema();
    if (fallbackSpec) {
      saveSchema(fallbackSpec);
      saveSchemaIndex(generateSchemaIndex(fallbackSpec));
      saveSchemaMeta("fallback");
      console.error("Fallback schema cached.");
    } else {
      console.error("Error: No fallback schema available.");
      process.exit(1);
    }
  }
}

function shouldSkipSync(args: string[]): boolean {
  if (args.length === 0) return true;
  if (args[0] === "sync") return true;
  if (args[0] === "config") return true;
  if (args.includes("--help") || args.includes("-h")) return true;
  if (args.includes("--version") || args.includes("-V")) return true;
  return false;
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("intervals-icu")
    .version(packageJson.version)
    .option("-d, --dry-run", "Simulate requests without making changes")
    .option("-f, --force", "Enable write operations (create/update/delete)")
    .option("-c, --config <path>", "Config file path");

  program.command("sync")
    .description("Fetch latest OpenAPI spec from intervals.icu")
    .action(async () => {
      await performSync();
      process.exit(0);
    });

  program.command("config")
    .description("Interactive setup for intervals.icu API key")
    .action(runConfigCommand);

  const args = process.argv.slice(2);
  if (!shouldSkipSync(args) && needsSync()) {
    await performSync();
  }

  let schemaIndex = loadSchemaIndex();
  const spec = loadFallbackSchema();

  if (!spec) {
    console.error("Error: No schema available. Run 'intervals-icu sync' first.");
    process.exit(1);
  }

  if (Object.keys(schemaIndex).length === 0) {
    schemaIndex = generateSchemaIndex(spec);
  }

  const getConfig = () => loadConfig(program.opts().config);
  mapRoutesToCommands(program, schemaIndex, spec, getConfig);

  program.parse();
  process.exit(0);
}

main().catch((error) => {
  console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
