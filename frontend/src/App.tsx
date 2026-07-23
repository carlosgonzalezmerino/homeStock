import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/theme";
import { AppShell } from "@/components";
import { Dashboard, Pantry, Scan, ProductDetail, ManualEntry, Settings } from "@/screens";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="despensa" element={<Pantry />} />
              <Route path="despensa/:ean" element={<ProductDetail />} />
              <Route path="scan" element={<Scan />} />
              <Route path="scan/:ean" element={<ProductDetail />} />
              <Route path="scan/:ean/manual" element={<ManualEntry />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
