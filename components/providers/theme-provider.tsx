"use client";

import {
  ThemeProvider as ThinkwayThemeProvider,
  type ThemeProviderProps,
  useTheme,
} from "@/lib/theme/provider";

/**
 * Theme context without an inline client script. ThemeHeadScript in the root
 * layout applies the persisted class before paint (React 19 / Next.js 16 safe).
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <ThinkwayThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme={false}
      {...props}
    >
      {children}
    </ThinkwayThemeProvider>
  );
}

export { useTheme, type ThemeProviderProps };
