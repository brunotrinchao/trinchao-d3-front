// Espelha o schema Prisma definido em CONTRACT.md.

export type Marketplace = 'mercadolivre' | 'shopee'
export type ProductStatus = 'draft' | 'ready' | 'published'
export type ListingStatus = 'pending' | 'published' | 'failed'

export const MARKETPLACES: Marketplace[] = ['mercadolivre', 'shopee']

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
}

/** Cor de marca de cada marketplace — usado no badge visual (sidebar, linhas de anúncio). */
export const MARKETPLACE_TONE: Record<Marketplace, string> = {
  mercadolivre: 'bg-[#ffe600] text-[#2d3277]',
  shopee: 'bg-[#ee4d2d] text-white',
}

export interface ProductImage {
  id: string
  productId: string
  path: string
  position: number
}

export interface ProductVariation {
  id: string
  productId: string
  name: string
  sku: string
  stock: number
}

export interface ProductCategoryMap {
  id: string
  productId: string
  marketplace: Marketplace
  categoryId: string
  categoryPath: string
  attributes: Record<string, string> | null
}

/** Item de GET /api/categories/mercadolivre/attributes?categoryId= */
export interface MlCategoryAttribute {
  id: string
  name: string
  catalogRequired?: boolean
  /** obrigatorio pro anuncio (ex: MODEL, DIAMETER) mesmo sem ser catalog_required */
  required?: boolean
}

export interface MarketplaceListing {
  id: string
  productId: string
  marketplace: Marketplace
  externalId: string | null
  status: ListingStatus
  errorMessage: string | null
  publishedAt: string | null
}

/** ML: classic = comissao menor, pro = "Premium" (comissao maior, mais exposicao). */
export type MlListingTypeId = 'gold_special' | 'gold_pro'

/** Limites da descricao (linhas nao vazias). Espelha DESCRIPTION_LINES do backend. */
export const DESCRIPTION_LINES = { max: 25 } as const

export function countDescriptionLines(description: string): number {
  return description.trim().split(/\n+/).filter((line) => line.trim().length > 0).length
}

export const ML_LISTING_TYPE_LABELS: Record<MlListingTypeId, string> = {
  gold_special: 'Clássico',
  gold_pro: 'Premium',
}

/** Dados que podem ser diferentes por marketplace — campo null = usa o valor do Product. */
export interface ProductMarketplaceSettings {
  id: string
  productId: string
  marketplace: Marketplace
  title: string | null
  description: string | null
  price: string | number | null
  listingTypeId: MlListingTypeId | null
  estimatedShippingCents: number | null
  freeShipping: boolean | null
}

/** Body de PUT /api/products/:id/marketplace-settings/:marketplace. */
export interface MarketplaceSettingsInput {
  title?: string | null
  description?: string | null
  price?: number | null
  listingTypeId?: MlListingTypeId | null
  estimatedShippingCents?: number | null
  freeShipping?: boolean | null
}

/** Resposta de GET /api/marketplace/mercadolivre/fee — comissão exata do ML, não estimativa. */
export interface MlFee {
  listingTypeId: string
  listingTypeName: string
  saleFeeAmount: number
}

/** Resposta de GET /api/marketplace/mercadolivre/sales-stats — vendas do mês corrente
 * (Orders API) + saldo Mercado Pago. Fonte que falha vem `null` (nunca 0 falso). */
export interface MlSalesStats {
  vendasMes: {
    quantidade: number
    valorBruto: number
    taxas: number
    ticketMedio: number
  } | null
  recebidoTotal: {
    disponivel: number
    aLiberar: number
    total: number
  } | null
}

/** Pedido do vendedor (DTO de GET /api/marketplace/mercadolivre/orders). */
export interface MlOrder {
  id: string
  dateCreated: string
  status: string
  statusPagamento: 'pago' | 'pendente' | 'recusado'
  comprador: { nickname: string; nome: string }
  itens: {
    titulo: string
    quantidade: number
    precoUnitario: number
    variacao?: string
    sku?: string
  }[]
  total: number
  taxa: number
  envio: { id: string; status: string; substatus?: string } | null
}

/** Detalhe de envio (DTO de GET /api/marketplace/mercadolivre/orders/:id/shipment). */
export interface MlShipmentDetail {
  status: string
  substatus?: string
  rastreamento: string | null
  metodo: string | null
  endereco: {
    rua: string
    numero: string
    complemento?: string
    cep: string
    cidade: string
    estado: string
  } | null
}

