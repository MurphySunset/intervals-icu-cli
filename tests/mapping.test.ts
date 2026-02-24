import { describe, test, expect } from "bun:test";
import { Command } from "commander";
import {
  parsePath,
  detectAction,
  buildPath,
  pickFields,
  getCommandPath,
  mapRoutesToCommands,
} from "../src/api/mapping";
import type { SchemaIndex, OpenAPISpec } from "../src/api/mapping";

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

    const registered = mapRoutesToCommands(program, schemaIndex, spec);

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

    const registered = mapRoutesToCommands(program, schemaIndex, spec);

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

    mapRoutesToCommands(program, schemaIndex, spec);

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

    mapRoutesToCommands(program, schemaIndex, spec);

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

    mapRoutesToCommands(program, schemaIndex, spec);

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

    mapRoutesToCommands(program, schemaIndex, spec);

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

    mapRoutesToCommands(program, schemaIndex, spec);

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

    mapRoutesToCommands(program, schemaIndex, spec);

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

    mapRoutesToCommands(program, schemaIndex, spec);

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

    mapRoutesToCommands(program, schemaIndex, spec);

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

    const registered = mapRoutesToCommands(program, schemaIndex, spec);

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

    const registered = mapRoutesToCommands(program, schemaIndex, spec);

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

    const registered = mapRoutesToCommands(program, schemaIndex, spec);

    expect(registered[0].command.options).toBeDefined();
  });
});
