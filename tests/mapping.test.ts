import { describe, test, expect, vi } from "bun:test";
import { Command } from "commander";
import {
  parsePath,
  detectAction,
  buildPath,
  pickFields,
  getCommandPath,
  mapRoutesToCommands,
  extractQueryParams,
  processOutput,
  readPayloadFile,
  createActionHandler,
} from "../src/api/mapping";
import type { SchemaIndex, OpenAPISpec, OpenAPIOperation } from "../src/api/mapping";

describe("parsePath", () => {
  test("parses single param root path", () => {
    const result = parsePath("/api/v1/athlete/{id}");
    expect(result.namespace).toBe("athlete");
    expect(result.resources).toEqual([]);
    expect(result.params).toEqual(["id"]);
    expect(result.pathTemplate).toBe("/api/v1/athlete/{id}");
  });

  test("parses nested resource with single param", () => {
    const result = parsePath("/api/v1/athlete/{id}/activities");
    expect(result.namespace).toBe("athlete");
    expect(result.resources).toEqual(["activities"]);
    expect(result.params).toEqual(["id"]);
  });

  test("parses multiple params", () => {
    const result = parsePath("/api/v1/athlete/{id}/workouts/{workoutId}");
    expect(result.namespace).toBe("athlete");
    expect(result.resources).toEqual(["workouts"]);
    expect(result.params).toEqual(["id", "workoutId"]);
  });

  test("parses path with no params", () => {
    const result = parsePath("/api/v1/athlete-plans");
    expect(result.namespace).toBe("athlete-plans");
    expect(result.resources).toEqual([]);
    expect(result.params).toEqual([]);
  });

  test("parses deeply nested path with multiple params", () => {
    const result = parsePath("/api/v1/athlete/{id}/gear/{gearId}/reminder/{reminderId}");
    expect(result.namespace).toBe("athlete");
    expect(result.resources).toEqual(["gear", "reminder"]);
    expect(result.params).toEqual(["id", "gearId", "reminderId"]);
  });

  test("extracts {ext} param from resource suffix", () => {
    const result = parsePath("/api/v1/activity/{id}/power-curve{ext}");
    expect(result.namespace).toBe("activity");
    expect(result.resources).toEqual(["power-curve{ext}"]);
    expect(result.params).toEqual(["id", "ext"]);
  });

  test("extracts multiple params from segment", () => {
    const result = parsePath("/api/v1/athlete/{id}/file.{ext}");
    expect(result.namespace).toBe("athlete");
    expect(result.resources).toEqual(["file.{ext}"]);
    expect(result.params).toEqual(["id", "ext"]);
  });

  test("parses path with format suffix as resource", () => {
    const result = parsePath("/api/v1/athlete/{id}/activities.csv");
    expect(result.namespace).toBe("athlete");
    expect(result.resources).toEqual(["activities.csv"]);
    expect(result.params).toEqual(["id"]);
  });

  test("parses path with format suffix as resource", () => {
    const result = parsePath("/api/v1/athlete/{id}/activities.csv");
    expect(result.namespace).toBe("athlete");
    expect(result.resources).toEqual(["activities.csv"]);
    expect(result.params).toEqual(["id"]);
  });

  test("parses activity intervals path", () => {
    const result = parsePath("/api/v1/activity/{id}/intervals/{intervalId}");
    expect(result.namespace).toBe("activity");
    expect(result.resources).toEqual(["intervals"]);
    expect(result.params).toEqual(["id", "intervalId"]);
  });

  test("parses chats send-message path", () => {
    const result = parsePath("/api/v1/chats/send-message");
    expect(result.namespace).toBe("chats");
    expect(result.resources).toEqual(["send-message"]);
    expect(result.params).toEqual([]);
  });

  test("parses wellness date path", () => {
    const result = parsePath("/api/v1/athlete/{id}/wellness/{date}");
    expect(result.namespace).toBe("athlete");
    expect(result.resources).toEqual(["wellness"]);
    expect(result.params).toEqual(["id", "date"]);
  });

  test("parses chats messages seen path", () => {
    const result = parsePath("/api/v1/chats/{id}/messages/{msgId}/seen");
    expect(result.namespace).toBe("chats");
    expect(result.resources).toEqual(["messages", "seen"]);
    expect(result.params).toEqual(["id", "msgId"]);
  });

  test("parses athleteId variant", () => {
    const result = parsePath("/api/v1/athlete/{athleteId}/activities/{ids}");
    expect(result.namespace).toBe("athlete");
    expect(result.resources).toEqual(["activities"]);
    expect(result.params).toEqual(["athleteId", "ids"]);
  });
});

