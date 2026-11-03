import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

/** Vertical space reserved so page content is not hidden behind the bottom navigation. */
const CONTENT_BOTTOM_PADDING_CLASS = "pb-32";

/**
 * Frame shared by every screen: a dark top bar, the routed page and the bottom navigation.
 *
 * @returns The application layout with an `Outlet` for the active route.
 */
export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="sticky top-0 z-40 flex h-16 items-center bg-obsidian-shell px-container-padding">
        <span className="text-body-lg text-pure-white">
          home<span className="text-neon-pulse">Stock</span>
        </span>
      </header>
      <main className={`mx-auto max-w-page px-container-padding ${CONTENT_BOTTOM_PADDING_CLASS}`}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
