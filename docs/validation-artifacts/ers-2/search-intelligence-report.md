# ERS-2 Search Intelligence Report

Generated: 2026-07-04T01:28:01.677Z

## Connectivity

Node: v24.16.0
Supabase origin: https://hsxrewjcbvmbkqdlzjhs.supabase.co
Hostname: hsxrewjcbvmbkqdlzjhs.supabase.co
Metrics audit REST URL: https://hsxrewjcbvmbkqdlzjhs.supabase.co/rest/v1/campaign_publications?select=id%2Ccampaign_header_id%2Cviews%2Clikes%2Ccomments%2Cshares%2Csaves%2Cengagements%2Cengagement_rate&content_url=not.is.null
Root cause category: tls_certificate

Probes:
  [OK] dns.lookup (29ms)
        addresses=104.18.38.10 (IPv4), 172.64.149.246 (IPv4); ipv4=2; ipv6=0
  [FAIL] dns.lookup.ipv6 (3ms)
        ipv6_count=0
  [FAIL] tls.handshake (152ms)
        error: TLS connected but certificate not authorized
  [OK] fetch.origin (191ms)
        HTTP 404 Not Found
  [OK] fetch.rest (405ms)
        HTTP 200 OK

Remediation:
  - TLS handshake to Supabase failed.
  - Check proxy/firewall SSL inspection and certificate trust.
  - Try NODE_OPTIONS=--use-system-ca on Node 22+.

## Summary

| Scenario | Industry | Categories | Chosen stage | Total | Search calls | Result |
| --- | --- | --- | --- | ---: | ---: | --- |
| BabyJoy → parenting creators | Baby Care | Parenting, Motherhood, Family, Baby | A_category_country | 126 | 1 | PASS |
| Adidas → fitness/sports | Sports & Fitness | Lifestyle, Fitness, Sports, Running | A_category_country | 1623 | 1 | PASS |
| Luxury hotel Dubai → travel/luxury | Luxury & Hospitality | Luxury, Travel, Lifestyle, Fashion | B_category_only | 2551 | 1 | PASS |
| Travel Egypt | Travel | Travel, Lifestyle, Adventure, Hospitality | direct_parse | 2733 | 1 | PASS |
| Finance | Finance | Finance, Business, Lifestyle, Tech | B_category_only | 161 | 1 | PASS |
| Tourism | Tourism | Travel, Tourism, Lifestyle, Adventure | A_category_country | 2008 | 1 | PASS |

## Progressive search model

Progressive search runs **inside a single `searchCreators` tool call** (`executeSearchCreatorsProduction`).
Stages A→E call `browseUnifiedCreators()` internally until `total > 0`. The workflow/scout layer still records **one** `searchExecuted` per search task (ERS-1 integrity preserved).

## BabyJoy → parenting creators

**Query:** Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.

### Intent extracted

```json
{
  "industry": "Baby Care",
  "industryKey": "baby",
  "audience": "mothers with babies 0–3 years",
  "categories": [
    "Parenting",
    "Motherhood",
    "Family",
    "Baby",
    "Kids",
    "Mom"
  ],
  "interests": [
    "Parenting",
    "Motherhood",
    "Family",
    "Baby",
    "Kids",
    "Mom",
    "Maternity",
    "Pregnancy",
    "Parent Life",
    "Lifestyle"
  ],
  "country": "EG",
  "platforms": [
    "instagram",
    "tiktok"
  ],
  "semanticKeywords": [
    "parenting",
    "motherhood",
    "baby",
    "family",
    "mom",
    "babyjoy",
    "diapers",
    "egypt"
  ]
}
```

### Filters generated

```json
{
  "categories": [
    "Parenting",
    "Motherhood",
    "Family",
    "Baby",
    "Kids",
    "Mom"
  ],
  "country": "EG",
  "platforms": [
    "instagram",
    "tiktok"
  ],
  "industry": "Baby Care"
}
```

### Search stages attempted

| Stage | Total | Creators |
| --- | ---: | ---: |
| Category + country (A_category_country) | 126 | 50 |

**Chosen stage:** A_category_country
**Final creator count:** 50 (total 126)

## Adidas → fitness/sports

**Query:** Adidas Egypt sportswear product launch for new running collection. Target active lifestyle 18–35 in Cairo and Alexandria. Budget EGP 4,500,000. Duration 6 weeks.

### Intent extracted

```json
{
  "industry": "Sports & Fitness",
  "industryKey": "sports_fitness",
  "audience": "active lifestyle 18–35 in Cairo and Alexandria",
  "categories": [
    "Lifestyle",
    "Fitness",
    "Sports",
    "Running",
    "Workout",
    "Athlete"
  ],
  "interests": [
    "Fitness",
    "Sports",
    "Running",
    "Workout",
    "Athlete",
    "Lifestyle",
    "Fashion"
  ],
  "country": "EG",
  "city": "Cairo",
  "platforms": [
    "instagram",
    "tiktok"
  ],
  "semanticKeywords": [
    "fitness",
    "sports",
    "running",
    "workout",
    "athlete",
    "adidas",
    "egypt",
    "sportswear"
  ]
}
```

### Filters generated

```json
{
  "categories": [
    "Lifestyle",
    "Fitness",
    "Sports",
    "Running",
    "Workout",
    "Athlete"
  ],
  "country": "EG",
  "platforms": [
    "instagram",
    "tiktok"
  ],
  "industry": "Sports & Fitness"
}
```

