import "@testing-library/jest-dom/vitest";
import { server } from "./server";

/** React Router 6 announces v7 changes on every render. They are known and say nothing about our code. */
const ROUTER_FUTURE_NOTICE = "React Router Future Flag Warning";
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (String(args[0]).includes(ROUTER_FUTURE_NOTICE)) return;
  originalWarn(...args);
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());
