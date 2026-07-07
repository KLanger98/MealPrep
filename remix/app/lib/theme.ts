import { useEffect, useState } from "react";

// 'system' follows the OS; 'light'/'dark' are explicit overrides. The
// pre-paint script in root.tsx applies the class before hydration; this hook
// only manages changes after that.
export type Theme = "system" | "light" | "dark";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  // SSR renders 'system'; the real value loads after hydration.
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme((localStorage.getItem("theme") as Theme | null) ?? "system");

    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = (localStorage.getItem("theme") as Theme | null) ?? "system";
      apply(current);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function cycle() {
    const next = NEXT[theme];
    setTheme(next);

    if (next === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", next);
    }

    apply(next);
  }

  return { theme, cycle };
}
