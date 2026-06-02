import type { DashboardTrendPoint } from "@/lib/analytics/queries/dashboard-charts";

export type ChartDimensions = {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
};

export const DEFAULT_CHART_DIMS: ChartDimensions = {
  width: 400,
  height: 160,
  paddingX: 12,
  paddingY: 16,
};

export function buildLinePath(
  points: DashboardTrendPoint[],
  dims: ChartDimensions
): { path: string; max: number; min: number } {
  if (points.length === 0) {
    return { path: "", max: 0, min: 0 };
  }

  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const innerW = dims.width - dims.paddingX * 2;
  const innerH = dims.height - dims.paddingY * 2;

  const coords = points.map((point, index) => {
    const x =
      dims.paddingX +
      (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y =
      dims.paddingY + innerH - ((point.value - min) / range) * innerH;
    return { x, y };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");

  return { path, max, min };
}

export function formatChartAxisValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}
