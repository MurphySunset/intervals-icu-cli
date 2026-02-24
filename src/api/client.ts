/**
 * Standard API response wrapper.
 * @template T The type of the data payload on success.
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    status: number;
    duration: string;
    total?: number;
    pages?: number;
  };
}

/**
 * Options for ApiClient constructor.
 */
interface ApiClientOptions {
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Configuration for API client.
 */
interface Config {
  apiKey: string;
  baseUrl: string;
  timeout: number;
}

/**
 * API client for intervals.icu.
 * Handles authentication, retries, timeouts, and error handling.
 */
export class ApiClient {
  private config: Config;
  private options: ApiClientOptions;

  /**
   * @param config - API configuration (apiKey, baseUrl, timeout)
   * @param options - Client options (dryRun, force)
   */
  constructor(config: Config, options: ApiClientOptions = {}) {
    this.config = config;
    this.options = options;
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`API_KEY:${this.config.apiKey}`).toString("base64");
    return `Basic ${credentials}`;
  }

  /**
   * Make an HTTP request to the API.
   * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE)
   * @param path - API path (e.g., /api/v1/athlete/{id})
   * @param data - Request body for non-GET, or query params for GET
   * @param retries - Current retry count (internal use)
   * @param customHeaders - Additional headers to include/override defaults
   * @returns ApiResponse with success status, data, and metadata
   */
  async request<T>(
    method: string,
    path: string,
    data?: any,
    retries = 0,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const start = Date.now();
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Authorization": this.getAuthHeader(),
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Connection": "close",
      ...customHeaders,
    };

    if (this.options.dryRun) {
      console.error(`[DRY RUN] Method: ${method}`);
      console.error(`[DRY RUN] URL: ${url}`);
      console.error(`[DRY RUN] Headers: ${JSON.stringify({
        "Authorization": "Basic [REDACTED]",
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...customHeaders,
      }, null, 2)}`);
      if (data && method.toUpperCase() !== "GET") {
        console.error(`[DRY RUN] Body: ${JSON.stringify(data, null, 2)}`);
      }
      return {
        success: true,
        data: {} as T,
        meta: { status: 200, duration: "0ms" },
      };
    }

    const isDestructive = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
    if (isDestructive && !this.options.force) {
      const error = {
        success: false,
        error: {
          code: "force_required",
          message: `Method ${method} requires --force flag to execute on ${url}`,
        },
        meta: { status: 0, duration: "0ms" },
      };
      console.error(JSON.stringify(error, null, 2));
      process.exit(10);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      let body: string | undefined;
      if (data && method.toUpperCase() !== "GET") {
        body = JSON.stringify(data);
      }

      let fetchUrl = url;
      if (method.toUpperCase() === "GET" && data && Object.keys(data).length > 0) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(data)) {
          if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(`${key}[]`, String(v)));
          } else {
            searchParams.append(key, String(value));
          }
        }
        fetchUrl += `?${searchParams.toString()}`;
      }

      const response = await fetch(fetchUrl, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let responseData: any;
      const rawText = await Promise.race([
        response.text(),
        new Promise<string>((_, reject) => {
          setTimeout(() => {
            controller.abort();
            reject(new Error("Body read timeout"));
          }, Math.max(1000, this.config.timeout - (Date.now() - start)));
        }),
      ]);

      if (rawText.trim().startsWith("<")) {
        const titleMatch = rawText.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : "Unknown HTML Page";
        const preview = rawText.substring(0, 200);
        const duration = `${Date.now() - start}ms`;
        return {
          success: false,
          error: {
            code: "server_error",
            message: `Server returned HTML (${title}). HTML truncated: ${preview}`,
          },
          meta: { status: response.status, duration },
        };
      }

      try {
        responseData = JSON.parse(rawText);
      } catch {
        responseData = rawText;
      }

      if (response.status === 429 && retries < 3) {
        const backoff = Math.pow(2, retries) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoff));
        return this.request<T>(method, path, data, retries + 1, customHeaders);
      }

      const success = response.status >= 200 && response.status < 300;
      const duration = `${Date.now() - start}ms`;

      return {
        success,
        data: success ? responseData : undefined,
        error: !success ? {
          code: responseData.code || "api_error",
          message: responseData.message || "Unknown API Error",
        } : undefined,
        meta: { status: response.status, duration, total: responseData.total, pages: responseData.pages },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.error(`Error: Request timeout after ${this.config.timeout}ms`);
          process.exit(3);
        }
        const duration = `${Date.now() - start}ms`;
        return {
          success: false,
          error: { code: "network_error", message: error.message },
          meta: { status: 0, duration },
        };
      }
      const duration = `${Date.now() - start}ms`;
      return {
        success: false,
        error: { code: "unknown_error", message: "Unknown error occurred" },
        meta: { status: 0, duration },
      };
    }
  }
}
