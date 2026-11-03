import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/** Default answers for endpoints that many screens read but most tests do not care about. */
export const server = setupServer(
  http.get("/api/review", () => HttpResponse.json([])),
  http.get("/api/shopping-list", () => HttpResponse.json([])),
);
