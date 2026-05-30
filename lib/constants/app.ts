import type { Currency, Platform } from '@/types/common'

export const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'AED', label: 'UAE Dirham', symbol: 'AED' },
  { value: 'SAR', label: 'Saudi Riyal', symbol: 'SAR' },
  { value: 'KWD', label: 'Kuwaiti Dinar', symbol: 'KWD' },
  { value: 'QAR', label: 'Qatari Riyal', symbol: 'QAR' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
]

export const IO_CURRENCIES = ['USD', 'AED', 'SAR', 'KWD', 'EGP'] as const
export type IOCurrency = typeof IO_CURRENCIES[number]

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'threads', label: 'Threads' },
]

// 15 confirmed categories per §3.4
export const CLIENT_CATEGORIES = [
  { value: 'beauty_personal_care', label: 'Beauty & Personal Care' },
  { value: 'retail_ecommerce', label: 'Retail & E-Commerce' },
  { value: 'marketing_advertising_media', label: 'Marketing, Advertising & Media' },
  { value: 'fashion_apparel', label: 'Fashion & Apparel' },
  { value: 'financial_services', label: 'Financial Services & Banking' },
  { value: 'transportation_delivery', label: 'Transportation & Delivery' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'healthcare_wellness', label: 'Healthcare & Wellness' },
  { value: 'government_sports_nonprofit', label: 'Government, Sports & Nonprofit' },
  { value: 'home_furniture', label: 'Home & Furniture' },
  { value: 'pet_animal_products', label: 'Pet & Animal Products' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'travel_hospitality', label: 'Travel & Hospitality' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'automotive', label: 'Automotive' },
] as const

// 25 pre-loaded groups per §3.3
export const PRESET_GROUPS = [
  "L'Oréal",
  'Alshaya Group',
  'Armada Group',
  'Landmark Retail Investment Co.',
  'Publicis Groupe',
  'Chalhoub Group',
  'Dentsu Group Inc.',
  'MCN',
  'OMG',
  'Assembly Global',
  'Al Tayer Group',
  'Maznexa',
  'Marcom Arabia',
  'Al Futtaim Trading LLC',
  'Abdul Samad Al Qurashi Co.',
  'Bridges',
  'Matrix',
  'Tact',
  'Digitect Agency',
  'Mullers',
  'Major Agency',
  'Ability',
  'Zamakan Agency',
  'Al Qalzam Group',
  'Apparel Group',
] as const

export const CAMPAIGN_TYPES = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'hard_roi', label: 'Hard ROI' },
  { value: 'performance', label: 'Performance' },
] as const

export const LEGAL_ENTITIES = [
  { value: 'uae', label: 'UAE Entity' },
  { value: 'ksa', label: 'KSA Entity' },
  { value: 'kwt', label: 'Kuwait Entity' },
] as const

export const TEAMS = [
  { value: 'ops', label: 'OPS' },
  { value: 'iman', label: 'Iman' },
  { value: 'finance', label: 'Finance' },
] as const

export const REPORT_TYPES = [
  { value: 'sales_ops', label: 'Sales & Ops' },
  { value: 'loreal', label: "L'Oréal" },
] as const

// Campaign lifecycle stages per §29.1
export const CAMPAIGN_LIFECYCLE_STAGES = [
  { step: 1, key: 'brief_received', label: 'Brief Received' },
  { step: 2, key: 'internal_review', label: 'Internal Review' },
  { step: 3, key: 'creator_discovery', label: 'Creator Discovery' },
  { step: 4, key: 'client_shortlist_approval', label: 'Client Shortlist Approval' },
  { step: 5, key: 'negotiation', label: 'Negotiation' },
  { step: 6, key: 'contract_signed', label: 'Contract Signed' },
  { step: 7, key: 'content_production', label: 'Content Production' },
  { step: 8, key: 'internal_content_review', label: 'Internal Review' },
  { step: 9, key: 'client_approval', label: 'Client Approval' },
  { step: 10, key: 'revision_cycle', label: 'Revision Cycle' },
  { step: 11, key: 'publishing', label: 'Publishing' },
  { step: 12, key: 'performance_collection', label: 'Performance Collection' },
  { step: 13, key: 'billing', label: 'Billing' },
  { step: 14, key: 'vendor_payment', label: 'Vendor Payment' },
  { step: 15, key: 'campaign_closure', label: 'Campaign Closure' },
] as const
