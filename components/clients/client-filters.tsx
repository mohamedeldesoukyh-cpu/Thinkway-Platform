'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CLIENT_CATEGORIES } from '@/lib/constants/app'

interface Props {
  search?: string
  status?: string
  tier?: string
  industry?: string
}

const STATUSES = [
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'churned',  label: 'Churned' },
  { value: 'on_hold',  label: 'On Hold' },
]

const TIERS = [
  { value: 'standard',   label: 'Standard' },
  { value: 'premium',    label: 'Premium' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'strategic',  label: 'Strategic' },
]

export function ClientFilters({ search, status, tier, industry }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = useState(search ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSearchValue(search ?? '')
  }, [search])

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => updateParam('search', value), 400)
  }

  const hasFilters = !!(search || status || tier || industry)

  const clearAll = () => {
    setSearchValue('')
    router.push(pathname)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-48 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <Select value={status ?? ''} onValueChange={(v) => updateParam('status', v === '_all' ? '' : v)}>
        <SelectTrigger className="h-8 w-32 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={tier ?? ''} onValueChange={(v) => updateParam('tier', v === '_all' ? '' : v)}>
        <SelectTrigger className="h-8 w-32 text-sm">
          <SelectValue placeholder="Tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All tiers</SelectItem>
          {TIERS.map((t) => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={industry ?? ''} onValueChange={(v) => updateParam('industry', v === '_all' ? '' : v)}>
        <SelectTrigger className="h-8 w-44 text-sm">
          <SelectValue placeholder="Industry" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All industries</SelectItem>
          {CLIENT_CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 gap-1 text-xs text-muted-foreground">
          <X className="size-3" />
          Clear
        </Button>
      )}
    </div>
  )
}
