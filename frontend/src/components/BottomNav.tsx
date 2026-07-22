import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "Inicio", icon: "home" },
  { to: "/despensa", label: "Despensa", icon: "kitchen" },
  { to: "/scan", label: "Escanear", icon: "qr_code_scanner" },
  { to: "/settings", label: "Ajustes", icon: "settings" },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-end justify-around bg-surface-container pb-safe border-t border-outline-variant">
      {tabs.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-colors ${
              isActive ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant"
            }`
          }
        >
          <span className="material-symbols-outlined text-2xl">{icon}</span>
          <span className="text-label-md">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
