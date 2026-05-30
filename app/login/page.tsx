import { LoginForm } from '@/components/auth/login-form'
import { PLATFORM } from '@/config/platform'

export default function LoginPage() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand shadow-lg">
          <span className="text-lg font-bold text-white">TW</span>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">{PLATFORM.name}</h1>
          <p className="text-sm text-muted-foreground">{PLATFORM.tagline}</p>
        </div>
      </div>

      <LoginForm />

      <p className="text-center text-xs text-muted-foreground">
        {PLATFORM.name} · {PLATFORM.client} · Internal Use Only
      </p>
    </div>
  )
}
