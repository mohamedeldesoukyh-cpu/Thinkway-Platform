import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const ARROW = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export type FinanceSuiteTileVariant = "default" | "alt" | "soft";

type FinanceSuiteTileProps = {
  kicker: string;
  title?: string;
  big?: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  go?: string;
  variant?: FinanceSuiteTileVariant;
  spark?: number[];
  sparkHi?: number;
  star?: ReactNode;
  className?: string;
};

export function FinanceSuiteTile({
  kicker,
  title,
  big,
  description,
  href,
  onClick,
  go = "Open",
  variant = "default",
  spark,
  sparkHi,
  star,
  className,
}: FinanceSuiteTileProps) {
  const classNames = cn(
    "fs-tile",
    variant === "alt" && "alt",
    variant === "soft" && "soft",
    className
  );

  const body = (
    <>
      <span className="fs-tl">
        <span className="fs-tl__k">{kicker}</span>
        {big ? <span className="fs-big">{big}</span> : null}
        {title ? <b>{title}</b> : null}
        {description ? <p>{description}</p> : null}
        {spark && spark.length > 0 ? (
          <span className="fs-spark" aria-hidden>
            {spark.map((value, index) => (
              <span
                key={`${index}-${value}`}
                className={index === sparkHi ? "hi" : undefined}
                style={{ height: `${Math.max(8, value)}%` }}
              />
            ))}
          </span>
        ) : null}
        <span className="fs-go">
          {go}
          {ARROW}
        </span>
      </span>
      {star}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classNames}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" className={classNames} onClick={onClick}>
      {body}
    </button>
  );
}

type FinanceSuiteDeckProps = {
  children: ReactNode;
  className?: string;
};

export function FinanceSuiteDeck({ children, className }: FinanceSuiteDeckProps) {
  return <div className={cn("fs-deck", className)}>{children}</div>;
}
