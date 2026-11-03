/** Prefix that routes every request through the backend proxy. */
const API_BASE_PATH = "/api";
const JSON_CONTENT_TYPE = "application/json";
const NO_CONTENT_STATUS = 204;

/** Error thrown when the backend answers with a non-2xx status. */
export class ApiError extends Error {
  status: number;
  body: unknown;

  /**
   * @param status - HTTP status code returned by the backend.
   * @param body - Parsed response body, when the backend sent one.
   */
  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Reads a response body as JSON when the server says it is JSON, otherwise as text.
 *
 * @param response - The response to read.
 * @returns The parsed JSON, the text, or `undefined` for empty bodies and 204 responses.
 */
async function parseBody(response: Response): Promise<unknown> {
  if (response.status === NO_CONTENT_STATUS) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes(JSON_CONTENT_TYPE)) return response.json();
  const text = await response.text();
  return text.length > 0 ? text : undefined;
}

/**
 * Sends a request and converts non-2xx responses into {@link ApiError}.
 *
 * @param path - Path relative to the API base, starting with `/`.
 * @param init - Method, headers and body for `fetch`.
 * @returns The parsed response body typed as `T`.
 * @throws {ApiError} When the response status is not 2xx.
 */
async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_PATH}${path}`, init);
  const body = await parseBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, body);
  }
  return body as T;
}

/**
 * Builds the init object for a request that sends a JSON body.
 *
 * @param method - HTTP method, such as `POST` or `PATCH`.
 * @param body - Value serialized as JSON.
 * @returns The `RequestInit` for `fetch`.
 */
function jsonRequestInit(method: "POST" | "PATCH", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": JSON_CONTENT_TYPE },
    body: JSON.stringify(body),
  };
}

/**
 * Performs a GET request.
 *
 * @param path - Path relative to the API base.
 * @returns The parsed response body.
 * @throws {ApiError} When the backend responds with a non-2xx status.
 */
export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

/**
 * Performs a POST request with a JSON body.
 *
 * @param path - Path relative to the API base.
 * @param body - Value serialized as JSON.
 * @returns The parsed response body.
 * @throws {ApiError} When the backend responds with a non-2xx status.
 */
export function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, jsonRequestInit("POST", body));
}

/**
 * Performs a PATCH request with a JSON body.
 *
 * @param path - Path relative to the API base.
 * @param body - Value serialized as JSON.
 * @returns The parsed response body.
 * @throws {ApiError} When the backend responds with a non-2xx status.
 */
export function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, jsonRequestInit("PATCH", body));
}

/**
 * Performs a DELETE request and discards the response body.
 *
 * @param path - Path relative to the API base.
 * @returns A promise that resolves when the backend accepts the deletion.
 * @throws {ApiError} When the backend responds with a non-2xx status.
 */
export async function del(path: string): Promise<void> {
  await request<void>(path, { method: "DELETE" });
}
