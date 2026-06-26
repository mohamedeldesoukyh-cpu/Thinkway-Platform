"use client";

import * as React from "react";

const COLOR_SCHEMES = ["light", "dark"] as const;
const MEDIA = "(prefers-color-scheme: dark)";
const DEFAULT_THEMES = ["light", "dark"];

type Attribute = "class" | `data-${string}`;

export type ThemeProviderProps = React.PropsWithChildren<{
  attribute?: Attribute | Attribute[];
  defaultTheme?: string;
  disableTransitionOnChange?: boolean;
  enableColorScheme?: boolean;
  enableSystem?: boolean;
  forcedTheme?: string;
  nonce?: string;
  storageKey?: string;
  themes?: string[];
  value?: Record<string, string>;
}>;

export type UseThemeProps = {
  forcedTheme?: string;
  resolvedTheme?: string;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  systemTheme?: "dark" | "light";
  theme?: string;
  themes: string[];
};

const ThemeContext = React.createContext<UseThemeProps | undefined>(undefined);
const defaultContext: UseThemeProps = { setTheme: () => {}, themes: [] };

export function useTheme(): UseThemeProps {
  return React.useContext(ThemeContext) ?? defaultContext;
}

export function ThemeProvider(props: ThemeProviderProps) {
  const existingContext = React.useContext(ThemeContext);
  if (existingContext) {
    return <>{props.children}</>;
  }

  return <Theme {...props} />;
}

function Theme({
  attribute = "data-theme",
  children,
  defaultTheme: defaultThemeProp,
  disableTransitionOnChange = false,
  enableColorScheme = true,
  enableSystem = true,
  forcedTheme,
  nonce,
  storageKey = "theme",
  themes = DEFAULT_THEMES,
  value,
}: ThemeProviderProps) {
  const defaultTheme = defaultThemeProp ?? (enableSystem ? "system" : "light");
  const [theme, setThemeState] = React.useState(() =>
    readStoredTheme(storageKey, defaultTheme)
  );
  const [resolvedSystemTheme, setResolvedSystemTheme] = React.useState<
    "dark" | "light"
  >(() => (theme === "system" ? getSystemTheme() : (theme as "dark" | "light")));
  const themeClassNames = value ? Object.values(value) : themes;

  const applyTheme = React.useCallback(
    (nextTheme: string | undefined) => {
      if (!nextTheme) return;

      let resolved = nextTheme;
      if (nextTheme === "system" && enableSystem) {
        resolved = getSystemTheme();
      }

      const resolvedName = value ? value[resolved] : resolved;
      const restoreTransitions = disableTransitionOnChange
        ? disableAnimation(nonce)
        : null;
      const root = document.documentElement;

      const applyAttribute = (attr: Attribute) => {
        if (attr === "class") {
          root.classList.remove(...themeClassNames);
          if (resolvedName) root.classList.add(resolvedName);
          return;
        }

        if (attr.startsWith("data-")) {
          if (resolvedName) {
            root.setAttribute(attr, resolvedName);
          } else {
            root.removeAttribute(attr);
          }
        }
      };

      if (Array.isArray(attribute)) {
        attribute.forEach(applyAttribute);
      } else {
        applyAttribute(attribute);
      }

      if (enableColorScheme) {
        const fallback = COLOR_SCHEMES.includes(defaultTheme as "dark" | "light")
          ? (defaultTheme as "dark" | "light")
          : null;
        const colorScheme = COLOR_SCHEMES.includes(resolved as "dark" | "light")
          ? (resolved as "dark" | "light")
          : fallback;
        root.style.colorScheme = colorScheme ?? "";
      }

      restoreTransitions?.();
    },
    [
      attribute,
      defaultTheme,
      disableTransitionOnChange,
      enableColorScheme,
      enableSystem,
      nonce,
      themeClassNames,
      value,
    ]
  );

  const setTheme = React.useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (nextTheme) => {
      setThemeState((previousTheme) => {
        const resolvedTheme =
          typeof nextTheme === "function" ? nextTheme(previousTheme) : nextTheme;
        saveTheme(storageKey, resolvedTheme);
        return resolvedTheme;
      });
    },
    [storageKey]
  );

  const handleMediaQuery = React.useCallback(
    (event: MediaQueryList | MediaQueryListEvent) => {
      const systemTheme = getSystemTheme(event);
      setResolvedSystemTheme(systemTheme);

      if (theme === "system" && enableSystem && !forcedTheme) {
        applyTheme("system");
      }
    },
    [applyTheme, enableSystem, forcedTheme, theme]
  );

  React.useEffect(() => {
    const media = window.matchMedia(MEDIA);
    const onChange = (event: MediaQueryListEvent) => handleMediaQuery(event);

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, [handleMediaQuery]);

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;

      if (!event.newValue) {
        setTheme(defaultTheme);
        return;
      }

      setThemeState(event.newValue);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [defaultTheme, setTheme, storageKey]);

  React.useEffect(() => {
    applyTheme(forcedTheme ?? theme);
  }, [applyTheme, forcedTheme, theme]);

  const providerValue = React.useMemo<UseThemeProps>(
    () => ({
      forcedTheme,
      resolvedTheme: theme === "system" ? resolvedSystemTheme : theme,
      setTheme,
      systemTheme: enableSystem ? resolvedSystemTheme : undefined,
      theme,
      themes: enableSystem ? [...themes, "system"] : themes,
    }),
    [
      enableSystem,
      forcedTheme,
      resolvedSystemTheme,
      setTheme,
      theme,
      themes,
    ]
  );

  return (
    <ThemeContext.Provider value={providerValue}>{children}</ThemeContext.Provider>
  );
}

function readStoredTheme(storageKey: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;

  try {
    return localStorage.getItem(storageKey) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveTheme(storageKey: string, theme: string) {
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // localStorage unavailable
  }
}

function getSystemTheme(query?: MediaQueryList | MediaQueryListEvent): "dark" | "light" {
  if (typeof window === "undefined") return "light";
  const media = query ?? window.matchMedia(MEDIA);
  return media.matches ? "dark" : "light";
}

function disableAnimation(nonce?: string) {
  const css = document.createElement("style");
  if (nonce) css.setAttribute("nonce", nonce);
  css.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}"
    )
  );
  document.head.appendChild(css);

  return () => {
    window.getComputedStyle(document.body);
    setTimeout(() => {
      document.head.removeChild(css);
    }, 1);
  };
}
