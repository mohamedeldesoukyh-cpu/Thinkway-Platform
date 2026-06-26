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
}: Props) {
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
