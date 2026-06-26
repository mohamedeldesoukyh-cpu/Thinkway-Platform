/** URL/query sentinel for clients/campaigns with no holding group. */
export const INDEPENDENT_GROUP_FILTER_VALUE = "__independent__";

export const INDEPENDENT_CLIENTS_FILTER_LABEL = "Independent clients";
export const ALL_GROUPS_FILTER_LABEL = "All groups";

export function isIndependentGroupFilter(
  value: string | undefined | null
): boolean {
  return value === INDEPENDENT_GROUP_FILTER_VALUE;
}

export function parseGroupFilterParam(
  value: string | undefined | null
): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed;
}

export function buildGroupFilterSelectOptions(
  groups: { id: string; name: string }[]
): { value: string; label: string }[] {
  return [
    { value: "", label: ALL_GROUPS_FILTER_LABEL },
    { value: INDEPENDENT_GROUP_FILTER_VALUE, label: INDEPENDENT_CLIENTS_FILTER_LABEL },
    ...groups.map((group) => ({ value: group.id, label: group.name })),
  ];
}

type GroupFilterQuery = {
  eq: (column: string, value: string) => GroupFilterQuery;
  is: (column: string, value: null) => GroupFilterQuery;
};

export function applyGroupIdColumnFilter<T extends GroupFilterQuery>(
  query: T,
  groupFilter: string | undefined | null,
  column = "group_id"
): T {
  const parsed = parseGroupFilterParam(groupFilter);
  if (!parsed) return query;
  if (isIndependentGroupFilter(parsed)) {
    return query.is(column, null) as T;
  }
  return query.eq(column, parsed) as T;
}

export function matchesGroupFilter(
  entityGroupId: string | null | undefined,
  groupFilter: string | undefined | null
): boolean {
  const parsed = parseGroupFilterParam(groupFilter);
  if (!parsed) return true;
  if (isIndependentGroupFilter(parsed)) {
    return entityGroupId == null;
  }
  return entityGroupId === parsed;
}
