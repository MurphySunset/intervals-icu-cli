import { describe, test, expect } from "bun:test";
import {
  parsePath,
  detectAction,
  buildPath,
  pickFields,
} from "../src/api/mapping";

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
  test("GET with params returns get", () => {
    expect(detectAction("GET", ["id"])).toBe("get");
  });

  test("GET with no params returns list", () => {
    expect(detectAction("GET", [])).toBe("list");
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
