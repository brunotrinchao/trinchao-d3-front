import { client } from './client'
import type { MlListing, MlListingDetail, MlListingUpdateInput, MlPicture } from '../types'

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

/** Adiciona fotos novas ao anuncio (upload multipart — backend envia pro Storage e
 * repassa a URL publica pro ML). Retorna as pictures atualizadas do anuncio. */
export async function addMlPictures(itemId: string, files: File[]): Promise<MlPicture[]> {
  const form = new FormData()
  for (const file of files) form.append('images', file)
  const { data } = await client.post<MlPicture[]>(
    `/api/marketplace/mercadolivre/listings/${itemId}/pictures`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}
