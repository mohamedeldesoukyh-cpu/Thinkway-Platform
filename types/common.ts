export type ID = string

export type Currency = 'USD' | 'EUR' | 'GBP' | 'AED' | 'SAR' | 'QAR' | 'KWD'

export type Platform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'x'
  | 'facebook'
  | 'linkedin'
  | 'snapchat'
  | 'pinterest'
  | 'threads'

export type SortDirection = 'asc' | 'desc'

export interface SortConfig<T = string> {
  key: T
  direction: SortDirection
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  success: boolean
}

export interface ActionResult<T = unknown> {
  data?: T
  error?: string
  fieldErrors?: Record<string, string[]>
}

export interface SelectOption<T = string> {
  label: string
  value: T
  description?: string
  disabled?: boolean
}

export interface DateRange {
  from: Date | undefined
  to?: Date | undefined
}

export interface AuditFields {
  createdAt: string
  updatedAt: string
  createdBy?: ID
  updatedBy?: ID
}

export interface Address {
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode?: string
  country: string
}
