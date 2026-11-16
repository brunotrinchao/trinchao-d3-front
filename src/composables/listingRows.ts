import { assetUrl } from '../api/client'
import type { Marketplace, MlListing, Product } from '../types'
import { MARKETPLACES } from '../types'

export type Origin = 'local' | 'remote'
export type Tone = 'pill-ok' | 'pill-warn' | 'pill-bad' | 'pill-neutral'

export interface Row {
  key: string
  origin: Origin
  marketplace: Marketplace
  title: string
  price: number
  quantity: number
  statusLabel: string
  statusTone: Tone
  /** status cru do ML — alimenta os botoes de acao (pausar/ativar/encerrar) */
  rawStatus: string | null
  thumbnail: string | null
  permalink: string | null
  productId: string | null
  mlItemId: string | null
  familyId: string | null
  familyName: string | null
}

export const mlLiveStatus: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'ativo', tone: 'pill-ok' },
  paused: { label: 'pausado', tone: 'pill-warn' },
  closed: { label: 'encerrado', tone: 'pill-bad' },
  under_review: { label: 'em revisão', tone: 'pill-warn' },
}

const localStatus: Record<string, { label: string; tone: Tone }> = {
  published: { label: 'publicado', tone: 'pill-ok' },
  pending: { label: 'pendente', tone: 'pill-warn' },
  failed: { label: 'falhou', tone: 'pill-bad' },
}

function cover(product: Product): string | null {
  const first = [...(product.images ?? [])].sort((a, b) => a.position - b.position)[0]
  return first ? assetUrl(first.path) : null
}

/** Produtos locais com pelo menos uma tentativa de publicacao (qualquer status), enriquecidos
 * com o status real ao vivo do ML quando existe match por externalId. */
function localRows(products: Product[], mlLiveById: Map<string, MlListing>): Row[] {
  const rows: Row[] = []
  for (const product of products) {
    for (const marketplace of MARKETPLACES) {
      const listing = product.listings?.find((l) => l.marketplace === marketplace)
      if (!listing) continue

      const live = marketplace === 'mercadolivre' && listing.externalId
        ? mlLiveById.get(listing.externalId)
        : undefined

      // Com item ao vivo: status/preco/estoque reais. Sem match: cai no status local —
      // "publicado" sem match no ML vira "inativo" (achavamos publicado, sumiu de la).
      const status = live
        ? mlLiveStatus[live.status] ?? { label: live.status, tone: 'pill-neutral' as const }
        : listing.status === 'published' && marketplace === 'mercadolivre'
          ? { label: 'inativo', tone: 'pill-bad' as const }
          : localStatus[listing.status] ?? { label: listing.status, tone: 'pill-neutral' as const }

      rows.push({
        key: `local-${product.id}-${marketplace}`,
        origin: 'local',
        marketplace,
        title: product.title,
        price: live ? live.price : Number(product.price) || 0,
        quantity: live ? live.availableQuantity : product.stock,
        statusLabel: status.label,
        statusTone: status.tone,
        rawStatus: live?.status ?? null,
        thumbnail: live?.thumbnail ?? cover(product),
        permalink: live?.permalink ?? null,
        productId: product.id,
        mlItemId: live?.id ?? null,
        familyId: live?.familyId ?? null,
        familyName: live?.familyName ?? null,
      })
    }
  }
  return rows
}

/** Anuncios ativos no ML que não tem Product local correspondente (criados fora do app). */
function remoteRows(products: Product[], mlListings: MlListing[]): Row[] {
  const localExternalIds = new Set(
    products.flatMap((p) =>
      (p.listings ?? [])
        .filter((l) => l.marketplace === 'mercadolivre' && l.externalId)
        .map((l) => l.externalId as string),
    ),
  )
  return mlListings
    .filter((item) => !localExternalIds.has(item.id))
    .map((item) => {
      const status = mlLiveStatus[item.status] ?? { label: item.status, tone: 'pill-neutral' as const }
      return {
        key: `remote-mercadolivre-${item.id}`,
        origin: 'remote' as const,
        marketplace: 'mercadolivre' as const,
        title: item.title,
        price: item.price,
        quantity: item.availableQuantity,
        statusLabel: status.label,
        statusTone: status.tone,
        rawStatus: item.status,
        thumbnail: item.thumbnail,
        permalink: item.permalink,
        productId: null,
        mlItemId: item.id,
        familyId: item.familyId,
        familyName: item.familyName,
      }
    })
}

