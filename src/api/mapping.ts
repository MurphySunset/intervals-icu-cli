import { Command } from "commander";
import * as fs from "fs";
import { ApiClient } from "./client";

export interface PathInfo {
  namespace: string;
  resources: string[];
  params: string[];
  pathTemplate: string;
}

export interface OpenAPIParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  schema?: { type?: string; format?: string };
  description?: string;
}

export interface OpenAPIOperation {
  parameters?: OpenAPIParameter[];
  requestBody?: { required?: boolean };
  summary?: string;
  description?: string;
}

export interface RegisteredCommand {
  command: Command;
  pathInfo: PathInfo;
  method: string;
  operation: OpenAPIOperation;
}

export interface OpenAPISpec {
  openapi: string;
  paths: Record<string, Record<string, OpenAPIOperation>>;
}

export type SchemaIndex = Record<string, string[]>;

const PARAM_PATTERN = /\{([^}]+)\}/g;

export function parsePath(path: string): PathInfo {
  const segments = path.replace(/^\/api\/v1\//, "").split("/");
  const params: string[] = [];
  const resources: string[] = [];
  
  let namespace = "";
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const standaloneMatch = segment.match(/^\{(.+)\}$/);
    
    if (standaloneMatch) {
      params.push(standaloneMatch[1]);
    } else if (i === 0) {
      const embeddedParams = segment.match(PARAM_PATTERN);
      if (embeddedParams) {
        for (const p of embeddedParams) {
          params.push(p.slice(1, -1));
        }
      }
      namespace = segment;
    } else {
      const embeddedParams = segment.match(PARAM_PATTERN);
      if (embeddedParams) {
        for (const p of embeddedParams) {
          params.push(p.slice(1, -1));
        }
      }
      resources.push(segment);
    }
  }
  
  return {
    namespace,
    resources,
    params,
    pathTemplate: path,
  };
}

export function detectAction(method: string, params: string[], resources?: string[]): string {
  const normalizedMethod = method.toUpperCase();
  
  switch (normalizedMethod) {
    case "GET":
      if (resources && resources.length > 0 && params.length > resources.length) {
        return "get";
      }
      if (resources && resources.length > 0) {
        return "list";
      }
      return params.length > 0 ? "get" : "list";
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "update";
    case "DELETE":
      return "delete";
    default:
      return normalizedMethod.toLowerCase();
  }
}

export function buildPath(template: string, args: Record<string, string>): string {
  return template.replace(PARAM_PATTERN, (match, paramName) => {
    if (!(paramName in args)) {
      throw new Error(`Missing required path parameter: ${paramName}`);
    }
    return args[paramName];
  });
}

function getNestedValue(obj: any, path: string): any {
  const parts = path.split(".");
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index)) {
        return current.map((item) => getNestedValue(item, path));
      }
      current = current[index];
    } else {
      current = current[part];
    }
  }
  
  return current;
}

function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split(".");
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const nextIsIndex = !isNaN(parseInt(nextPart, 10));
    
    if (!(part in current)) {
      current[part] = nextIsIndex ? [] : {};
    }
    current = current[part];
  }
  
  current[parts[parts.length - 1]] = value;
}

export function pickFields(obj: any, fields: string[]): any {
  if (!fields || fields.length === 0) {
    return obj;
  }
  
  const result: any = {};
  
  for (const field of fields) {
    const trimmedField = field.trim();
    const value = getNestedValue(obj, trimmedField);
    if (value !== undefined) {
      setNestedValue(result, trimmedField, value);
    }
  }
  
  return result;
}

export function extractQueryParams(options: any, operation: OpenAPIOperation): Record<string, any> {
  const queryParams = operation.parameters?.filter(p => p.in === "query") || [];
  const result: Record<string, any> = {};

  for (const param of queryParams) {
    const flagName = param.name.replace(/_/g, "-");
    if (options[flagName] !== undefined) {
      result[param.name] = options[flagName];
    }
  }

  return result;
}

export function processOutput(data: any, options: any, action: string): any {
  if (options.format === "count") {
    return { count: Array.isArray(data) ? data.length : 1 };
  }

  if (options.format === "ids") {
    if (Array.isArray(data)) {
      return data.map(item => item.id);
    }
    return data?.id !== undefined ? [data.id] : [];
  }

  if ((action === "update" || action === "delete") && !options.full) {
    if (data?.id !== undefined) {
      return { id: data.id };
    }
    return {};
  }

  if (options.fields && !options.full) {
    const fields = options.fields.split(",").map((f: string) => f.trim());
    return pickFields(data, fields);
  }

  return data;
}

