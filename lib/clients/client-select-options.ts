export type ClientSelectLabelSource = {
  id: string;
  name: string;
  legal_name: string | null;
};

export type ClientSelectOption = {
  value: string;
  label: string;
  description?: string;
};

export function shouldShowClientLegalSubtitle(
  name: string,
  legalName: string | null | undefined
): boolean {
  const trimmedLegalName = legalName?.trim();
  if (!trimmedLegalName) {
    return false;
  }
  return trimmedLegalName.toLowerCase() !== name.trim().toLowerCase();
}

export function dedupeClientsById<T extends { id: string }>(clients: readonly T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const client of clients) {
    if (seen.has(client.id)) {
      continue;
    }
    seen.add(client.id);
    unique.push(client);
  }

  return unique;
}

export function buildClientSelectOptions(
  clients: readonly ClientSelectLabelSource[]
): ClientSelectOption[] {
  return dedupeClientsById(clients).map((client) => {
    const legalName = client.legal_name?.trim();
    const showLegalSubtitle = shouldShowClientLegalSubtitle(client.name, legalName);

    return {
      value: client.id,
      label: client.name,
      ...(showLegalSubtitle ? { description: legalName } : {}),
    };
  });
}
