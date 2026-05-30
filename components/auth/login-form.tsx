'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { signIn, type AuthActionResult } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'

const initialState: AuthActionResult = {}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your credentials to access the platform</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {state.error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@iconnect.com"
              disabled={isPending}
              aria-invalid={!!state.fieldErrors?.email}
              className={cn(state.fieldErrors?.email && 'border-destructive')}
            />
            {state.fieldErrors?.email && (
              <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={isPending}
              aria-invalid={!!state.fieldErrors?.password}
              className={cn(state.fieldErrors?.password && 'border-destructive')}
            />
            {state.fieldErrors?.password && (
              <p className="text-xs text-destructive">{state.fieldErrors.password[0]}</p>
            )}
          </div>

          <Button type="submit" className="w-full mt-2" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
