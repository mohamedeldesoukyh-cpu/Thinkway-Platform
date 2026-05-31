function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getSupabaseKey(): string {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (publishableKey) {
    return publishableKey;
  }

  return getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = getSupabaseKey();