### Search stages attempted

| Stage | Total | Creators |
| --- | ---: | ---: |
| Category + country (A_category_country) | 1623 | 50 |

**Chosen stage:** A_category_country
**Final creator count:** 50 (total 1623)

## Luxury hotel Dubai → travel/luxury

**Query:** Find luxury hotel creators in Dubai for a 5-star resort campaign

### Intent extracted

```json
{
  "industry": "Luxury & Hospitality",
  "industryKey": "luxury",
  "categories": [
    "Luxury",
    "Travel",
    "Lifestyle",
    "Fashion",
    "Hospitality"
  ],
  "interests": [
    "Luxury",
    "Travel",
    "Lifestyle",
    "Fashion",
    "Hospitality"
  ],
  "country": "AE",
  "city": "Dubai",
  "platforms": [
    "instagram"
  ],
  "semanticKeywords": [
    "luxury",
    "travel",
    "hotel",
    "resort",
    "hospitality",
    "find",
    "creators",
    "dubai"
  ]
}
```

### Filters generated

```json
{
  "categories": [
    "Luxury",
    "Travel",
    "Lifestyle",
    "Fashion",
    "Hospitality"
  ],
  "country": "AE",
  "platforms": [
    "instagram"
  ],
  "industry": "Luxury & Hospitality"
}
```

### Search stages attempted

| Stage | Total | Creators |
| --- | ---: | ---: |
| Category + country (A_category_country) | 0 | 0 |
| Category only (B_category_only) | 2551 | 50 |

**Chosen stage:** B_category_only
**Final creator count:** 50 (total 2551)

## Travel Egypt

**Query:** Find travel creators in Egypt

### Intent extracted

```json
{
  "industry": "Travel",
  "industryKey": "travel",
  "categories": [
    "Travel",
    "Lifestyle",
    "Adventure",
    "Hospitality"
  ],
  "interests": [
    "Travel",
    "Lifestyle",
    "Adventure",
    "Hospitality"
  ],
  "country": "EG",
  "platforms": [
    "instagram",
    "tiktok"
  ],
  "semanticKeywords": [
    "travel",
    "destination",
    "adventure",
    "find",
    "creators",
    "egypt"
  ]
}
```

### Filters generated

```json
{
  "categories": [
    "Travel",
    "Lifestyle",
    "Adventure",
    "Hospitality"
  ],
  "country": "EG",
  "platforms": [
    "instagram",
    "tiktok"
  ],
  "industry": "Travel"
}
```

### Search stages attempted

| Stage | Total | Creators |
| --- | ---: | ---: |
| Direct structured parse (D_semantic_keywords) | 2733 | 31 |

**Chosen stage:** direct_parse
**Final creator count:** 31 (total 2733)

## Finance

**Query:** Emirates NBD credit card launch in UAE. Target young professionals interested in finance, banking, and wealth management.

### Intent extracted

```json
{
  "industry": "Finance",
  "industryKey": "finance",
  "audience": "young professionals interested in finance",
  "categories": [
    "Finance",
    "Business",
    "Lifestyle",
    "Tech"
  ],
  "interests": [
    "Finance",
    "Business",
    "Lifestyle",
    "Tech"
  ],
  "country": "AE",
  "platforms": [
    "instagram",
    "youtube"
  ],
  "semanticKeywords": [
    "finance",
    "banking",
    "money",
    "investment",
    "emirates",
    "nbd",
    "credit",
    "card"
  ]
}
```

### Filters generated

```json
{
  "categories": [
    "Finance",
    "Business",
    "Lifestyle",
    "Tech"
  ],
  "country": "AE",
  "platforms": [
    "instagram",
    "youtube"
  ],
  "industry": "Finance"
}
```

### Search stages attempted

| Stage | Total | Creators |
| --- | ---: | ---: |
| Category + country (A_category_country) | 0 | 0 |
| Category only (B_category_only) | 161 | 50 |

**Chosen stage:** B_category_only
**Final creator count:** 50 (total 161)

## Tourism

**Query:** Visit Egypt tourism destination marketing campaign. Promote pyramids and Red Sea resorts to international travelers.

### Intent extracted

```json
{
  "industry": "Tourism",
  "industryKey": "tourism",
  "categories": [
    "Travel",
    "Tourism",
    "Lifestyle",
    "Adventure",
    "Hospitality"
  ],
  "interests": [
    "Travel",
    "Tourism",
    "Lifestyle",
    "Adventure",
    "Hospitality"
  ],
  "country": "EG",
  "platforms": [
    "instagram",
    "tiktok",
    "youtube"
  ],
  "semanticKeywords": [
    "tourism",
    "travel",
    "destination",
    "egypt",
    "visit",
    "marketing",
    "promote",
    "pyramids"
  ]
}
```

### Filters generated

```json
{
  "categories": [
    "Travel",
    "Tourism",
    "Lifestyle",
    "Adventure",
    "Hospitality"
  ],
  "country": "EG",
  "platforms": [
    "instagram",
    "tiktok",
    "youtube"
  ],
  "industry": "Tourism"
}
```

### Search stages attempted

| Stage | Total | Creators |
| --- | ---: | ---: |
| Category + country (A_category_country) | 2008 | 50 |

**Chosen stage:** A_category_country
**Final creator count:** 50 (total 2008)

## Definition of done

- All scenarios pass: **YES**
- Single search per workflow tool path: **YES**