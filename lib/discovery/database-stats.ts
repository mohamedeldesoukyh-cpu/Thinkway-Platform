export type DiscoveryCategoryStat = {
  label: string;
  count: number;
};

export type DiscoveryDatabaseStats = {
  totalCreators: number;
  categorizedCreators: number;
  uncategorizedCreators: number;
  topCategories: DiscoveryCategoryStat[];
};

export type DiscoveryDatabaseStatsRpcRow = {
  total_creators: number;
  categorized_creators: number;
  category_label: string;
  category_count: number;
};

export function mapDiscoveryDatabaseStatsRows(
  rows: DiscoveryDatabaseStatsRpcRow[]
): DiscoveryDatabaseStats {
  if (rows.length === 0) {
    return {
      totalCreators: 0,
      categorizedCreators: 0,
      uncategorizedCreators: 0,
      topCategories: [],
    };
  }

  const totalCreators = Number(rows[0]?.total_creators ?? 0);
  const categorizedCreators = Number(rows[0]?.categorized_creators ?? 0);

  const topCategories = rows.map((row) => ({
    label: row.category_label,
    count: Number(row.category_count ?? 0),
  }));

  return {
    totalCreators,
    categorizedCreators,
    uncategorizedCreators: Math.max(0, totalCreators - categorizedCreators),
    topCategories,
  };
}
