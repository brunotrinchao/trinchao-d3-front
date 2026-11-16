<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useProductsStore } from '../stores/products'
import { fetchMlListings } from '../api/marketplaceListings'
import { getProduct, publishProduct } from '../api/products'
import { apiErrorMessage } from '../api/client'
import { getMlFee } from '../api/marketplace'
import AppIcon from '../components/AppIcon.vue'
import MarketplaceBadge from '../components/MarketplaceBadge.vue'
import MlListingRow from '../components/MlListingRow.vue'
import PublishConfirmModal from '../components/PublishConfirmModal.vue'
import {
  buildListingRows,
  groupByFamily,
  groupByProduct,
  hasPublishedListing,
} from '../composables/listingRows'
import type { DisplayItem, MarketplaceLine, ProductGroup } from '../composables/listingRows'
import { MARKETPLACE_LABELS, MARKETPLACES } from '../types'
import type { Marketplace, MlListing, ProductDetail } from '../types'

const store = useProductsStore()
const { items } = storeToRefs(store)

const mlListings = ref<MlListing[]>([])
const loadingRemote = ref(true)
const remoteError = ref<string | null>(null)
const actionError = ref<string | null>(null)

async function loadRemote(): Promise<void> {
  loadingRemote.value = true
  try {
    mlListings.value = await fetchMlListings()
  } catch (e) {
    remoteError.value = apiErrorMessage(e)
  } finally {
    loadingRemote.value = false
  }
}

onMounted(async () => {
  await store.fetchAll()
  await loadRemote()
  void loadFees()
})

const marketplaceFilter = ref<'all' | Marketplace>('all')
const expanded = reactive(new Set<string>())

// ===== Fee map (comissão exata via API ML) =====
const feeMap = ref<Map<string, number>>(new Map()) // mlItemId → saleFeeAmount
const feesLoading = ref(false)

/** Busca comissão exata por combo único (price + categoryId + listingTypeId).
 * Só para itens com vendas — agrupa por combo pra minimizar chamadas API. */
async function loadFees(): Promise<void> {
  feesLoading.value = true
  try {
    const combos = new Map<string, { price: number; categoryId: string; listingTypeId: string; itemIds: string[] }>()
    for (const product of items.value) {
      const mlMap = product.categoryMaps?.find((c) => c.marketplace === 'mercadolivre')
      if (!mlMap) continue
      const mlListing = product.listings?.find((l) => l.marketplace === 'mercadolivre' && l.externalId)
      if (!mlListing?.externalId) continue
      const ml = mlListings.value.find((l) => l.id === mlListing.externalId)
      if (!ml || (ml.soldQuantity ?? 0) <= 0) continue
      const key = `${ml.price}_${mlMap.categoryId}_${ml.listingTypeId ?? 'gold_special'}`
      if (!combos.has(key)) {
        combos.set(key, { price: ml.price, categoryId: mlMap.categoryId, listingTypeId: ml.listingTypeId ?? 'gold_special', itemIds: [] })
      }
      combos.get(key)!.itemIds.push(ml.id)
    }
    const results = await Promise.all(
      [...combos.values()].map(async (combo) => {
        try {
          const fee = await getMlFee(combo.price, combo.categoryId, combo.listingTypeId)
          return { itemIds: combo.itemIds, saleFeeAmount: fee.saleFeeAmount }
        } catch { return null }
      }),
    )
    const newMap = new Map<string, number>()
    for (const r of results) {
      if (!r) continue
      for (const id of r.itemIds) newMap.set(id, r.saleFeeAmount)
    }
    feeMap.value = newMap
  } catch {
    // best-effort: fallback pra estimativa flat
  } finally {
    feesLoading.value = false
  }
}

function toggleExpand(key: string): void {
  if (expanded.has(key)) expanded.delete(key)
  else expanded.add(key)
}

const allGroups = computed<ProductGroup[]>(() =>
  groupByProduct(buildListingRows(items.value, mlListings.value), items.value),
)

/** Publicados = produtos com ≥1 listing published (fechado/excluído deixa de contar e
 * o produto volta pra lista de rascunhos). Anúncios remotos entram direto. */

// ===== Stats (dados ao vivo do ML) =====
// "Total recebido" = vendido − comissão estimada (gold_special ~11%, gold_pro ~14%).
// Estimativa consciente: comissão exata exige fee por item (N chamadas); decisão
// registrada no PM: frete não entra (não temos o custo real por venda).
/** Comissão estimada por marketplace (ML: gold ~11% / pro ~14%). */
const FEE_RATE: Record<Marketplace, number> = { mercadolivre: 0.11, shopee: 0.11 }

