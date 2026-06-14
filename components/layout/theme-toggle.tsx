"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <SunIcon
        className={cn(
          "size-4 shrink-0 transition-colors",
          isDark ? "text-muted-foreground/50" : "text-muted-foreground"
        )}
        aria-hidden
      />
      <Switch
        checked={isDark}
        disabled={!mounted}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      />
      <MoonIcon
        className={cn(
          "size-4 shrink-0 transition-colors",
          isDark ? "text-muted-foreground" : "text-muted-foreground/50"
        )}
        aria-hidden
      />
    </div>
  );
}
