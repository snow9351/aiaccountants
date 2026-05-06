import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== PLACEHOLDER_URL &&
  !supabaseUrl.includes('YOUR_PROJECT_ID')
);

export const supabase = createClient<Database>(
  supabaseUrl ?? PLACEHOLDER_URL,
  supabaseAnonKey ?? 'placeholder-anon-key'
);
