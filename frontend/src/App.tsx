import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/theme";
import { ActiveLocationProvider } from "@/location";
import { AppRoutes } from "./AppRoutes";

const queryClient = new QueryClient();

/**
 * Root of the application: data fetching, theme, active location and the router.
 *
 * @returns The provider tree with the routes inside.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ActiveLocationProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ActiveLocationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