describe("detectAction", () => {
  test("GET with params and no resources returns get", () => {
    expect(detectAction("GET", ["id"])).toBe("get");
  });

  test("GET with no params returns list", () => {
    expect(detectAction("GET", [])).toBe("list");
  });

  test("GET with params and resources returns list", () => {
    expect(detectAction("GET", ["id"], ["activities"])).toBe("list");
  });

  test("GET with params and resources returns get if more params than resources", () => {
    expect(detectAction("GET", ["id", "date"], ["wellness"])).toBe("get");
  });

  test("GET with params and multiple resources returns list", () => {
    expect(detectAction("GET", ["id"], ["gear", "reminder"])).toBe("list");
  });

  test("POST returns create", () => {
    expect(detectAction("POST", [])).toBe("create");
    expect(detectAction("POST", ["id"])).toBe("create");
  });

  test("PUT returns update", () => {
    expect(detectAction("PUT", ["id"])).toBe("update");
  });

  test("PATCH returns update", () => {
    expect(detectAction("PATCH", ["id"])).toBe("update");
  });

  test("DELETE returns delete", () => {
    expect(detectAction("DELETE", ["id"])).toBe("delete");
  });

  test("lowercase methods work", () => {
    expect(detectAction("get", ["id"])).toBe("get");
    expect(detectAction("post", [])).toBe("create");
  });

  test("unknown method returns lowercase", () => {
    expect(detectAction("HEAD", [])).toBe("head");
    expect(detectAction("OPTIONS", [])).toBe("options");
  });
});

describe("buildPath", () => {
  test("replaces single param", () => {
    const result = buildPath("/api/v1/athlete/{id}", { id: "123" });
    expect(result).toBe("/api/v1/athlete/123");
  });

  test("replaces multiple params", () => {
    const result = buildPath(
      "/api/v1/athlete/{id}/workouts/{workoutId}",
      { id: "123", workoutId: "456" }
    );
    expect(result).toBe("/api/v1/athlete/123/workouts/456");
  });

  test("throws on missing param", () => {
    expect(() => buildPath("/api/v1/athlete/{id}", {})).toThrow(
      "Missing required path parameter: id"
    );
  });

  test("ignores extra args", () => {
    const result = buildPath("/api/v1/athlete/{id}", { id: "123", extra: "ignored" });
    expect(result).toBe("/api/v1/athlete/123");
  });

  test("replaces {ext} param", () => {
    const result = buildPath("/api/v1/activity/{id}/power-curve{ext}", { id: "123", ext: ".json" });
    expect(result).toBe("/api/v1/activity/123/power-curve.json");
  });

  test("handles multiple missing params - throws on first", () => {
    expect(() =>
      buildPath("/api/v1/athlete/{id}/workouts/{workoutId}", { id: "123" })
    ).toThrow("Missing required path parameter: workoutId");
  });

  test("replaces three params", () => {
    const result = buildPath(
      "/api/v1/athlete/{id}/gear/{gearId}/reminder/{reminderId}",
      { id: "1", gearId: "2", reminderId: "3" }
    );
    expect(result).toBe("/api/v1/athlete/1/gear/2/reminder/3");
  });
});

