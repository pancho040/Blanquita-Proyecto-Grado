import { useState, useEffect, useCallback } from "react";

const THEME_KEY = "blanquita_theme";

export function getStoredTheme() {
  if (typeof window === "undefined") return "system";
  try {
    return window.localStorage.getItem(THEME_KEY) || "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState(getStoredTheme);

  useEffect(() => {
    const current = getStoredTheme();
    setThemeState(current);
    applyTheme(current);

    const onStorage = (e) => {
      if (e.key === THEME_KEY) {
        const nuevo = e.newValue || "system";
        setThemeState(nuevo);
        applyTheme(nuevo);
      }
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => {
      if (getStoredTheme() === "system") {
        applyTheme("system");
      }
    };

    const onCustomEvent = (e) => {
      setThemeState(e.detail);
      applyTheme(e.detail);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("blanquita-theme-change", onCustomEvent);
    mediaQuery.addEventListener("change", onMediaChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("blanquita-theme-change", onCustomEvent);
      mediaQuery.removeEventListener("change", onMediaChange);
    };
  }, []);

  const setTheme = useCallback((newTheme) => {
    try {
      window.localStorage.setItem(THEME_KEY, newTheme);
    } catch {
      /* noop */
    }
    setThemeState(newTheme);
    applyTheme(newTheme);
    window.dispatchEvent(new CustomEvent("blanquita-theme-change", { detail: newTheme }));
  }, []);

  return { theme, setTheme };
}
