export type CityOption = { value: string; label: string };

export const CITY_OPTIONS_BY_COUNTRY: Record<string, readonly CityOption[]> = {
  AE: [
    { value: "Dubai", label: "Dubai" },
    { value: "Abu Dhabi", label: "Abu Dhabi" },
    { value: "Sharjah", label: "Sharjah" },
    { value: "Ajman", label: "Ajman" },
    { value: "Ras Al Khaimah", label: "Ras Al Khaimah" },
    { value: "Fujairah", label: "Fujairah" },
    { value: "Umm Al Quwain", label: "Umm Al Quwain" },
    { value: "Al Ain", label: "Al Ain" },
  ],
  SA: [
    { value: "Riyadh", label: "Riyadh" },
    { value: "Jeddah", label: "Jeddah" },
    { value: "Dammam", label: "Dammam" },
    { value: "Khobar", label: "Khobar" },
    { value: "Mecca", label: "Mecca" },
    { value: "Medina", label: "Medina" },
  ],
  EG: [
    { value: "Cairo", label: "Cairo" },
    { value: "Giza", label: "Giza" },
    { value: "Alexandria", label: "Alexandria" },
    { value: "6th of October", label: "6th of October" },
    { value: "New Cairo", label: "New Cairo" },
    { value: "Mansoura", label: "Mansoura" },
    { value: "Tanta", label: "Tanta" },
  ],
  QA: [
    { value: "Doha", label: "Doha" },
    { value: "Al Wakrah", label: "Al Wakrah" },
    { value: "Al Khor", label: "Al Khor" },
  ],
  KW: [
    { value: "Kuwait City", label: "Kuwait City" },
    { value: "Hawalli", label: "Hawalli" },
    { value: "Salmiya", label: "Salmiya" },
  ],
  BH: [
    { value: "Manama", label: "Manama" },
    { value: "Muharraq", label: "Muharraq" },
    { value: "Riffa", label: "Riffa" },
  ],
  OM: [
    { value: "Muscat", label: "Muscat" },
    { value: "Salalah", label: "Salalah" },
    { value: "Sohar", label: "Sohar" },
  ],
  JO: [
    { value: "Amman", label: "Amman" },
    { value: "Zarqa", label: "Zarqa" },
    { value: "Irbid", label: "Irbid" },
  ],
  LB: [
    { value: "Beirut", label: "Beirut" },
    { value: "Tripoli", label: "Tripoli" },
    { value: "Sidon", label: "Sidon" },
  ],
  US: [
    { value: "New York", label: "New York" },
    { value: "Los Angeles", label: "Los Angeles" },
    { value: "Chicago", label: "Chicago" },
    { value: "San Francisco", label: "San Francisco" },
    { value: "Miami", label: "Miami" },
  ],
  GB: [
    { value: "London", label: "London" },
    { value: "Manchester", label: "Manchester" },
    { value: "Birmingham", label: "Birmingham" },
    { value: "Edinburgh", label: "Edinburgh" },
  ],
  DE: [
    { value: "Berlin", label: "Berlin" },
    { value: "Munich", label: "Munich" },
    { value: "Frankfurt", label: "Frankfurt" },
    { value: "Hamburg", label: "Hamburg" },
  ],
  FR: [
    { value: "Paris", label: "Paris" },
    { value: "Lyon", label: "Lyon" },
    { value: "Marseille", label: "Marseille" },
  ],
  IT: [
    { value: "Milan", label: "Milan" },
    { value: "Rome", label: "Rome" },
    { value: "Turin", label: "Turin" },
  ],
  ES: [
    { value: "Madrid", label: "Madrid" },
    { value: "Barcelona", label: "Barcelona" },
    { value: "Valencia", label: "Valencia" },
  ],
  CA: [
    { value: "Toronto", label: "Toronto" },
    { value: "Vancouver", label: "Vancouver" },
    { value: "Montreal", label: "Montreal" },
  ],
  AU: [
    { value: "Sydney", label: "Sydney" },
    { value: "Melbourne", label: "Melbourne" },
    { value: "Brisbane", label: "Brisbane" },
  ],
  IN: [
    { value: "Mumbai", label: "Mumbai" },
    { value: "Delhi", label: "Delhi" },
    { value: "Bengaluru", label: "Bengaluru" },
    { value: "Chennai", label: "Chennai" },
  ],
  PK: [
    { value: "Karachi", label: "Karachi" },
    { value: "Lahore", label: "Lahore" },
    { value: "Islamabad", label: "Islamabad" },
  ],
};

export function getCityOptionsForCountry(
  countryCode: string | null | undefined
): CityOption[] {
  if (!countryCode?.trim()) {
    return [];
  }
  return [...(CITY_OPTIONS_BY_COUNTRY[countryCode] ?? [])];
}