/** Cotação de envio ME2 por cobertura (resposta real de shipping_options/free).
 * listCost = custo cheio que o vendedor paga; discount = subsídio do ML. */
export interface MlShippingQuote {
  coverage: string // ex: "all_country", "zone_1"
  listCost: number
  currencyId: string
  billableWeight: number | null
  discountRate: number | null
  discountType: string | null
  promotedAmount: number | null
  freeShippingByMeli: boolean | null
}

/** Campo customizado do produto — caracteristica fora do schema fixo (ex: "Materiais"). */
export interface ProductCustomField {
  id: string
  productId: string
  key: string
  value: string
}

/** Body de PUT /api/products/:id/custom-fields — substitui o conjunto inteiro. */
export interface CustomFieldsInput {
  fields: { key: string; value: string }[]
}

export interface Product {
  id: string
  title: string
  description: string
  // Prisma Decimal chega serializado como string (ou number, dependendo do driver).
  price: string | number
  stock: number
  weightGrams: number
  heightCm: number
  widthCm: number
  lengthCm: number
  status: ProductStatus
  affiliateTag?: string | null
  createdAt: string
  updatedAt: string
  images?: ProductImage[]
  variations?: ProductVariation[]
  listings?: MarketplaceListing[]
  categoryMaps?: ProductCategoryMap[]
  marketplaceSettings?: ProductMarketplaceSettings[]
  customFields?: ProductCustomField[]
}

/** Resposta de GET /api/products/:id — relações sempre presentes. */
export interface ProductDetail extends Product {
  images: ProductImage[]
  variations: ProductVariation[]
  listings: MarketplaceListing[]
  categoryMaps: ProductCategoryMap[]
  marketplaceSettings: ProductMarketplaceSettings[]
  customFields: ProductCustomField[]
}

/** Body de POST/PUT /api/products. */
export interface ProductInput {
  title: string
  description: string
  price: number
  stock: number
  weightGrams: number
  heightCm: number
  widthCm: number
  lengthCm: number
  affiliateTag?: string | null
}

/** Body de POST/PUT de variações. */
export interface VariationInput {
  name: string
  sku: string
  stock: number
}

/** Body de PUT /api/products/:id/category-map. */
export interface CategoryMapInput {
  marketplace: Marketplace
  categoryId: string
  categoryPath: string
  attributes?: Record<string, string>
}

/** Item de GET /api/categories/:marketplace?q= */
export interface CategorySearchResult {
  id: string
  path: string
}

/** Item de GET /api/auth/status */
export interface MarketplaceAuthStatus {
  marketplace: Marketplace
  connected: boolean
  /** Credencial existe mas token expirou — mostrar "Reconectar conta" na sidebar. */
  expired?: boolean
  /** ML: tag `user_product_seller` — conta usa o novo modelo User Products. */
  upModel?: boolean | null
  expiresAt: string | null
}

/** Item de GET /api/marketplace/mercadolivre/listings — anúncio real do ML, sem Product local. */
export interface MlListing {
  id: string
  title: string
  price: number
  availableQuantity: number
  soldQuantity: number
  status: string
  marketplace: Marketplace
  thumbnail: string | null
  permalink: string | null
  familyId: string | null
  familyName: string | null
  listingTypeId: string | null
  logisticType: string | null
  freeShipping: boolean
}

/** Body de PUT /api/marketplace/mercadolivre/listings/:itemId */
export interface MlListingUpdateInput {
  title?: string
  price?: number
  availableQuantity?: number
  status?: 'active' | 'paused' | 'closed'
  description?: string
  heightCm?: number
  widthCm?: number
  lengthCm?: number
  weightGrams?: number
  syncPicturesFromProduct?: true
  /** reordena/remove fotos JA existentes no anuncio pelos ids delas (sem upload) */
  pictureIds?: string[]
  /** frete gratis (ML: shipping.free_shipping) */
  freeShipping?: boolean
}

export interface MlPicture {
  id: string
  url: string
}

/** Resposta de GET /api/marketplace/mercadolivre/listings/:itemId — detalhe completo pro modal. */
export interface MlListingDetail extends MlListing {
  description: string
  heightCm: number
  widthCm: number
  lengthCm: number
  weightGrams: number
  pictures: MlPicture[]
}
