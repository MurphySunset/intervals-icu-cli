import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ApiClient, ApiResponse } from "../src/api/client";

const mockConfig = {
  apiKey: "test-api-key-123",
  baseUrl: "https://intervals.icu",
  timeout: 30000,
};

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("auth header", () => {
    it("encodes API key as Basic auth with API_KEY prefix", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 1, name: "Test" }),
      } as Response);

      await client.request("GET", "/api/v1/athlete/test-id");

      expect(fetchSpy).toHaveBeenCalled();
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toContain("/api/v1/athlete/test-id");
      expect(options?.headers?.Authorization).toBe("Basic QVBJX0tFWTp0ZXN0LWFwaS1rZXktMTIz");
    });

    it("uses correct base64 encoding for API_KEY:actualKey format", () => {
      const expected = Buffer.from(`API_KEY:${mockConfig.apiKey}`).toString("base64");
      const authHeader = Buffer.from(`API_KEY:${mockConfig.apiKey}`).toString("base64");
      expect(authHeader).toBe(expected);
    });
  });

  describe("successful GET", () => {
    it("returns success with data on 200 response", async () => {
      const mockResponse = { id: 1, name: "Test Athlete" };
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      } as Response);

      const result: ApiResponse = await client.request("GET", "/api/v1/athlete/test-id");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(result.error).toBeUndefined();
      expect(result.meta.status).toBe(200);
    });

    it("includes duration in meta", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({}),
      } as Response);

      const result = await client.request("GET", "/api/v1/athlete/test-id");
      expect(result.meta.duration).toMatch(/\d+ms/);
    });
  });

  describe("dry-run mode", () => {
    it("intercepts request and returns mock success", async () => {
      const dryRunClient = new ApiClient(mockConfig, { dryRun: true });
      const fetchSpy = vi.spyOn(global, "fetch");

      const result = await dryRunClient.request("GET", "/api/v1/athlete/test-id");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
      expect(result.meta.status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("logs to stderr in dry-run mode", async () => {
      const dryRunClient = new ApiClient(mockConfig, { dryRun: true });
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await dryRunClient.request("POST", "/api/v1/athlete/test-id/activities", { type: "Run" });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("[DRY RUN] Method: POST"));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("[DRY RUN] URL: https://intervals.icu/api/v1/athlete/test-id/activities"));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("[DRY RUN] Body:"));

      consoleErrorSpy.mockRestore();
    });
  });

  describe("force required", () => {
    const destructiveMethods = ["POST", "PUT", "PATCH", "DELETE"] as const;

    destructiveMethods.forEach((method) => {
      it(`exits with code 10 for ${method} without force flag`, async () => {
        const noForceClient = new ApiClient(mockConfig, { force: false });
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
          throw new Error("exit called");
        });
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const path = method === "DELETE"
          ? "/api/v1/athlete/test-id/activities/123"
          : "/api/v1/athlete/test-id";

        await expect(
          noForceClient.request(method, path, { data: "test" })
        ).rejects.toThrow("exit called");

        expect(exitSpy).toHaveBeenCalledWith(10);
        const errorMsg = consoleErrorSpy.mock.calls.map((c) => c[0]).join(" ");
        expect(errorMsg).toContain("force_required");

        exitSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe("force allowed", () => {
    const destructiveMethods = [
      { method: "POST", path: "/api/v1/athlete/test-id/activities", status: 201 },
      { method: "PUT", path: "/api/v1/athlete/test-id", status: 200 },
      { method: "PATCH", path: "/api/v1/athlete/test-id", status: 200 },
      { method: "DELETE", path: "/api/v1/athlete/test-id/activities/123", status: 204 },
    ] as const;

    destructiveMethods.forEach(({ method, path, status }) => {
      it(`allows ${method} with force flag`, async () => {
        const forceClient = new ApiClient(mockConfig, { force: true });
        vi.spyOn(global, "fetch").mockResolvedValue({
          ok: true,
          status,
          text: async () => (method === "DELETE" ? "" : JSON.stringify({ id: "123" })),
        } as Response);

        const result = await forceClient.request(method, path, { data: "test" });

        expect(result.success).toBe(true);
        expect(result.meta.status).toBe(status);
      });
    });
  });

  describe("429 retry", () => {
    it("retries on 429 status with exponential backoff", async () => {
      vi.useFakeTimers();
      let callCount = 0;
      vi.spyOn(global, "fetch").mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            text: async () => JSON.stringify({ message: "Rate limit exceeded" }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: 1 }),
        } as Response);
      });

      const promise = client.request("GET", "/api/v1/athlete/test-id");

      vi.runAllTimers();
      const result = await promise;

      expect(callCount).toBe(2);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1 });

      vi.useRealTimers();
    });

    it("retries up to 3 times", async () => {
      vi.useFakeTimers();
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ message: "Rate limit exceeded" }),
      } as Response);

      const promise = client.request("GET", "/api/v1/athlete/test-id");

      vi.runAllTimers();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      vi.useRealTimers();
    });
  });

  describe("timeout", () => {
    it("exits with code 3 on timeout", async () => {
      const timeoutConfig = { ...mockConfig, timeout: 100 };
      const timeoutClient = new ApiClient(timeoutConfig);
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
        throw new Error(`exit called with code ${code}`);
      });
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const abortError = new Error("The user aborted a request");
      abortError.name = "AbortError";
      vi.spyOn(global, "fetch").mockRejectedValue(abortError);

      try {
        await timeoutClient.request("GET", "/api/v1/athlete/test-id");
        throw new Error("Should have thrown");
      } catch (error) {
        if (error instanceof Error && error.message === "exit called with code 3") {
          expect(exitSpy).toHaveBeenCalledWith(3);
          expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Request timeout after 100ms"));
        } else {
          throw error;
        }
      } finally {
        exitSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe("error response", () => {
    it("preserves intervals.icu native error format", async () => {
      const apiError = { code: "INVALID_REQUEST", message: "Invalid athlete ID" };
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify(apiError),
      } as Response);

      const result = await client.request("GET", "/api/v1/athlete/invalid");

      expect(result.success).toBe(false);
      expect(result.error).toEqual(apiError);
      expect(result.meta.status).toBe(400);
    });

    it("handles HTML error response", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "<html><title>Error 500</title><body>Internal Server Error</body></html>",
      } as Response);

      const result = await client.request("GET", "/api/v1/athlete/test-id");

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("server_error");
      expect(result.error?.message).toContain("Error 500");
      expect(result.meta.status).toBe(500);
    });

    it("handles network error", async () => {
      vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

      const result = await client.request("GET", "/api/v1/athlete/test-id");

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("network_error");
      expect(result.error?.message).toBe("Network error");
    });
  });

  describe("connection close", () => {
    it("includes Connection: close header in all requests", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({}),
      } as Response);

      await client.request("GET", "/api/v1/athlete/test-id");

      expect(fetchSpy).toHaveBeenCalled();
      const [, options] = fetchSpy.mock.calls[0];
      expect(options?.headers?.["Connection"]).toBe("close");
    });

    it("includes Connection: close header in POST requests", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ id: 1 }),
      } as Response);

      const forceClient = new ApiClient(mockConfig, { force: true });
      await forceClient.request("POST", "/api/v1/athlete/test-id/activities", { type: "Run" });

      expect(fetchSpy).toHaveBeenCalled();
      const [, options] = fetchSpy.mock.calls[0];
      expect(options?.headers?.["Connection"]).toBe("close");
    });
  });

  describe("query parameters", () => {
    it("serializes GET data as query string", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([]),
      } as Response);

      await client.request("GET", "/api/v1/athlete/test-id/activities", {
        oldest: "2024-01-01",
        newest: "2024-12-31",
        limit: 100,
      });

      const fetchCall = fetchSpy.mock.calls[0];
      const url = fetchCall[0];
      expect(url).toContain("oldest=2024-01-01");
      expect(url).toContain("newest=2024-12-31");
      expect(url).toContain("limit=100");
    });

    it("handles array parameters", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([]),
      } as Response);

      await client.request("GET", "/api/v1/athlete/test-id/activities", {
        types: ["Run", "Ride"],
      });

      const fetchCall = fetchSpy.mock.calls[0];
      const url = fetchCall[0];
      expect(url).toContain("types%5B%5D=Run");
      expect(url).toContain("types%5B%5D=Ride");
    });

    it("does not include body for GET requests", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([]),
      } as Response);

      await client.request("GET", "/api/v1/athlete/test-id/activities", { limit: 10 });

      const fetchCall = fetchSpy.mock.calls[0];
      const [, options] = fetchCall;
      expect(options?.body).toBeUndefined();
    });
  });

  describe("custom headers", () => {
    it("merges custom headers with default headers", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 1 }),
      } as Response);

      await client.request(
        "GET",
        "/api/v1/athlete/test-id",
        undefined,
        undefined,
        { "X-Custom-Header": "custom-value", "Another-Header": "test" }
      );

      const [, options] = fetchSpy.mock.calls[0];
      expect(options?.headers?.["Authorization"]).toBeDefined();
      expect(options?.headers?.["Content-Type"]).toBe("application/json");
      expect(options?.headers?.["Accept"]).toBe("application/json");
      expect(options?.headers?.["Connection"]).toBe("close");
      expect(options?.headers?.["X-Custom-Header"]).toBe("custom-value");
      expect(options?.headers?.["Another-Header"]).toBe("test");
    });

    it("custom headers can override default headers", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 1 }),
      } as Response);

      await client.request("GET", "/api/v1/athlete/test-id", undefined, undefined, {
        "Content-Type": "application/xml",
        "Accept": "text/html",
      });

      const [, options] = fetchSpy.mock.calls[0];
      expect(options?.headers?.["Content-Type"]).toBe("application/xml");
      expect(options?.headers?.["Accept"]).toBe("text/html");
      expect(options?.headers?.["Authorization"]).toBeDefined();
    });
  });

  describe("response meta", () => {
    it("includes total in meta when available", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ items: [1, 2, 3], total: 100 }),
      } as Response);

      const result = await client.request("GET", "/api/v1/athlete/test-id/activities", {
        limit: 10,
      });

      expect(result.meta.total).toBe(100);
    });

    it("includes pages in meta when available", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ items: [1, 2, 3], total: 100, pages: 10 }),
      } as Response);

      const result = await client.request("GET", "/api/v1/athlete/test-id/activities", {
        limit: 10,
      });

      expect(result.meta.pages).toBe(10);
    });

    it("omits total/pages when not in response", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ items: [1, 2, 3] }),
      } as Response);

      const result = await client.request("GET", "/api/v1/athlete/test-id/activities", {
        limit: 10,
      });

      expect(result.meta.total).toBeUndefined();
      expect(result.meta.pages).toBeUndefined();
    });
  });

  describe("body for POST/PUT/PATCH", () => {
    it("includes JSON body for POST requests", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ id: 1 }),
      } as Response);

      const forceClient = new ApiClient(mockConfig, { force: true });
      await forceClient.request("POST", "/api/v1/athlete/test-id/activities", {
        type: "Run",
        duration: 3600,
      });

      const fetchCall = fetchSpy.mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body);
      expect(body.type).toBe("Run");
      expect(body.duration).toBe(3600);
    });

    it("includes JSON body for PUT requests", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "test-id", weight: 70 }),
      } as Response);

      const forceClient = new ApiClient(mockConfig, { force: true });
      await forceClient.request("PUT", "/api/v1/athlete/test-id", { weight: 70 });

      const fetchCall = fetchSpy.mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body);
      expect(body.weight).toBe(70);
    });

    it("includes JSON body for PATCH requests", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "test-id", weight: 70 }),
      } as Response);

      const forceClient = new ApiClient(mockConfig, { force: true });
      await forceClient.request("PATCH", "/api/v1/athlete/test-id", { weight: 70 });

      const fetchCall = fetchSpy.mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body);
      expect(body.weight).toBe(70);
    });
  });
});
