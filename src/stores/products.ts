import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/products'
import { apiErrorMessage } from '../api/client'
import type { Product, ProductDetail } from '../types'

export const useProductsStore = defineStore('products', () => {
  const items = ref<Product[]>([])
  const details = ref<Record<string, ProductDetail>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      items.value = await api.listProducts()
    } catch (e) {
      error.value = apiErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string): Promise<ProductDetail | null> {
    loading.value = true
    error.value = null
    try {
      const detail = await api.getProduct(id)
      setDetail(detail)
      return detail
    } catch (e) {
      error.value = apiErrorMessage(e)
      return null
    } finally {
      loading.value = false
    }
  }

  /** Atualiza o cache de detalhe e a entrada correspondente na lista. */
  function setDetail(detail: ProductDetail): void {
    details.value = { ...details.value, [detail.id]: detail }
    const index = items.value.findIndex((p) => p.id === detail.id)
    items.value =
      index === -1
        ? [detail, ...items.value]
        : items.value.map((p) => (p.id === detail.id ? { ...p, ...detail } : p))
  }

  function removeFromCache(id: string): void {
    items.value = items.value.filter((p) => p.id !== id)
    const next = { ...details.value }
    delete next[id]
    details.value = next
  }

  return { items, details, loading, error, fetchAll, fetchOne, setDetail, removeFromCache }
})
