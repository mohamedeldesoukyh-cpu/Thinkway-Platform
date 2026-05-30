/**
 * Supabase database type definitions.
 * This file will be overwritten by the Supabase CLI once the schema is deployed.
 * Run: npx supabase gen types typescript --project-id <your-project-id> > types/database.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          role: string
          team: string | null
          reports_to_id: string | null
          status: string
          organization_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          role?: string
          team?: string | null
          reports_to_id?: string | null
          status?: string
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
