/**
 * Adapters mapping `influencers` row columns to the self-contained enrichment
 * UI component props. Keeps the integration surface for Phase 2.5 tiny: pass an
 * influencer row, get ready-to-render props.
 */

import type { AudienceDemographics } from "./components/audience-demographics-section";
import type { DemographicSource } from "./status";

type InfluencerDemographicColumns = {
  audience_age_13_17?: number | null;
  audience_age_18_24?: number | null;
  audience_age_25_34?: number | null;
  audience_age_35_44?: number | null;
  audience_age_45_54?: number | null;
  audience_age_55_plus?: number | null;
  audience_gender_male?: number | null;
  audience_gender_female?: number | null;
  audience_gender_unknown?: number | null;
  audience_top_countries?: Array<{ code?: string; name?: string; percent?: number }> | null;
  audience_top_cities?: Array<{ name?: string; percent?: number }> | null;
  demographic_source?: DemographicSource | null;
};

export function audienceDemographicsFromInfluencer(
  row: InfluencerDemographicColumns | null | undefined
): AudienceDemographics {
  return {
    age: {
      "13_17": row?.audience_age_13_17 ?? null,
      "18_24": row?.audience_age_18_24 ?? null,
      "25_34": row?.audience_age_25_34 ?? null,
      "35_44": row?.audience_age_35_44 ?? null,
      "45_54": row?.audience_age_45_54 ?? null,
      "55_plus": row?.audience_age_55_plus ?? null,
    },
    gender: {
      male: row?.audience_gender_male ?? null,
      female: row?.audience_gender_female ?? null,
      unknown: row?.audience_gender_unknown ?? null,
    },
    topCountries: row?.audience_top_countries ?? null,
    topCities: row?.audience_top_cities ?? null,
    source: row?.demographic_source ?? "unavailable",
  };
}
