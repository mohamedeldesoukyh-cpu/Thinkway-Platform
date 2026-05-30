'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AUTH_CONFIG } from './config'
import { ROUTES } from '@/lib/constants/routes'
import { z } from 'zod'

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export interface AuthActionResult {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function signIn(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return {
      error:
        error.message === 'Invalid login credentials'
          ? 'Incorrect email or password.'
          : 'An error occurred. Please try again.',
    }
  }

  redirect(AUTH_CONFIG.redirects.afterSignIn)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(ROUTES.AUTH.LOGIN)
}
