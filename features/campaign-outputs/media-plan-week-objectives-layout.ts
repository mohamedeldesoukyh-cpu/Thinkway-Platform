/** Equal flex share so all weekly objective cards fit within landscape page bounds. */
export function weeklyObjectiveCardFlex(): string {
  return "1 1 0";
}

/** Inline weight bar width for proportional emphasis inside equal-width cards. */
export function weeklyObjectiveWeightBarWidth(weight: number): string {
  return `${Math.max(0, Math.min(100, weight))}%`;
}