const stats = computed(() => {
  const live = mlListings.value
  const filtered = marketplaceFilter.value === 'all' ? live : live.filter((l) => l.marketplace === marketplaceFilter.value)
  const active = filtered.filter((l) => l.status === 'active')
  const sold = filtered.reduce((sum, l) => sum + (l.soldQuantity ?? 0), 0)
  const gross = filtered.reduce((sum, l) => sum + (l.soldQuantity ?? 0) * l.price, 0)
  const fee = filtered.reduce(
    (sum, l) => {
      // Comissão exata via feeMap (API ML) quando disponível; fallback estimativa flat
      const exact = feeMap.value.get(l.id)
      const feePerUnit = exact ?? l.price * (FEE_RATE[l.marketplace as Marketplace] ?? 0.11)
      return sum + (l.soldQuantity ?? 0) * feePerUnit
    },
    0,
  )
  const exactCount = filtered.filter((l) => feeMap.value.has(l.id) && (l.soldQuantity ?? 0) > 0).length
  // Breakdown por marketplace
  const perMp = MARKETPLACES.map((mp) => {
    const items = filtered.filter((l) => l.marketplace === mp)
    const mpGross = items.reduce((sum, l) => sum + (l.soldQuantity ?? 0) * l.price, 0)
    const mpFee = items.reduce(
      (sum, l) => {
        const exact = feeMap.value.get(l.id)
        const feePerUnit = exact ?? l.price * (FEE_RATE[mp] ?? 0.11)
        return sum + (l.soldQuantity ?? 0) * feePerUnit
      },
      0,
    )
    return { marketplace: mp, gross: mpGross, net: mpGross - mpFee, count: items.length }
  }).filter((mp) => mp.count > 0)
  return {
    activeCount: active.length,
    sold,
    gross,
    net: gross - fee,
    exactCount,
    perMp,
  }
})
const visibleGroups = computed<ProductGroup[]>(() =>
  allGroups.value.filter((group) => {
    if (group.productId === null) return true
    const product = items.value.find((p) => p.id === group.productId)
    return product ? hasPublishedListing(product) : false
  }),
)

const lineVisible = (line: MarketplaceLine): boolean =>
  marketplaceFilter.value === 'all' || line.marketplace === marketplaceFilter.value

function lineDisplay(line: MarketplaceLine): DisplayItem[] {
  return line.rows.length ? groupByFamily(line.rows) : []
}

