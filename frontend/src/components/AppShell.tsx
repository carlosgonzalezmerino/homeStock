import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-outline-variant bg-surface px-container-padding">
        <span className="text-headline-md font-bold text-primary">homeStock</span>
      </header>
      <main className="pb-32 px-container-padding">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
