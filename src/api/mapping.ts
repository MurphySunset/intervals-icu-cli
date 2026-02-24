export interface PathInfo {
  namespace: string;
  resources: string[];
  params: string[];
  pathTemplate: string;
}

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

export function detectAction(method: string, params: string[]): string {
  const normalizedMethod = method.toUpperCase();
  
  switch (normalizedMethod) {
    case "GET":
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
