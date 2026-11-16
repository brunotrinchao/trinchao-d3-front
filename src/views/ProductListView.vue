<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useProductsStore } from '../stores/products'
import { assetUrl } from '../api/client'
import { hasPublishedListing } from '../composables/listingRows'
import ListingStatusBadge from '../components/ListingStatusBadge.vue'
import AppIcon from '../components/AppIcon.vue'
import { MARKETPLACES } from '../types'
import type { Marketplace, Product } from '../types'

const store = useProductsStore()
const { items, loading, error } = storeToRefs(store)

onMounted(() => store.fetchAll())

const search = ref('')

function listingOf(product: Product, marketplace: Marketplace) {
  return product.listings?.find((l) => l.marketplace === marketplace) ?? null
}

function toNumber(price: string | number): number {
  const value = typeof price === 'number' ? price : Number(price)
  return Number.isFinite(value) ? value : 0
}

function formatPrice(price: string | number): string {
  return toNumber(price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function cover(product: Product): string | null {
  const first = [...(product.images ?? [])].sort((a, b) => a.position - b.position)[0]
  return first ? assetUrl(first.path) : null
}

const totalStock = computed(() => items.value.reduce((sum, p) => sum + p.stock, 0))
const catalogValue = computed(() =>
  items.value.reduce((sum, p) => sum + toNumber(p.price) * p.stock, 0),
)
const publishedCount = computed(() => items.value.filter(hasPublishedListing).length)

// Esta tela so mostra rascunhos: publicado tem ≥1 listing published e mora em /publicados.
const drafts = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter(
    (p) => !hasPublishedListing(p) && (q === '' || p.title.toLowerCase().includes(q)),
  )
})
</script>

<template>
  <section class="mx-auto grid max-w-6xl gap-6">
    <header>
      <h1 class="page-title">Produtos</h1>
      <p class="page-sub">Rascunhos — produtos ainda não publicados. Publicados ficam em "Publicados".</p>
    </header>

    <!-- Indicadores -->
    <div>
      <h2 class="eyebrow mb-3">Catálogo</h2>
      <div class="grid gap-4 sm:grid-cols-3">
      <article class="card p-5">
        <div class="flex items-center gap-2.5 text-sm text-ink-2">
          <span class="icon-chip size-8 rounded-lg"><AppIcon name="layers" :size="16" /></span>
          Rascunhos
        </div>
        <p class="num mt-3 text-[30px] font-semibold leading-none">{{ items.length - publishedCount }}</p>
        <p class="mt-2 text-[13px] text-muted">
          <RouterLink to="/publicados" class="underline">
            <span class="num">{{ publishedCount }}</span> publicado(s) em marketplaces
          </RouterLink>
        </p>
      </article>
      <article class="card p-5">
        <div class="flex items-center gap-2.5 text-sm text-ink-2">
          <span class="icon-chip size-8 rounded-lg"><AppIcon name="box" :size="16" /></span>
          Estoque total
        </div>
        <p class="num mt-3 text-[30px] font-semibold leading-none">{{ totalStock }}</p>
        <p class="mt-2 text-[13px] text-muted">unidades em todos os produtos</p>
      </article>
      <article class="card p-5">
        <div class="flex items-center gap-2.5 text-sm text-ink-2">
          <span class="icon-chip size-8 rounded-lg"><AppIcon name="wallet" :size="16" /></span>
          Valor em estoque
        </div>
        <p class="num mt-3 text-[30px] font-semibold leading-none">
          {{ catalogValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}
        </p>
        <p class="mt-2 text-[13px] text-muted">preço × estoque</p>
      </article>
      </div>
    </div>

    <!-- Lista -->
    <div class="card overflow-hidden">
      <header class="card-head !pb-5">
        <div>
          <h2 class="card-title">Seus rascunhos</h2>
          <p class="card-sub">
            <span class="num">{{ drafts.length }}</span> de
            <span class="num">{{ items.length }}</span> produto(s)
          </p>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <div class="adorn adorn-start w-48">
            <span class="adorn-start-el"><AppIcon name="search" :size="14" /></span>
            <input v-model="search" class="input input-sm" placeholder="Buscar produto…" />
          </div>
        </div>
      </header>

      <p v-if="loading" class="px-6 pb-8 text-sm text-muted">Carregando…</p>
      <div v-else-if="error" class="alert alert-bad mx-5 mb-5 sm:mx-6">
        <AppIcon name="alert" :size="18" />
        <span>{{ error }}</span>
      </div>
      <div v-else-if="items.length === 0" class="grid place-items-center gap-3 px-6 pb-12 pt-6 text-center">
        <span class="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
          <AppIcon name="box" :size="22" />
        </span>
        <p class="font-medium">Nenhum produto cadastrado ainda</p>
        <RouterLink to="/products/new" class="btn btn-primary btn-sm">
          <AppIcon name="plus" :size="14" />
          Criar primeiro produto
        </RouterLink>
      </div>
      <p v-else-if="drafts.length === 0" class="px-6 pb-10 pt-4 text-sm text-muted">
        {{ search ? 'Nenhum produto corresponde à busca.' : 'Tudo publicado — nenhum rascunho pendente.' }}
      </p>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[720px] text-sm">
          <thead class="table-head">
            <tr>
              <th>Produto</th>
              <th>Preço</th>
              <th>Estoque</th>
              <th>Marketplaces</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in drafts" :key="product.id" class="table-row">
              <td>
                <RouterLink :to="`/products/${product.id}`" class="flex items-center gap-3">
                  <span
                    class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-panel text-faint"
                  >
                    <img v-if="cover(product)" :src="cover(product) ?? undefined" alt="" class="size-full object-cover" />
                    <AppIcon v-else name="image" :size="18" />
                  </span>
                  <span class="font-medium text-ink">{{ product.title }}</span>
                </RouterLink>
              </td>
              <td class="num font-medium">{{ formatPrice(product.price) }}</td>
              <td>
                <span class="num" :class="product.stock === 0 ? 'text-bad-600' : ''">
                  {{ product.stock }}
                </span>
              </td>
              <td>
                <div class="flex flex-wrap gap-1.5">
                  <ListingStatusBadge
                    v-for="marketplace in MARKETPLACES"
                    :key="marketplace"
                    :marketplace="marketplace"
                    :listing="listingOf(product, marketplace)"
                  />
                </div>
              </td>
              <td class="text-right">
                <RouterLink :to="`/products/${product.id}`" class="btn btn-secondary btn-sm">
                  <AppIcon name="edit" :size="14" />
                  Editar
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
