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

/** Extrai a tag de afiliado de um link gerado pelo programa de afiliados
 * (ex: /social/usuario?matt_word=X&matt_tool=Y&ref=... ou ?tag=SEUNOME-20).
 * ref/forceInApp são tracking dinâmico — não entram. Sem dados → null. */
export function extractAffiliateTag(link: string): string | null {
  try {
    const url = new URL(link)
    const mattWord = url.searchParams.get('matt_word')
    const mattTool = url.searchParams.get('matt_tool')
    if (mattWord && mattTool) return `matt:${mattWord}:${mattTool}`
    const tag = url.searchParams.get('tag')
    if (tag) return tag
    return null
  } catch {
    return null
  }
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
