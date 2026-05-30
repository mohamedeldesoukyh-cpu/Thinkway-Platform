export const AUTH_CONFIG = {
  providers: {
    email: true,
    google: false,
    microsoft: false,
  },

  redirects: {
    afterSignIn: '/dashboard',
    afterSignOut: '/login',
    afterRegister: '/dashboard',
  },

  session: {
    maxAgeSeconds: 60 * 60 * 24 * 7,
    refreshThresholdSeconds: 60 * 60,
  },

  password: {
    minLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSpecialChar: false,
  },

  mfa: {
    required: ['admin', 'finance'] as string[],
    optional: ['director', 'manager'] as string[],
  },
} as const
