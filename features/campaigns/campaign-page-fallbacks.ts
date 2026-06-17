import type { CampaignFormOptions } from "@/features/campaigns/queries";

/** Minimal form options so workspace can render when secondary loaders fail. */
export const EMPTY_CAMPAIGN_FORM_OPTIONS: CampaignFormOptions = {
  groups: [],
  clients: [],
  brands: [],
  masterData: {
    categories: [],
    subcategories: [],
    currencies: [],
    countries: [],
    teams: [],
    reportTypes: [],
    paymentTerms: [],
    vrRates: [],
  },
  accountManagers: [],
};
