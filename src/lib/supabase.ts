import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !publishableKey) {
  // Falha explícita: sem as vars o login não funciona e o guard travaria tudo.
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias no .env do frontend')
}

/** Cliente público do Supabase Auth — a sessão fica no localStorage do navegador. */
export const supabase = createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** JWT de acesso da sessão atual (ou null) — enviado como Bearer pro backend. */
export async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