const loading = computed(() => store.loading || loadingRemote.value)

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPriceRange(min: number, max: number): string {
  return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`
}

const publishTarget = ref<{ product: ProductDetail; marketplace: Marketplace } | null>(null)
const publishLoading = ref(false)

async function openPublish(productId: string, marketplace: Marketplace): Promise<void> {
  actionError.value = null
  publishLoading.value = true
  try {
    publishTarget.value = { product: await getProduct(productId), marketplace }
  } catch (e) {
    actionError.value = apiErrorMessage(e)
  } finally {
    publishLoading.value = false
  }
}

/** Publica de fato (rota POST /publish/:marketplace) e recarrega tudo. */
async function onPublish(): Promise<void> {
  if (!publishTarget.value) return
  publishLoading.value = true
  try {
    await publishProduct(publishTarget.value.product.id, publishTarget.value.marketplace)
    publishTarget.value = null
    await store.fetchAll()
    await loadRemote()
  } catch (e) {
    publishTarget.value = null
    actionError.value = apiErrorMessage(e)
  } finally {
    publishLoading.value = false
  }
}

async function onUpdated(): Promise<void> {
  // Backend refletiu status no listing local (encerrar → closed) — recarrega pra regra
  // rascunho×publicado valer na hora.
  await store.fetchAll()
  loadRemote()
}

async function onDeleted(itemId: string): Promise<void> {
  mlListings.value = mlListings.value.filter((i) => i.id !== itemId)
  // backend marcou o listing local closed/deleted — recarrega pra regra rascunho×publicado valer
  await store.fetchAll()
}

async function onSynced(): Promise<void> {
  await store.fetchAll()
}

function onRowError(message: string): void {
  actionError.value = message
}
</script>

<template>
  <section class="mx-auto grid max-w-6xl gap-6">
    <header>
      <h1 class="page-title">Publicados</h1>
      <p class="page-sub">
        Anúncios por produto e marketplace — publicado edita direto no marketplace, sem divergência
        com o catálogo
      </p>
    </header>

    <!-- Stats (dados ao vivo do ML) -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <article class="card p-5">
        <div class="flex items-center gap-2.5 text-sm text-ink-2">
          <span class="icon-chip size-8 rounded-lg"><AppIcon name="send" :size="16" /></span>
          Ativos
        </div>
        <p class="num mt-3 text-[30px] font-semibold leading-none">{{ stats.activeCount }}</p>
        <p class="mt-2 text-[13px] text-muted">anúncios publicados ativos</p>
      </article>
      <article class="card p-5">
        <div class="flex items-center gap-2.5 text-sm text-ink-2">
          <span class="icon-chip size-8 rounded-lg"><AppIcon name="wallet" :size="16" /></span>
          Vendidos
        </div>
        <p class="num mt-3 text-[30px] font-semibold leading-none">{{ stats.sold }}</p>
        <p class="mt-2 text-[13px] text-muted">unidades vendidas</p>
      </article>
      <article class="card p-5">
        <div class="flex items-center gap-2.5 text-sm text-ink-2">
          <span class="icon-chip size-8 rounded-lg"><AppIcon name="wallet" :size="16" /></span>
          Total vendido
        </div>
        <p class="num mt-3 text-[30px] font-semibold leading-none">
          {{ formatPrice(stats.gross) }}
        </p>
        <p class="mt-2 text-[13px] text-muted">preço × vendidos (bruto)</p>
      </article>
      <article class="card p-5">
        <div class="flex items-center gap-2.5 text-sm text-ink-2">
          <span class="icon-chip size-8 rounded-lg"><AppIcon name="wallet" :size="16" /></span>
          Total recebido
        </div>
        <p class="num mt-3 text-[30px] font-semibold leading-none">
          {{ stats.exactCount > 0 ? formatPrice(stats.net) : `~ ${formatPrice(stats.net)}` }}
        </p>
        <p class="mt-2 text-[13px]" :class="stats.exactCount > 0 ? 'text-ok-600' : 'text-muted'">
          {{ stats.exactCount > 0 ? 'comissão exata via API ML' : 'estimativa após comissão (ML ~11% / pro ~14%)' }}
        </p>
        <div v-if="stats.perMp.length > 1" class="mt-3 grid gap-1 border-t border-line pt-3">
          <div v-for="mp in stats.perMp" :key="mp.marketplace" class="flex items-center justify-between text-[13px]">
            <div class="flex items-center gap-1.5">
              <MarketplaceBadge :marketplace="mp.marketplace" :size="14" />
              <span class="text-muted">{{ MARKETPLACE_LABELS[mp.marketplace] }}</span>
            </div>
            <span class="num font-medium">~ {{ formatPrice(mp.net) }}</span>
          </div>
        </div>
      </article>
    </div>

    <div v-if="remoteError" class="alert alert-bad" role="alert">
      <AppIcon name="alert" :size="18" />
      <span>{{ remoteError }}</span>
    </div>
    <div v-if="actionError" class="alert alert-bad" role="alert">
      <AppIcon name="alert" :size="18" />
      <span>{{ actionError }}</span>
    </div>

    <div class="card overflow-hidden">
      <header class="card-head !pb-5">
        <div>
          <h2 class="card-title">Anúncios</h2>
          <p class="card-sub"><span class="num">{{ visibleGroups.length }}</span> produto(s)</p>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <select v-model="marketplaceFilter" class="input input-sm w-auto">
            <option value="all">Todos marketplaces</option>
            <option v-for="m in MARKETPLACES" :key="m" :value="m">{{ MARKETPLACE_LABELS[m] }}</option>
          </select>
        </div>
      </header>

      <p v-if="loading" class="px-6 pb-8 text-sm text-muted">Carregando…</p>
      <p v-else-if="visibleGroups.length === 0" class="px-6 pb-10 pt-4 text-sm text-muted">
        Nenhum anúncio encontrado com esse filtro.
      </p>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[860px] text-sm">
          <thead class="table-head">
            <tr>
              <th>Produto / anúncio</th>
              <th>Marketplace</th>
              <th>Origem</th>
              <th>Preço</th>
              <th>Estoque</th>
              <th>Vendidos</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in visibleGroups" :key="group.key">
              <!-- Cabeçalho do produto: card agrupador -->
              <tr
                class="table-row cursor-pointer"
                @click="toggleExpand(group.key)"
              >
                <td>
                  <div class="flex items-center gap-3">
                    <AppIcon
                      name="chevron-down"
                      :size="14"
                      class="shrink-0 transition"
                      :class="expanded.has(group.key) ? '' : '-rotate-90'"
                    />
                    <span class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-panel text-faint">
                      <img v-if="group.thumbnail" :src="group.thumbnail" alt="" class="size-full object-cover" />
                      <AppIcon v-else name="image" :size="16" />
                    </span>
                    <span class="font-medium text-ink">{{ group.title }}</span>
                    <span v-if="group.productId" class="pill pill-neutral">App</span>
                    <span v-else class="pill pill-neutral">Direto no ML</span>
                  </div>
                </td>
                <td class="text-xs text-muted">
                  {{ group.lines.filter((l) => l.rows.length).length }} de {{ group.lines.length }} marketplace(s)
                </td>
                <td colspan="4"></td>
                <td></td>
              </tr>

              <!-- Linhas por marketplace (expandido) -->
              <template v-if="expanded.has(group.key)">
                <template v-for="line in group.lines" :key="`${group.key}-${line.marketplace}`">
                  <!-- Marketplace sem anúncio: placeholder com ação publicar -->
                  <tr v-if="lineVisible(line) && line.rows.length === 0" class="table-row">
                    <td class="pl-10 text-muted">— não publicado</td>
                    <td>
                      <div class="flex items-center gap-2 text-xs text-muted">
                        <MarketplaceBadge :marketplace="line.marketplace" :size="18" />
                        {{ MARKETPLACE_LABELS[line.marketplace] }}
                      </div>
                    </td>
                    <td></td>
                    <td colspan="2"></td>
                    <td><span class="pill pill-neutral">não publicado</span></td>
                    <td class="text-right">
                      <button
                        v-if="group.productId"
                        type="button"
                        class="btn btn-secondary btn-sm"
                        :disabled="publishLoading"
                        @click="openPublish(group.productId, line.marketplace)"
                      >
                        Publicar
                      </button>
                    </td>
                  </tr>

                  <template v-else-if="lineVisible(line)">
                    <template v-for="item in lineDisplay(line)" :key="item.kind === 'group' ? item.group.key : item.row.key">
                      <!-- Grupo de variações (mesmo family_id no ML) -->
                      <tr
                        v-if="item.kind === 'group'"
                        class="table-row cursor-pointer"
                        @click="toggleExpand(item.group.key)"
                      >
                        <td>
                          <div class="flex items-center gap-3 pl-6">
                            <AppIcon
                              name="chevron-down"
                              :size="14"
                              class="shrink-0 transition"
                              :class="expanded.has(item.group.key) ? '' : '-rotate-90'"
                            />
                            <span class="font-medium text-ink">{{ item.group.familyName }}</span>
                            <span class="pill pill-neutral">{{ item.group.memberCount }} variações</span>
                          </div>
                        </td>
                        <td class="flex items-center gap-2 text-xs text-muted">
                          <MarketplaceBadge :marketplace="item.group.marketplace" :size="18" />
                          {{ MARKETPLACE_LABELS[item.group.marketplace] }}
                        </td>
                        <td><span class="pill pill-neutral">Direto</span></td>
                        <td class="num font-medium">{{ formatPriceRange(item.group.minPrice, item.group.maxPrice) }}</td>
                        <td class="num">{{ item.group.totalQuantity }}</td>
                        <td><span class="pill" :class="item.group.statusTone">{{ item.group.statusLabel }}</span></td>
                        <td></td>
                      </tr>
                      <template v-if="item.kind === 'group' && expanded.has(item.group.key)">
                        <MlListingRow
                          v-for="child in item.group.children"
                          v-bind="child"
                          :key="child.key"
                          indent
                          @updated="onUpdated"
                          @deleted="onDeleted"
                          @synced="onSynced"
                          @error="onRowError"
                        />
                      </template>

                      <!-- Anúncio avulso -->
                      <MlListingRow
                        v-if="item.kind === 'row'"
                        v-bind="item.row"
                        :key="`r-${item.row.key}`"
                        @updated="onUpdated"
                        @deleted="onDeleted"
                        @synced="onSynced"
                        @error="onRowError"
                      />
                    </template>
                  </template>
                </template>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <PublishConfirmModal
      v-if="publishTarget"
      :product="publishTarget.product"
      :marketplace="publishTarget.marketplace"
      :busy="publishLoading"
      @close="publishTarget = null"
      @publish="onPublish"
    />
  </section>
</template>

