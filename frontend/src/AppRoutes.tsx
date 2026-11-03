import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/components";
import { Dashboard, Pantry, Scan, ProductDetail, ManualEntry, Settings, CustomEntry, ShoppingList, ReviewPurchase, Review } from "@/screens";

/**
 * Every screen of the app and the path that opens it.
 *
 * `/scan/:ean` and `/despensa/:ean` show the same detail screen in two modes: the first
 * registers a purchase after a scan, the second manages a product already in the pantry.
 *
 * @returns The route table, inside the shared layout with the bottom navigation.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="despensa" element={<Pantry />} />
        <Route path="despensa/:ean" element={<ProductDetail mode="manage" />} />
        <Route path="lista" element={<ShoppingList />} />
        <Route path="repaso" element={<Review />} />
        <Route path="scan" element={<Scan />} />
        <Route path="scan/revisar" element={<ReviewPurchase />} />
        <Route path="scan/:ean" element={<ProductDetail mode="scan" />} />
        <Route path="scan/:ean/manual" element={<ManualEntry />} />
        <Route path="custom-entry" element={<CustomEntry />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