export function readPayloadFile(filePath: string, fileSystem: typeof fs = fs): any {
  try {
    const content = fileSystem.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error: Failed to read or parse file: ${filePath}`);
    process.exit(1);
  }
}

export function createActionHandler(
  pathInfo: PathInfo,
  method: string,
  operation: OpenAPIOperation,
  getConfig: () => { apiKey: string; baseUrl: string; timeout: number }
): (...args: any[]) => Promise<void> {
  const action = detectAction(method, pathInfo.params, pathInfo.resources);

  return async (...args: any[]) => {
    const options = args[args.length - 1];
    const positionalArgs = args.slice(0, -1);

    const pathParams = operation.parameters?.filter(p => p.in === "path") || [];
    const pathArgs: Record<string, string> = {};
    for (let i = 0; i < pathParams.length; i++) {
      pathArgs[pathParams[i].name] = positionalArgs[i];
    }
    const apiPath = buildPath(pathInfo.pathTemplate, pathArgs);

    const queryParams = extractQueryParams(options, operation);

    let body: any = undefined;
    if (options.file) {
      body = readPayloadFile(options.file);
    }

    const config = getConfig();
    const client = new ApiClient(config, {
      dryRun: options.dryRun,
      force: options.force,
    });

    const requestData = method.toUpperCase() === "GET" ? queryParams : body;
    const response = await client.request(method, apiPath, requestData);

    if (!response.success) {
      console.error(JSON.stringify(response.error, null, 2));
      process.exit(1);
    }

    const output = processOutput(response.data, options, action);
    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  };
}

export function getCommandPath(pathInfo: PathInfo, action: string): string[] {
  return [pathInfo.namespace, ...pathInfo.resources, action];
}

function getOrCreateCommand(
  program: Command,
  cmdPath: string[],
  cache: Map<string, Command>
): Command {
  if (cmdPath.length === 0) {
    return program;
  }
  
  const [current, ...rest] = cmdPath;
  const currentCacheKey = cmdPath.slice(0, 1).join(":");
  
  let currentCmd: Command;
  if (cache.has(currentCacheKey)) {
    currentCmd = cache.get(currentCacheKey)!;
  } else {
    if (rest.length === 0) {
      currentCmd = program.command(current);
    } else {
      const description = current.toUpperCase();
      currentCmd = program.command(current).description(description);
    }
    cache.set(currentCacheKey, currentCmd);
  }
  
  return getOrCreateCommand(currentCmd, rest, cache);
}

function registerCommand(
  program: Command,
  pathInfo: PathInfo,
  method: string,
  operation: OpenAPIOperation,
  cache: Map<string, Command>,
  getConfig: () => { apiKey: string; baseUrl: string; timeout: number }
): Command {
  const action = detectAction(method, pathInfo.params, pathInfo.resources);
  const cmdPath = getCommandPath(pathInfo, action);
  const command = getOrCreateCommand(program, cmdPath, cache);
  
  const description = operation.summary || `${action} ${pathInfo.resources[pathInfo.resources.length - 1] || pathInfo.namespace}`;
  command.description(description);
  command.allowUnknownOption();
  
  const pathParams = operation.parameters?.filter(p => p.in === "path") || [];
  for (const param of pathParams) {
    const argName = param.name;
    const argDesc = param.description || `${param.name} parameter`;
    command.argument(`<${argName}>`, argDesc);
  }
  
  const queryParams = operation.parameters?.filter(p => p.in === "query") || [];
  for (const param of queryParams) {
    const flagName = param.name.replace(/_/g, "-");
    const flagDesc = param.description || `${param.name} query parameter`;
    const required = param.required || false;
    
    if (required) {
      command.requiredOption(`--${flagName} <value>`, flagDesc);
    } else {
      command.option(`--${flagName} [value]`, flagDesc);
    }
  }
  
  if (["create", "update", "delete"].includes(action)) {
    command.option("--file <path>", "Read JSON payload from file");
  }
  
  if (["update", "delete"].includes(action)) {
    command.option("--full", "Return full response instead of minimal output");
  }
  
  command.option("--fields <fields>", "Limit output to specific fields (comma separated)");
  command.option("--format <format>", "Output format (json, ids, count)", "json");

  command.action(createActionHandler(pathInfo, method, operation, getConfig));

  return command;
}

export function mapRoutesToCommands(
  program: Command,
  schemaIndex: SchemaIndex,
  spec: OpenAPISpec,
  getConfig: () => { apiKey: string; baseUrl: string; timeout: number }
): RegisteredCommand[] {
  const registered: RegisteredCommand[] = [];
  const commandCache = new Map<string, Command>();

  for (const [path, methods] of Object.entries(schemaIndex)) {
    const methodsList: string[] = methods;
    const pathItem = spec.paths[path];
    if (!pathItem) continue;

    const pathInfo = parsePath(path);

    for (const method of methodsList) {
      const operation = pathItem[method.toLowerCase()];
      if (!operation) continue;

      const action = detectAction(method, pathInfo.params, pathInfo.resources);

      const cmdPath = getCommandPath(pathInfo, action);
      const cacheKey = `${path}:${method}`;
      if (commandCache.has(cacheKey)) continue;

      const command = registerCommand(program, pathInfo, method, operation, commandCache, getConfig);
      commandCache.set(cacheKey, command);

      registered.push({
        command,
        pathInfo,
        method,
        operation,
      });
    }
  }

  return registered;
}
