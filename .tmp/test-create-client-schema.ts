import { createClientSchema } from "../features/clients/schemas";

const samples: Record<string, unknown>[] = [
  {
    group_id: "",
    name: "Mind Share Egypt LTD",
    agency_or_direct: "agency",
    status: "prospect",
    currency: "EGP",
    country: "EG",
    notes: "",
  },
  {
    group_id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Mind Share Egypt LTD",
    agency_or_direct: "agency",
    status: "prospect",
    currency: "EGP",
    country: "EG",
    notes: "",
  },
  {
    group_id: "WPP",
    name: "Mind Share Egypt LTD",
    agency_or_direct: "agency",
    status: "prospect",
    currency: "EGP",
    country: "EG",
    notes: "",
  },
];

for (const raw of samples) {
  const result = createClientSchema.safeParse(raw);
  console.log(
    JSON.stringify(
      {
        group_id: raw.group_id,
        ok: result.success,
        errors: result.success ? null : result.error.flatten().fieldErrors,
      },
      null,
      2
    )
  );
}
