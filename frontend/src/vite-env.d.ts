/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_AUTH_REDIRECT_URL: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_TEMPORAL_UI_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
