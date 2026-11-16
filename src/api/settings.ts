import { client } from './client'

/** Tag de afiliado ML (formato 1 `SEUNOME-20` ou formato 2 `matt:usuario:toolid`). */
export async function getAffiliateTag(): Promise<string | null> {
  const { data } = await client.get<{ affiliateTag: string | null }>('/api/settings/affiliate')
  return data.affiliateTag
}

export async function putAffiliateTag(tag: string): Promise<string | null> {
  const { data } = await client.put<{ affiliateTag: string | null }>('/api/settings/affiliate', {
    tag,
  })
  return data.affiliateTag
}
