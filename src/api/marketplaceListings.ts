import { client } from './client'
import type { MlListing, MlListingDetail, MlListingUpdateInput } from '../types'

export async function fetchMlListings(): Promise<MlListing[]> {
  const { data } = await client.get<MlListing[]>('/api/marketplace/mercadolivre/listings')
  return Array.isArray(data) ? data : []
}

/** Detalhe completo (descricao, dimensoes, fotos) pro modal de edicao. */
export async function fetchMlListingDetail(itemId: string): Promise<MlListingDetail> {
  const { data } = await client.get<MlListingDetail>(`/api/marketplace/mercadolivre/listings/${itemId}`)
  return data
}

export async function updateMlListing(
  itemId: string,
  input: MlListingUpdateInput,
): Promise<MlListing> {
  const { data } = await client.put<MlListing>(
    `/api/marketplace/mercadolivre/listings/${itemId}`,
    input,
  )
  return data
}

/** Irreversivel no ML: fecha + marca deletado. */
export async function deleteMlListing(itemId: string): Promise<void> {
  await client.delete(`/api/marketplace/mercadolivre/listings/${itemId}`)
}

/** Importa anuncio ja existente no ML pra um Product local (idempotente). */
export async function syncMlListing(itemId: string): Promise<{ productId: string }> {
  const { data } = await client.post<{ product: { id: string } }>(
    `/api/marketplace/mercadolivre/listings/${itemId}/sync`,
  )
  return { productId: data.product.id }
}
