"use client";

import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { DEFAULT_PLATFORM_OPTIONS } from "./creator-selection-types";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  platform: string;
  onPlatformChange: (value: string) => void;
  platformOptions?: Array<{ value: string; label: string }>;
  searchPlaceholder?: string;
  autoFocus?: boolean;
  className?: string;
  children?: React.ReactNode;
  /** Panel sidebar layout matching add-creators mockup. */
  variant?: "default" | "panel";
};

export function CreatorSearchPanel({
  search,
  onSearchChange,
  platform,
  onPlatformChange,
  platformOptions = [...DEFAULT_PLATFORM_OPTIONS],
  searchPlaceholder = "Search by name or handle",
  autoFocus,
  className,
  children,
  variant = "default",
}: Props) {
  if (variant === "panel") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-b border-border px-4 py-3.5",
          className
        )}
      >
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/80" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            autoFocus={autoFocus}
            className="h-9 w-full rounded-lg border border-border bg-white py-0 pr-2.5 pl-[34px] text-[13px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus:border-blue-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
          />
        </div>
        <Select value={platform} onValueChange={onPlatformChange}>
          <SelectTrigger className="h-9 min-w-[128px] rounded-lg border-border px-2.5 text-xs text-muted-foreground shadow-none focus:border-blue-600">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            {platformOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {children}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", className)}>
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
          autoFocus={autoFocus}
        />
      </div>
      <Select value={platform} onValueChange={onPlatformChange}>
        <SelectTrigger className="sm:w-44">
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent>
          {platformOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {children}
    </div>
  );
}
