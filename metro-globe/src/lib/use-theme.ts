import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "metro-globe:theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}

/**
 * Reads/writes the active theme, persists it to localStorage, and reflects
 * it onto <html data-theme="..."> so CSS custom properties can react to it
 * app-wide (map, panels, buttons, etc. all key off that attribute).
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;

    // Keep the mobile browser chrome (status bar / address bar) color in
    // sync with the active theme, not just the OS-level media query.
    const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
    const color = theme === "dark" ? "#070b14" : "#f3f5f9";
    if (meta) {
      meta.setAttribute("content", color);
    } else {
      const created = document.createElement("meta");
      created.name = "theme-color";
      created.content = color;
      document.head.appendChild(created);
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable (private mode, etc.) — theme still works
      // for this session, it just won't persist across reloads.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return [theme, toggleTheme];
}
