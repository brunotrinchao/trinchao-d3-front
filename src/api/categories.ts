import { client } from './client'
import type { CategorySearchResult, Marketplace, MlCategoryAttribute } from '../types'

/** Forma crua tolerada: o contrato não fixa os nomes dos campos da taxonomia. */
interface RawCategory {
  id?: string
  categoryId?: string
  path?: string
  categoryPath?: string
  name?: string
}

function normalize(raw: RawCategory): CategorySearchResult {
  const id = raw.id ?? raw.categoryId ?? ''
  return { id, path: raw.path ?? raw.categoryPath ?? raw.name ?? id }
}

export async function searchCategories(
  marketplace: Marketplace,
  q: string,
): Promise<CategorySearchResult[]> {
  const { data } = await client.get<RawCategory[]>(`/api/categories/${marketplace}`, {
    params: { q },
  })
  return (Array.isArray(data) ? data : []).map(normalize).filter((c) => c.id !== '')
}

/** So existe pra Mercado Livre por enquanto (unico marketplace com API de atributos ligada). */
export async function fetchRequiredCategoryAttributes(categoryId: string): Promise<MlCategoryAttribute[]> {
  const { data } = await client.get<MlCategoryAttribute[]>('/api/categories/mercadolivre/attributes', {
    params: { categoryId },
  })
  return Array.isArray(data) ? data : []
}

/** Navegação hierárquica (ML): subcategorias de uma categoria. */
export interface CategoryNode {
  id: string
  name: string
  hasChildren: boolean
}

export async function fetchCategoryChildren(categoryId: string): Promise<CategoryNode[]> {
  const { data } = await client.get<CategoryNode[]>(`/api/categories/mercadolivre/${categoryId}`)
  return Array.isArray(data) ? data : []
}
