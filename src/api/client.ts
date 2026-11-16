import axios from 'axios'
import { currentAccessToken } from '../lib/supabase'

export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Sessão Supabase: toda chamada /api leva o JWT como Bearer (middleware do backend valida).
client.interceptors.request.use(async (config) => {
  const token = await currentAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** URL absoluta de um arquivo servido pelo backend (ex: uploads/<productId>/<file>). */
export function assetUrl(path: string): string {
  return `${API_URL}/${path.replace(/^\/+/, '')}`
}

/** Erro padrão do backend: sempre `{ error }`; 422 (zod) inclui `details`. */
interface ApiErrorBody {
  error?: string
  message?: string
  details?: Record<string, string[]>
}

/** Status HTTP do erro, quando houver resposta. */
export function apiErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}

/** Extrai uma mensagem legível de qualquer erro vindo do axios/backend. */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined
    const base = data?.error || data?.message || error.message
    const details = Object.entries(data?.details ?? {})
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join(' · ')
    return details === '' ? base : `${base} — ${details}`
  }
  if (error instanceof Error) return error.message
  return 'Erro desconhecido'
}
