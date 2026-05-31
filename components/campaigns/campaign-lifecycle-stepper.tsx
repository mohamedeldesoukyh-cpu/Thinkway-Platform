'use client'

import { useTransition, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { advanceLifecycle } from '@/app/actions/campaigns'
import { CAMPAIGN_LIFECYCLE_STAGES } from '@/lib/constants/app'
import { cn } from '@/lib/utils'

interface Props {
  campaignId: string
  currentStage: number
}

export function CampaignLifecycleStepper({ campaignId, currentStage }: Props) {
  const [optimisticStage, setOptimisticStage] = useState(currentStage)
  const [, startTransition] = useTransition()

  const handleAdvance = (stage: number) => {
    if (stage === optimisticStage) return
    const prev = optimisticStage
    setOptimisticStage(stage)
    startTransition(async () => {
      const result = await advanceLifecycle(campaignId, stage)
      if (result.error) {
        setOptimisticStage(prev)
        toast.error(result.error)
      } else {
        const info = CAMPAIGN_LIFECYCLE_STAGES.find((s) => s.step === stage)
        toast.success(`Stage updated to "${info?.label}"`)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Lifecycle</p>
        <span className="text-xs text-muted-foreground">
          Stage {optimisticStage} of {CAMPAIGN_LIFECYCLE_STAGES.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-brand transition-all duration-300"
          style={{ width: `${(optimisticStage / CAMPAIGN_LIFECYCLE_STAGES.length) * 100}%` }}
        />
      </div>

      {/* Stage list */}
      <div className="grid grid-cols-1 gap-1">
        {CAMPAIGN_LIFECYCLE_STAGES.map((stage) => {
          const isDone    = stage.step < optimisticStage
          const isCurrent = stage.step === optimisticStage
          const isFuture  = stage.step > optimisticStage

          return (
            <button
              key={stage.step}
              type="button"
              onClick={() => handleAdvance(stage.step)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                'hover:bg-muted/60',
                isCurrent && 'bg-brand/8 hover:bg-brand/10',
                'disabled:pointer-events-none'
              )}
            >
              {/* Stage icon */}
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  isDone    && 'bg-brand text-white',
                  isCurrent && 'bg-brand text-white ring-2 ring-brand/30',
                  isFuture  && 'bg-muted text-muted-foreground'
                )}
              >
                {isDone ? <Check className="size-3.5" /> : stage.step}
              </span>

              <span
                className={cn(
                  'flex-1 text-sm',
                  isCurrent && 'font-semibold text-foreground',
                  isDone    && 'text-muted-foreground line-through',
                  isFuture  && 'text-muted-foreground'
                )}
              >
                {stage.label}
              </span>

              {isCurrent && <ChevronRight className="size-4 text-brand shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
