import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    if (!supabaseInstance) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in environment variables');
      }

      supabaseInstance = createClient(supabaseUrl, supabaseKey);
    }
    return (supabaseInstance as any)[prop];
  }
});