describe("pickFields", () => {
  test("returns full object when fields empty", () => {
    const obj = { id: 1, name: "test" };
    expect(pickFields(obj, [])).toEqual(obj);
  });

  test("returns full object when fields undefined", () => {
    const obj = { id: 1, name: "test" };
    expect(pickFields(obj, undefined as any)).toEqual(obj);
  });

  test("picks top-level field", () => {
    const obj = { id: 1, name: "test", extra: "ignored" };
    expect(pickFields(obj, ["id"])).toEqual({ id: 1 });
  });

  test("picks multiple top-level fields", () => {
    const obj = { id: 1, name: "test", extra: "ignored" };
    expect(pickFields(obj, ["id", "name"])).toEqual({ id: 1, name: "test" });
  });

  test("picks nested field with dot notation", () => {
    const obj = { id: 1, athlete: { name: "John", age: 30 } };
    expect(pickFields(obj, ["athlete.name"])).toEqual({ athlete: { name: "John" } });
  });

  test("picks multiple nested fields", () => {
    const obj = { id: 1, athlete: { name: "John", age: 30 } };
    expect(pickFields(obj, ["id", "athlete.name"])).toEqual({ id: 1, athlete: { name: "John" } });
  });

  test("returns undefined for missing field", () => {
    const obj = { id: 1 };
    expect(pickFields(obj, ["missing"])).toEqual({});
  });

  test("handles deeply nested field", () => {
    const obj = { a: { b: { c: { d: "deep" } } } };
    expect(pickFields(obj, ["a.b.c.d"])).toEqual({ a: { b: { c: { d: "deep" } } } });
  });

  test("trims whitespace from field names", () => {
    const obj = { id: 1, name: "test" };
    expect(pickFields(obj, [" id ", " name "])).toEqual({ id: 1, name: "test" });
  });

  test("handles null in path gracefully", () => {
    const obj = { a: null };
    expect(pickFields(obj, ["a.b"])).toEqual({});
  });

  test("handles array field", () => {
    const obj = { items: [1, 2, 3], id: 1 };
    expect(pickFields(obj, ["items"])).toEqual({ items: [1, 2, 3] });
  });

  test("handles array index access", () => {
    const obj = { items: [{ id: 1 }, { id: 2 }] };
    expect(pickFields(obj, ["items.0"])).toEqual({ items: [{ id: 1 }] });
  });
});

describe("getCommandPath", () => {
  test("builds path for simple namespace with action", () => {
    const pathInfo = parsePath("/api/v1/athlete/{id}");
    const action = "get";
    const result = getCommandPath(pathInfo, action);
    expect(result).toEqual(["athlete", "get"]);
  });

  test("builds path with nested resource", () => {
    const pathInfo = parsePath("/api/v1/athlete/{id}/activities");
    const action = "list";
    const result = getCommandPath(pathInfo, action);
    expect(result).toEqual(["athlete", "activities", "list"]);
  });

  test("builds path with deeply nested resource", () => {
    const pathInfo = parsePath("/api/v1/athlete/{id}/workouts/{workoutId}");
    const action = "get";
    const result = getCommandPath(pathInfo, action);
    expect(result).toEqual(["athlete", "workouts", "get"]);
  });

  test("builds path with multiple nested resources", () => {
    const pathInfo = parsePath("/api/v1/athlete/{id}/gear/{gearId}/reminder/{reminderId}");
    const action = "get";
    const result = getCommandPath(pathInfo, action);
    expect(result).toEqual(["athlete", "gear", "reminder", "get"]);
  });
});

