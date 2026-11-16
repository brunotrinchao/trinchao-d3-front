import { client } from './client'
import type { MarketplaceAuthStatus } from '../types'

export async function fetchAuthStatus(): Promise<MarketplaceAuthStatus[]> {
  const { data } = await client.get<MarketplaceAuthStatus[]>('/api/auth/status')
  return Array.isArray(data) ? data : []
}
