function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
