/** Gerador de link de afiliado ML — espelho de `backend/lib/marketplace/affiliate.ts`
 * (puro, roda no cliente pra preview instantâneo sem rede). */

export type AffiliateTagFormat = 'tag' | 'matt' | null

export function validateAffiliateTag(tag: string): { formato: AffiliateTagFormat } {
  const t = tag.trim()
  if (!t) return { formato: null }
  if (/^matt:[\w-]+:[\w-]+$/.test(t)) return { formato: 'matt' }
  if (/^[\w-]+$/.test(t)) return { formato: 'tag' }
  return { formato: null }
}

export function buildAffiliateLink(productUrl: string, tag: string): string {
  if (!tag) return productUrl
  try {
    const url = new URL(productUrl)
    const { formato } = validateAffiliateTag(tag)
    if (formato === 'matt') {
      const [, mattWord, mattTool] = tag.trim().split(':')
      url.searchParams.set('matt_word', mattWord)
      url.searchParams.set('matt_tool', mattTool)
    } else if (formato === 'tag') {
      url.searchParams.set('tag', tag.trim())
    }
    return url.toString()
  } catch {
    return productUrl
  }
}
