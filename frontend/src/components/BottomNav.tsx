import { NavLink } from "react-router-dom";

/** Description of one entry in the bottom navigation bar. */
interface NavTab {
  to: string;
  label: string;
  icon: string;
}

const NAV_TABS: readonly NavTab[] = [
  { to: "/", label: "Inicio", icon: "home" },
  { to: "/despensa", label: "Despensa", icon: "kitchen" },
  { to: "/lista", label: "Lista", icon: "shopping_cart" },
  { to: "/scan", label: "Escanear", icon: "qr_code_scanner" },
  { to: "/settings", label: "Ajustes", icon: "settings" },
];

/** Horizontal padding per tab. Reduced from the original 16px so five tabs still fit at 380px. */
const TAB_BASE_CLASS = "flex flex-col items-center gap-1 rounded-pill px-3 py-2 transition-colors";
const ACTIVE_TAB_CLASS = "bg-neon-pulse text-obsidian-shell";
const INACTIVE_TAB_CLASS = "text-slate-text";

/**
 * Bottom navigation with one pill per top-level section. The active section is filled with the accent.
 *
 * @returns A fixed `nav` element with a link for each section.
 */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-20 items-end justify-around border-t border-outline-variant bg-obsidian-shell pb-2">
      {NAV_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          className={({ isActive }) =>
            `${TAB_BASE_CLASS} ${isActive ? ACTIVE_TAB_CLASS : INACTIVE_TAB_CLASS}`
          }
        >
          <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
          <span className="text-body-sm">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