/** Junta produtos locais (publicados em qualquer marketplace) + anuncios direto no ML sem
 * Product local. Usado tanto no dashboard (agregados) quanto no painel de anuncios (listagem). */
export function buildListingRows(products: Product[], mlListings: MlListing[]): Row[] {
  const mlLiveById = new Map(mlListings.map((item) => [item.id, item]))
  return [...localRows(products, mlLiveById), ...remoteRows(products, mlListings)]
}

export interface FamilyGroup {
  key: string
  familyName: string
  marketplace: Marketplace
  origin: Origin
  memberCount: number
  totalQuantity: number
  minPrice: number
  maxPrice: number
  thumbnail: string | null
  statusLabel: string
  statusTone: Tone
  children: Row[]
}

export type DisplayItem = { kind: 'row'; row: Row } | { kind: 'group'; group: FamilyGroup }

/** Variacoes de cor/tamanho no ML viram items separados com mesmo family_id — agrupa pra nao
 * listar "item a item"; edicao de cada variacao fica dentro do grupo expandido. */
export function groupByFamily(rows: Row[]): DisplayItem[] {
  const groups = new Map<string, Row[]>()
  const singles: Row[] = []

  for (const row of rows) {
    if (!row.familyId) {
      singles.push(row)
      continue
    }
    const key = `${row.origin}-${row.marketplace}-${row.familyId}`
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }

  const result: DisplayItem[] = []
  for (const [key, children] of groups) {
    if (children.length < 2) {
      singles.push(...children)
      continue
    }
    const prices = children.map((c) => c.price)
    const statuses = new Set(children.map((c) => c.statusLabel))
    result.push({
      kind: 'group',
      group: {
        key,
        familyName: children[0].familyName ?? children[0].title,
        marketplace: children[0].marketplace,
        origin: children[0].origin,
        memberCount: children.length,
        totalQuantity: children.reduce((sum, c) => sum + c.quantity, 0),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        thumbnail: children[0].thumbnail,
        statusLabel: statuses.size === 1 ? children[0].statusLabel : 'variado',
        statusTone: statuses.size === 1 ? children[0].statusTone : 'pill-neutral',
        children,
      },
    })
  }
  for (const row of singles) result.push({ kind: 'row', row })
  return result
}

export interface MarketplaceLine {
  marketplace: Marketplace
  /** vazio = não publicado nesse marketplace — linha placeholder com ação "Publicar". */
  rows: Row[]
}

export interface ProductGroup {
  key: string
  /** null = anúncio remoto (criado fora do app, sem Product local). */
  productId: string | null
  title: string
  thumbnail: string | null
  lines: MarketplaceLine[]
}

/** Agrupa as linhas por produto: card com uma linha por marketplace. Marketplace sem row
 * vira linha vazia (placeholder "não publicado"). Anúncios remotos agrupam por family_id
 * (variações de cor/tamanho criadas fora do app) e ficam em grupos próprios. */
export function groupByProduct(rows: Row[], products: Product[]): ProductGroup[] {
  const byProduct = new Map<string, Row[]>()
  const remoteGroups = new Map<string, Row[]>()

  for (const row of rows) {
    if (!row.productId) {
      const key = row.familyId ? `remote-${row.marketplace}-${row.familyId}` : `remote-${row.key}`
      const list = remoteGroups.get(key)
      if (list) list.push(row)
      else remoteGroups.set(key, [row])
      continue
    }
    const list = byProduct.get(row.productId)
    if (list) list.push(row)
    else byProduct.set(row.productId, [row])
  }

  const groups: ProductGroup[] = []
  for (const [productId, productRows] of byProduct) {
    const product = products.find((p) => p.id === productId)
    groups.push({
      key: `product-${productId}`,
      productId,
      title: product?.title ?? productRows[0].title,
      thumbnail: productRows[0].thumbnail ?? (product ? cover(product) : null),
      lines: MARKETPLACES.map((marketplace) => ({
        marketplace,
        rows: productRows.filter((r) => r.marketplace === marketplace),
      })),
    })
  }
  for (const [key, groupRows] of remoteGroups) {
    groups.push({
      key,
      productId: null,
      title: groupRows[0].familyName ?? groupRows[0].title,
      thumbnail: groupRows[0].thumbnail,
      lines: [{ marketplace: groupRows[0].marketplace, rows: groupRows }],
    })
  }
  return groups
}

/** Produto conta como publicado? ≥1 listing em `published` (fechado/excluído deixa de contar). */
export function hasPublishedListing(product: Product): boolean {
  return (product.listings ?? []).some((l) => l.status === 'published')
}
