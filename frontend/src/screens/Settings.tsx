import { useTheme } from "@/theme";

export function Settings() {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex flex-col gap-stack-md pt-stack-md">
      <h1 className="text-headline-md text-on-surface">Ajustes</h1>

      <div className="flex items-center justify-between rounded-lg bg-surface-container p-4">
        <div>
          <p className="text-body-lg text-on-surface">Tema</p>
          <p className="text-body-sm text-on-surface-variant">
            {theme === "light" ? "Claro (Alimenda)" : "Oscuro (Dark Slate)"}
          </p>
        </div>
        <button
          aria-label="Cambiar tema"
          onClick={toggle}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container"
        >
          <span className="material-symbols-outlined">
            {theme === "light" ? "dark_mode" : "light_mode"}
          </span>
        </button>
      </div>
    </div>
  );
}
