import { updateClientOverviewSchema } from "../features/clients/schemas";

const sample = {
  client_id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Mind Share Egypt LTD",
  legal_name: "Mind Share Egypt LTD",
  status: "active",
  group_id: "",
  country: "EG",
  city: "Cairo",
  industry: "fmcg",
  website: "",
  billing_email: "",
  billing_phone: "",
  notes: "",
  client_io_terms_text: "",
};

const withoutAgency = updateClientOverviewSchema.safeParse(sample);
console.log(
  "without agency_or_direct:",
  withoutAgency.success ? "OK" : JSON.stringify(withoutAgency.error.flatten().fieldErrors)
);

const withAgency = updateClientOverviewSchema.safeParse({
  ...sample,
  agency_or_direct: "agency",
});
console.log(
  "with agency_or_direct:",
  withAgency.success ? "OK" : JSON.stringify(withAgency.error.flatten().fieldErrors)
);
