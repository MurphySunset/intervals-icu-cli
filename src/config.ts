import { join } from "path";
import { homedir } from "os";
import * as fs from "fs";
import * as dotenv from "dotenv";

function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || homedir();
}

const homeDir = getHomeDir();

export interface Config {
  apiKey: string;
  baseUrl: string;
  timeout: number;
}

export interface FileSystem {
  existsSync: (path: string | Buffer | URL) => boolean;
  readFileSync: (path: string | Buffer | URL | number, options?: any) => string | Buffer;
}

export function loadConfig(flagConfigPath?: string, fileSystem: FileSystem = fs): Config {
  let localEnv: any = {};
  const localEnvPath = join(process.cwd(), ".env");
  if (fileSystem.existsSync(localEnvPath)) {
    try {
      const content = fileSystem.readFileSync(localEnvPath);
      localEnv = dotenv.parse(content as Buffer);
    } catch (e) {
      
    }
  }

  let globalConfig: any = {};
  
  const possibleGlobalPaths = [
    join(homeDir, ".config", "intervals-icu-cli", "config.json"),
    join(process.env.USERPROFILE || homedir(), ".config", "intervals-icu-cli", "config.json"),
  ];
  
  for (const globalPath of possibleGlobalPaths) {
    if (fileSystem.existsSync(globalPath)) {
      try {
        globalConfig = JSON.parse(fileSystem.readFileSync(globalPath, "utf-8") as string);
        break;
      } catch (e) {
        
      }
    }
  }

  let flagConfig: any = {};
  if (flagConfigPath) {
    if (fileSystem.existsSync(flagConfigPath)) {
      try {
        flagConfig = JSON.parse(fileSystem.readFileSync(flagConfigPath, "utf-8") as string);
      } catch (e) {
        console.error(`Error: Failed to parse config file at ${flagConfigPath}`);
        process.exit(1);
      }
    } else {
      console.error(`Error: Config file not found at ${flagConfigPath}`);
      process.exit(1);
    }
  }

  const resolve = (envKey: string, jsonKey: string, defaultVal?: any) => {
    const envVal = process.env[envKey];
    const localVal = localEnv[envKey];

    if (flagConfig[jsonKey]) return flagConfig[jsonKey];

    const isFromLocalEnv = envVal !== undefined && localVal !== undefined && envVal === localVal;
    
    if (Object.prototype.hasOwnProperty.call(process.env, envKey) && !isFromLocalEnv) {
      return process.env[envKey];
    }

    if (globalConfig[jsonKey]) return globalConfig[jsonKey];

    if (localVal !== undefined) return localVal;

    return defaultVal;
  };

  const apiKey = resolve("INTERVALS_ICU_API_KEY", "apiKey");
  const baseUrl = resolve("INTERVALS_ICU_BASE_URL", "baseUrl", "https://intervals.icu");
  const timeout = resolve("INTERVALS_ICU_TIMEOUT", "timeout", 30000);

  if (!apiKey) {
    console.error(`Error: Missing required configuration: INTERVALS_ICU_API_KEY/apiKey`);
    console.error("Please use environment variables, a config file, or run 'intervals-icu config'.");
    process.exit(4);
  }

  return {
    apiKey: apiKey.replace(/\s+/g, ""),
    baseUrl: typeof baseUrl === 'string' ? baseUrl.replace(/\/$/, "") : baseUrl,
    timeout: typeof timeout === 'string' ? parseInt(timeout, 10) : timeout,
  };
}

export function getAuthHeader(config: Config): string {
  const credentials = Buffer.from(`API_KEY:${config.apiKey}`).toString("base64");
  return `Basic ${credentials}`;
}
