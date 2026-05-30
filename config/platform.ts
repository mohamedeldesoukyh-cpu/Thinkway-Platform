export const PLATFORM = {
  name: 'Thinkway',
  tagline: 'Campaign ROI Management',
  client: 'IConnect',

  brand: {
    primaryColor: '#1D9E75',
    primaryColorOklch: 'oklch(0.618 0.141 162)',
    campaignPrefix: 'TW',
    invoicePrefix: 'INV',
    clientCodePrefix: 'C',
  },

  fiscal: {
    yearStartMonth: 1,
    budgetVersions: ['Q0', 'Q0_UPDATE', 'Q1', 'Q2', 'Q3'] as const,
    clientConversionMonths: 3,
  },

  defaults: {
    currency: 'USD' as const,
    paymentTermsDays: 30,
    pageSize: 25,
    maxPageSize: 100,
    timezone: 'Asia/Dubai',
  },

  limits: {
    maxFileUploadMb: 50,
    maxBulkOperations: 100,
    maxTagsPerRecord: 20,
    maxCampaignInfluencers: 26,
    teamMemberLimits: {
      starter: 5,
      growth: 20,
      enterprise: -1,
    },
  },

  features: {
    multiCurrency: true,
    advancedReports: true,
    customWorkflows: true,
    aiFeatures: false,
    creatorPortal: false,
    clientPortal: false,
    mobileApps: false,
  },
} as const

export type PlatformConfig = typeof PLATFORM
export type BudgetVersion = typeof PLATFORM.fiscal.budgetVersions[number]
