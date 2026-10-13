import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "tmc-admin-theme";

function getInitialTheme() {
  let theme = "light";

  try {
    theme = localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    theme = "light";
  }

  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }

  return theme;
}

export default function usePortalTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The selected theme still applies for the current session.
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  };

  return { theme, toggleTheme };
}