describe("mapRoutesToCommands", () => {
  test("creates namespace command for simple path", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}": ["GET"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}": {
          get: {
            summary: "Get athlete",
            parameters: [{ name: "id", in: "path", required: true }],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    const registered = mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    expect(registered).toHaveLength(1);
    expect(registered[0].method).toBe("GET");
    expect(registered[0].pathInfo.namespace).toBe("athlete");
  });

  test("creates nested resource commands", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}/activities": ["GET"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}/activities": {
          get: {
            summary: "List activities",
            parameters: [
              { name: "id", in: "path", required: true },
              { name: "oldest", in: "query", required: true },
              { name: "newest", in: "query", required: false },
            ],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    const registered = mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    expect(registered).toHaveLength(1);
    expect(registered[0].pathInfo.resources).toEqual(["activities"]);
  });

  test("registers positional args from path params", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}": ["GET"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}": {
          get: {
            summary: "Get athlete",
            parameters: [{ name: "id", in: "path", required: true }],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    const athleteCmd = program.commands.find((c: any) => c.name() === "athlete");
    const getCmd = athleteCmd?.commands.find((c: any) => c.name() === "get");
    expect((getCmd as any)._args).toHaveLength(1);
    expect((getCmd as any)._args[0].name()).toBe("id");
  });

  test("registers multiple positional args", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}/wellness/{date}": ["GET"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}/wellness/{date}": {
          get: {
            summary: "Get wellness",
            parameters: [
              { name: "id", in: "path", required: true },
              { name: "date", in: "path", required: true },
            ],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    const athleteCmd = program.commands.find((c: any) => c.name() === "athlete");
    const wellnessCmd = athleteCmd?.commands.find((c: any) => c.name() === "wellness");
    const getCmd = wellnessCmd?.commands.find((c: any) => c.name() === "get");
    expect((getCmd as any)._args).toHaveLength(2);
    expect((getCmd as any)._args.map((a: any) => a.name())).toEqual(["id", "date"]);
  });

  test("registers required query params as required options", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}/activities": ["GET"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}/activities": {
          get: {
            summary: "List activities",
            parameters: [
              { name: "id", in: "path", required: true },
              { name: "oldest", in: "query", required: true },
            ],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    const athleteCmd = program.commands.find((c: any) => c.name() === "athlete");
    const activitiesCmd = athleteCmd?.commands.find((c: any) => c.name() === "activities");
    const listCmd = activitiesCmd?.commands.find((c: any) => c.name() === "list");
    const oldestOption = (listCmd as any).options.find((o: any) => o.long === "--oldest");
    expect(oldestOption).toBeDefined();
    expect(oldestOption.required).toBe(true);
  });

  test("registers optional query params as options", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}/activities": ["GET"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}/activities": {
          get: {
            summary: "List activities",
            parameters: [
              { name: "id", in: "path", required: true },
              { name: "oldest", in: "query", required: true },
              { name: "newest", in: "query", required: false },
            ],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    const athleteCmd = program.commands.find((c: any) => c.name() === "athlete");
    const activitiesCmd = athleteCmd?.commands.find((c: any) => c.name() === "activities");
    const listCmd = activitiesCmd?.commands.find((c: any) => c.name() === "list");
    const newestOption = (listCmd as any).options.find((o: any) => o.long === "--newest");
    expect(newestOption).toBeDefined();
    expect(newestOption.required).toBe(false);
  });

  test("adds --fields and --format options to all commands", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}": ["GET"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}": {
          get: {
            summary: "Get athlete",
            parameters: [{ name: "id", in: "path", required: true }],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    const athleteCmd = program.commands.find((c: any) => c.name() === "athlete");
    const getCmd = athleteCmd?.commands.find((c: any) => c.name() === "get");
    const options = (getCmd as any).options.map((o: any) => o.long);
    expect(options).toContain("--fields");
    expect(options).toContain("--format");
  });

  test("adds --file option to create/update/delete commands", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}": ["PUT"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}": {
          put: {
            summary: "Update athlete",
            parameters: [{ name: "id", in: "path", required: true }],
            requestBody: { required: true },
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    const athleteCmd = program.commands.find((c: any) => c.name() === "athlete");
    const updateCmd = athleteCmd?.commands.find((c: any) => c.name() === "update");
    const options = (updateCmd as any).options.map((o: any) => o.long);
    expect(options).toContain("--file");
  });

  test("adds --full option to update/delete commands", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}": ["DELETE"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}": {
          delete: {
            summary: "Delete athlete",
            parameters: [{ name: "id", in: "path", required: true }],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    const athleteCmd = program.commands.find((c: any) => c.name() === "athlete");
    const deleteCmd = athleteCmd?.commands.find((c: any) => c.name() === "delete");
    const options = (deleteCmd as any).options.map((o: any) => o.long);
    expect(options).toContain("--full");
  });

  test("handles underscore in param names with dashes in flag names", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}/activities": ["GET"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}/activities": {
          get: {
            summary: "List activities",
            parameters: [
              { name: "id", in: "path", required: true },
              { name: "oldest", in: "query", required: true },
              { name: "route_id", in: "query", required: false },
            ],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    const athleteCmd = program.commands.find((c: any) => c.name() === "athlete");
    const activitiesCmd = athleteCmd?.commands.find((c: any) => c.name() === "activities");
    const listCmd = activitiesCmd?.commands.find((c: any) => c.name() === "list");
    const routeIdOption = (listCmd as any).options.find((o: any) => o.long === "--route-id");
    expect(routeIdOption).toBeDefined();
  });

  test("registers multiple methods for same path", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}": ["GET", "PUT", "DELETE"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}": {
          get: {
            summary: "Get athlete",
            parameters: [{ name: "id", in: "path", required: true }],
          },
          put: {
            summary: "Update athlete",
            parameters: [{ name: "id", in: "path", required: true }],
            requestBody: { required: true },
          },
          delete: {
            summary: "Delete athlete",
            parameters: [{ name: "id", in: "path", required: true }],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    const registered = mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    expect(registered).toHaveLength(3);
    const methods = registered.map((r) => r.method);
    expect(methods).toContain("GET");
    expect(methods).toContain("PUT");
    expect(methods).toContain("DELETE");
  });

  test("handles path with {ext} embedded param", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/activity/{id}/power-curve{ext}": ["GET"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/activity/{id}/power-curve{ext}": {
          get: {
            summary: "Get power curve",
            parameters: [
              { name: "id", in: "path", required: true },
              { name: "ext", in: "path", required: true },
            ],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    const registered = mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    expect(registered).toHaveLength(1);
    expect(registered[0].pathInfo.params).toEqual(["id", "ext"]);
  });

  test("sets allowUnknownOption on all commands", () => {
    const program = new Command();
    const schemaIndex: SchemaIndex = {
      "/api/v1/athlete/{id}": ["GET"],
    };
    const spec: OpenAPISpec = {
      openapi: "3.0.1",
      paths: {
        "/api/v1/athlete/{id}": {
          get: {
            summary: "Get athlete",
            parameters: [{ name: "id", in: "path", required: true }],
          },
        },
      },
    };
    const getConfig = () => ({ apiKey: "test", baseUrl: "https://test.com", timeout: 30000 });

    const registered = mapRoutesToCommands(program, schemaIndex, spec, getConfig);

    expect(registered[0].command.options).toBeDefined();
  });
});

describe("extractQueryParams", () => {
  test("extracts single query param", () => {
    const options = { oldest: "2024-01-01" };
    const operation: OpenAPIOperation = {
      parameters: [{ name: "oldest", in: "query", required: true }],
    };
    const result = extractQueryParams(options, operation);
    expect(result).toEqual({ oldest: "2024-01-01" });
  });

  test("extracts multiple query params", () => {
    const options = { oldest: "2024-01-01", newest: "2024-12-31", limit: "100" };
    const operation: OpenAPIOperation = {
      parameters: [
        { name: "oldest", in: "query", required: true },
        { name: "newest", in: "query", required: false },
        { name: "limit", in: "query", required: false },
      ],
    };
    const result = extractQueryParams(options, operation);
    expect(result).toEqual({ oldest: "2024-01-01", newest: "2024-12-31", limit: "100" });
  });

  test("converts dashes to underscores in param names", () => {
    const options = { "route-id": "123", oldest: "2024-01-01" };
    const operation: OpenAPIOperation = {
      parameters: [
        { name: "oldest", in: "query", required: true },
        { name: "route_id", in: "query", required: false },
      ],
    };
    const result = extractQueryParams(options, operation);
    expect(result).toEqual({ oldest: "2024-01-01", route_id: "123" });
  });

  test("skips undefined options", () => {
    const options = { oldest: "2024-01-01", newest: undefined };
    const operation: OpenAPIOperation = {
      parameters: [
        { name: "oldest", in: "query", required: true },
        { name: "newest", in: "query", required: false },
        { name: "limit", in: "query", required: false },
      ],
    };
    const result = extractQueryParams(options, operation);
    expect(result).toEqual({ oldest: "2024-01-01" });
  });

  test("handles mixed path and query params", () => {
    const options = { oldest: "2024-01-01" };
    const operation: OpenAPIOperation = {
      parameters: [
        { name: "id", in: "path", required: true },
        { name: "oldest", in: "query", required: true },
      ],
    };
    const result = extractQueryParams(options, operation);
    expect(result).toEqual({ oldest: "2024-01-01" });
  });

  test("returns empty object when no query params", () => {
    const options = { "dry-run": true };
    const operation: OpenAPIOperation = {
      parameters: [{ name: "id", in: "path", required: true }],
    };
    const result = extractQueryParams(options, operation);
    expect(result).toEqual({});
  });
});

describe("processOutput", () => {
  test("returns data as-is by default", () => {
    const data = { id: 1, name: "test", extra: "ignored" };
    const options = { format: "json" };
    const result = processOutput(data, options, "get");
    expect(result).toEqual(data);
  });

  test("format count returns array length", () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const options = { format: "count" };
    const result = processOutput(data, options, "list");
    expect(result).toEqual({ count: 3 });
  });

  test("format count returns 1 for single object", () => {
    const data = { id: 1, name: "test" };
    const options = { format: "count" };
    const result = processOutput(data, options, "get");
    expect(result).toEqual({ count: 1 });
  });

  test("format ids returns array of ids", () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const options = { format: "ids" };
    const result = processOutput(data, options, "list");
    expect(result).toEqual([1, 2, 3]);
  });

  test("format ids returns single id in array", () => {
    const data = { id: 42, name: "test" };
    const options = { format: "ids" };
    const result = processOutput(data, options, "get");
    expect(result).toEqual([42]);
  });

  test("format ids returns empty array when no id", () => {
    const data = { name: "test" };
    const options = { format: "ids" };
    const result = processOutput(data, options, "get");
    expect(result).toEqual([]);
  });

  test("fields filters top-level fields", () => {
    const data = { id: 1, name: "test", extra: "ignored" };
    const options = { fields: "id,name" };
    const result = processOutput(data, options, "get");
    expect(result).toEqual({ id: 1, name: "test" });
  });

  test("fields with whitespace is trimmed", () => {
    const data = { id: 1, name: "test", extra: "ignored" };
    const options = { fields: " id , name " };
    const result = processOutput(data, options, "get");
    expect(result).toEqual({ id: 1, name: "test" });
  });

  test("fields filters nested fields", () => {
    const data = {
      id: 1,
      athlete: { name: "John", age: 30 },
      extra: "ignored",
    };
    const options = { fields: "id,athlete.name" };
    const result = processOutput(data, options, "get");
    expect(result).toEqual({ id: 1, athlete: { name: "John" } });
  });

  test("format count takes precedence over fields", () => {
    const data = [{ id: 1 }, { id: 2 }];
    const options = { format: "count", fields: "id" };
    const result = processOutput(data, options, "list");
    expect(result).toEqual({ count: 2 });
  });

  test("format ids takes precedence over fields", () => {
    const data = [{ id: 1 }, { id: 2 }];
    const options = { format: "ids", fields: "name" };
    const result = processOutput(data, options, "list");
    expect(result).toEqual([1, 2]);
  });

  test("minimal output for update action returns only id", () => {
    const data = { id: 123, name: "Test", extra: "ignored" };
    const options = {};
    const result = processOutput(data, options, "update");
    expect(result).toEqual({ id: 123 });
  });

  test("minimal output for delete action returns only id", () => {
    const data = { id: 456, name: "Test", extra: "ignored" };
    const options = {};
    const result = processOutput(data, options, "delete");
    expect(result).toEqual({ id: 456 });
  });

  test("--full flag returns complete data for update", () => {
    const data = { id: 123, name: "Test", extra: "ignored" };
    const options = { full: true };
    const result = processOutput(data, options, "update");
    expect(result).toEqual(data);
  });

  test("--full flag returns complete data for delete", () => {
    const data = { id: 456, name: "Test", extra: "ignored" };
    const options = { full: true };
    const result = processOutput(data, options, "delete");
    expect(result).toEqual(data);
  });

  test("get action always returns full data", () => {
    const data = { id: 123, name: "Test", extra: "ignored" };
    const options = {};
    const result = processOutput(data, options, "get");
    expect(result).toEqual(data);
  });

  test("list action always returns full data", () => {
    const data = [{ id: 1, name: "Test1" }, { id: 2, name: "Test2" }];
    const options = {};
    const result = processOutput(data, options, "list");
    expect(result).toEqual(data);
  });

  test("minimal output with no id returns empty object", () => {
    const data = { message: "success" };
    const options = {};
    const result = processOutput(data, options, "update");
    expect(result).toEqual({});
  });

  test("--full takes precedence over fields for update", () => {
    const data = { id: 123, name: "Test", extra: "ignored" };
    const options = { full: true, fields: "id,name" };
    const result = processOutput(data, options, "update");
    expect(result).toEqual(data);
  });
});

