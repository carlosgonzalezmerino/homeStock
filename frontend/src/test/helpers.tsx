import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, type MemoryRouterProps } from "react-router-dom";
import { ActiveLocationProvider } from "@/location";

/**
 * Creates a query client that does not retry, so failing requests show up at once in tests.
 *
 * @returns A new query client.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

/** One entry of the router history: a path, or a location with state. */
type InitialEntry = NonNullable<MemoryRouterProps["initialEntries"]>[number];

/**
 * Renders routes inside the same providers the app uses: query client, active location and router.
 *
 * @param routes - The `<Routes>` element under test.
 * @param initialEntries - The history the router starts with. The last entry is the current one.
 * @param initialIndex - The index of the current entry in `initialEntries`.
 * @returns The result of `render`.
 */
export function renderInApp(routes: ReactNode, initialEntries: InitialEntry[], initialIndex?: number) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <ActiveLocationProvider>
        <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
          {routes}
        </MemoryRouter>
      </ActiveLocationProvider>
    </QueryClientProvider>,
  );
}
