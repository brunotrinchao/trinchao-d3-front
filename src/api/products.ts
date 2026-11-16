import { client } from './client'
import type {
  CategoryMapInput,
  CustomFieldsInput,
  Marketplace,
  MarketplaceListing,
  Product,
  ProductCategoryMap,
  ProductCustomField,
  ProductDetail,
  ProductImage,
  ProductInput,
  ProductVariation,
  ProductMarketplaceSettings,
  MarketplaceSettingsInput,
  VariationInput,
} from '../types'

export async function listProducts(): Promise<Product[]> {
  const { data } = await client.get<Product[]>('/api/products')
  return data
}

export async function getProduct(id: string): Promise<ProductDetail> {
  const { data } = await client.get<ProductDetail>(`/api/products/${id}`)
  return data
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data } = await client.post<Product>('/api/products', input)
  return data
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const { data } = await client.put<Product>(`/api/products/${id}`, input)
  return data
}

export async function deleteProduct(id: string): Promise<void> {
  await client.delete(`/api/products/${id}`)
}

export async function uploadImages(id: string, files: File[]): Promise<ProductImage[]> {
  const form = new FormData()
  for (const file of files) form.append('images', file)
  const { data } = await client.post<ProductImage[]>(`/api/products/${id}/images`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteImage(id: string, imageId: string): Promise<void> {
  await client.delete(`/api/products/${id}/images/${imageId}`)
}

/** Reordena as imagens: `imageIds` deve conter todas as imagens do produto, sem repetir. */
export async function reorderImages(id: string, imageIds: string[]): Promise<ProductImage[]> {
  const { data } = await client.put<ProductImage[]>(`/api/products/${id}/images/order`, { imageIds })
  return data
}

export async function createVariation(id: string, input: VariationInput): Promise<ProductVariation> {
  const { data } = await client.post<ProductVariation>(`/api/products/${id}/variations`, input)
  return data
}

export async function updateVariation(
  id: string,
  variationId: string,
  input: VariationInput,
): Promise<ProductVariation> {
  const { data } = await client.put<ProductVariation>(
    `/api/products/${id}/variations/${variationId}`,
    input,
  )
  return data
}

export async function deleteVariation(id: string, variationId: string): Promise<void> {
  await client.delete(`/api/products/${id}/variations/${variationId}`)
}

export async function saveCategoryMap(
  id: string,
  input: CategoryMapInput,
): Promise<ProductCategoryMap> {
  const { data } = await client.put<ProductCategoryMap>(`/api/products/${id}/category-map`, input)
  return data
}

/** Substitui o conjunto inteiro de campos customizados do produto. */
export async function saveCustomFields(
  id: string,
  input: CustomFieldsInput,
): Promise<ProductCustomField[]> {
  const { data } = await client.put<ProductCustomField[]>(
    `/api/products/${id}/custom-fields`,
    input,
  )
  return data
}

/** Upsert das settings por marketplace — campo `null` limpa o override. */
export async function saveMarketplaceSettings(
  id: string,
  marketplace: Marketplace,
  input: MarketplaceSettingsInput,
): Promise<ProductMarketplaceSettings> {
  const { data } = await client.put<ProductMarketplaceSettings>(
    `/api/products/${id}/marketplace-settings/${marketplace}`,
    input,
  )
  return data
}

export async function publishProduct(
  id: string,
  marketplace: Marketplace,
): Promise<MarketplaceListing> {
  const { data } = await client.post<MarketplaceListing>(
    `/api/products/${id}/publish/${marketplace}`,
  )
  return data
}