describe("readPayloadFile", () => {
  test("reads and parses valid JSON file", () => {
    const data = JSON.stringify({ id: 1, name: "test" });
    const mockFs = {
      readFileSync: () => data,
    } as any;
    const result = readPayloadFile("test.json", mockFs);
    expect(result).toEqual({ id: 1, name: "test" });
  });

  test("handles empty JSON object", () => {
    const data = "{}";
    const mockFs = {
      readFileSync: () => data,
    } as any;
    const result = readPayloadFile("test.json", mockFs);
    expect(result).toEqual({});
  });

  test("handles complex JSON", () => {
    const data = JSON.stringify({
      id: 1,
      athlete: { name: "John", age: 30 },
      activities: [1, 2, 3],
    });
    const mockFs = {
      readFileSync: () => data,
    } as any;
    const result = readPayloadFile("test.json", mockFs);
    expect(result).toEqual({
      id: 1,
      athlete: { name: "John", age: 30 },
      activities: [1, 2, 3],
    });
  });
});

describe("createActionHandler", () => {
  test("creates handler function", () => {
    const pathInfo = parsePath("/api/v1/athlete/{id}");
    const operation: OpenAPIOperation = {
      parameters: [{ name: "id", in: "path", required: true }],
    };
    const getConfig = () => ({ apiKey: "test-key", baseUrl: "https://test.com", timeout: 30000 });

    const handler = createActionHandler(pathInfo, "GET", operation, getConfig);
    expect(typeof handler).toBe("function");
  });

  test("handler for POST action", () => {
    const pathInfo = parsePath("/api/v1/athlete/{id}/events");
    const operation: OpenAPIOperation = {
      parameters: [{ name: "id", in: "path", required: true }],
      requestBody: { required: true },
    };
    const getConfig = () => ({ apiKey: "test-key", baseUrl: "https://test.com", timeout: 30000 });

    const handler = createActionHandler(pathInfo, "POST", operation, getConfig);
    expect(typeof handler).toBe("function");
  });

  test("handler for DELETE action", () => {
    const pathInfo = parsePath("/api/v1/activity/{id}");
    const operation: OpenAPIOperation = {
      parameters: [{ name: "id", in: "path", required: true }],
    };
    const getConfig = () => ({ apiKey: "test-key", baseUrl: "https://test.com", timeout: 30000 });

    const handler = createActionHandler(pathInfo, "DELETE", operation, getConfig);
    expect(typeof handler).toBe("function");
  });

  test("handler with multiple path params", () => {
    const pathInfo = parsePath("/api/v1/athlete/{id}/wellness/{date}");
    const operation: OpenAPIOperation = {
      parameters: [
        { name: "id", in: "path", required: true },
        { name: "date", in: "path", required: true },
      ],
    };
    const getConfig = () => ({ apiKey: "test-key", baseUrl: "https://test.com", timeout: 30000 });

    const handler = createActionHandler(pathInfo, "GET", operation, getConfig);
    expect(typeof handler).toBe("function");
  });

  test("handler creates correct action detection for different methods", () => {
    const pathInfo = parsePath("/api/v1/athlete/{id}");
    const getConfig = () => ({ apiKey: "test-key", baseUrl: "https://test.com", timeout: 30000 });

    const getHandler = createActionHandler(pathInfo, "GET", { parameters: [] }, getConfig);
    const postHandler = createActionHandler(pathInfo, "POST", { parameters: [] }, getConfig);
    const putHandler = createActionHandler(pathInfo, "PUT", { parameters: [] }, getConfig);
    const deleteHandler = createActionHandler(pathInfo, "DELETE", { parameters: [] }, getConfig);

    expect(typeof getHandler).toBe("function");
    expect(typeof postHandler).toBe("function");
    expect(typeof putHandler).toBe("function");
    expect(typeof deleteHandler).toBe("function");
  });
});
