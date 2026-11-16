<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getMlFee } from '../api/marketplace'
import { saveCategoryMap } from '../api/products'
import { fetchAuthStatus } from '../api/auth'
import { apiErrorMessage } from '../api/client'
import AppIcon from './AppIcon.vue'
import CategoryPicker from './CategoryPicker.vue'
import { MARKETPLACE_LABELS } from '../types'
import type { CategorySearchResult, Marketplace, MlFee, ProductDetail } from '../types'

const props = defineProps<{ product: ProductDetail; marketplace: Marketplace }>()
const emit = defineEmits<{ close: []; publish: [] }>()

const busy = defineModel<boolean>('busy', { default: false })

/** Comissão real via API só existe no ML; Shopee não tem endpoint de fee no app. */
const isMl = computed(() => props.marketplace === 'mercadolivre')

const price = computed(() => Number(props.product.price) || 0)
const settings = computed(() => props.product.marketplaceSettings.find((s) => s.marketplace === props.marketplace) ?? null)
const categoryMap = computed(() => props.product.categoryMaps.find((c) => c.marketplace === props.marketplace) ?? null)
const listingTypeId = computed(() => settings.value?.listingTypeId ?? 'gold_pro')
const categoryId = computed(() => categoryMap.value?.categoryId ?? chosen.value?.id ?? '')
const freeShipping = computed(() => settings.value?.freeShipping !== false)

const fee = ref<MlFee | null>(null)
const feeError = ref<string | null>(null)
const feeLoading = ref(false)

async function fetchFee(): Promise<void> {
  if (!categoryId.value) return
  feeLoading.value = true
  feeError.value = null
  try {
    fee.value = await getMlFee(price.value, categoryId.value, listingTypeId.value)
  } catch (e) {
    feeError.value = apiErrorMessage(e)
  } finally {
    feeLoading.value = false
  }
}

// Fee (ML): (re)calcula quando a categoria fica pronta — inclusive escolhida agora no modal.
// Fica DEPOIS de `chosen` (TDZ) e com immediate pra cobrir categoryMap já existente.

const shippingCost = computed(() => (settings.value?.estimatedShippingCents ?? 0) / 100)
const feeAmount = computed(() => fee.value?.saleFeeAmount ?? 0)
const net = computed(() => price.value - feeAmount.value - (freeShipping.value ? shippingCost.value : 0))

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function descriptionLines(description: string): number {
  return description.trim().split(/\n+/).filter((line) => line.trim().length > 0).length
}

/** Conta ML no modelo User Products: publicação de variações cria 1 anúncio por variação
 * (mesma família) — informativo, não bloqueia. */
const upModelNotice = ref<string | null>(null)
onMounted(async () => {
  if (!isMl.value || props.product.variations.length === 0) return
  try {
    const status = await fetchAuthStatus()
    if (status.find((s) => s.marketplace === 'mercadolivre')?.upModel) {
      upModelNotice.value =
        'Sua conta do Mercado Livre usa o novo modelo de variações (User Products): serão criados 1 anúncio por variação, agrupados na mesma família. Preço e estoque são editados por anúncio.'
    }
  } catch {
    // aviso é best-effort
  }
})

/** Categoria: sem map salvo, escolhe aqui (salva o category-map antes de publicar). */
const chosen = ref<CategorySearchResult | null>(null)
const savingCategory = ref(false)
const categoryError = ref<string | null>(null)
const categoryReady = computed(() => Boolean(categoryMap.value || chosen.value))
const categoryLabel = computed(
  () => chosen.value?.path ?? categoryMap.value?.categoryPath ?? categoryMap.value?.categoryId ?? '',
)

async function onCategorySelected(category: CategorySearchResult): Promise<void> {
  categoryError.value = null
  savingCategory.value = true
  try {
    await saveCategoryMap(props.product.id, {
      marketplace: props.marketplace,
      categoryId: category.id,
      categoryPath: category.path,
    })
    chosen.value = category
  } catch (e) {
    categoryError.value = apiErrorMessage(e)
  } finally {
    savingCategory.value = false
  }
}

watch(categoryId, (id) => {
  if (id && isMl.value) void fetchFee()
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" @click.self="emit('close')">
      <div class="grid max-h-[90vh] w-full max-w-2xl grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl bg-white shadow-pop">
        <header class="border-b border-line px-6 py-4">
          <h2 class="text-base font-semibold text-ink">
            Resumo da publicação — {{ MARKETPLACE_LABELS[props.marketplace] }}
          </h2>
          <p class="mt-0.5 text-xs text-muted">Confira os dados antes de publicar.</p>
        </header>

        <div class="grid gap-5 overflow-y-auto px-6 py-5">
          <p v-if="upModelNotice" class="alert alert-warn" role="alert">
            <AppIcon name="alert" :size="16" />
            <span>{{ upModelNotice }}</span>
          </p>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl border border-line bg-panel p-4">
              <p class="eyebrow">Anúncio</p>
              <p class="mt-1.5 text-sm font-medium">{{ product.title }}</p>
              <p class="mt-1 text-xs text-muted">{{ descriptionLines(product.description) }} linhas na descrição</p>
              <p class="mt-1 text-xs text-muted">
                Categoria: {{ categoryLabel || '— não definida' }}
              </p>
            </div>
            <div class="rounded-xl border border-line bg-panel p-4">
              <p class="eyebrow">Preço e frete</p>
              <p class="mt-1.5 text-sm font-semibold">{{ brl(price) }}</p>
              <p class="mt-1 text-xs text-muted">
                Frete: {{ freeShipping ? 'Grátis (você paga o envio)' : 'Por conta do comprador' }}
              </p>
              <p v-if="freeShipping && shippingCost > 0" class="mt-1 text-xs text-muted">~ {{ brl(shippingCost) }} estimado</p>
              <p v-if="isMl" class="mt-1 text-xs text-muted">
                Tipo de anúncio: {{ listingTypeId === 'gold_pro' ? 'Premium' : 'Clássico' }}
              </p>
            </div>
          </div>

          <div v-if="isMl" class="rounded-xl border border-line bg-panel p-4">
            <p class="eyebrow">Quanto vou receber</p>
            <div v-if="feeLoading" class="mt-2 text-xs text-muted">calculando comissão…</div>
            <p v-if="feeError" class="mt-2 text-xs text-bad-600">{{ feeError }}</p>
            <div v-else-if="fee" class="mt-2 grid gap-1.5 text-sm">
              <div class="flex justify-between gap-3">
                <span class="text-muted">Comissão {{ fee.listingTypeName }}</span>
                <span class="num">− {{ brl(feeAmount) }}</span>
              </div>
              <div v-if="freeShipping && shippingCost > 0" class="flex justify-between gap-3">
                <span class="text-muted">Frete estimado</span>
                <span class="num">− {{ brl(shippingCost) }}</span>
              </div>
              <div class="flex justify-between gap-3 border-t border-line pt-1.5 font-semibold">
                <span>Recebe</span>
                <span class="num">{{ brl(net) }}</span>
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-muted">
            Comissão da Shopee não é calculada pelo app — confira a taxa da categoria no painel da Shopee.
          </p>

          <div v-if="!categoryReady" class="grid gap-2">
            <p class="eyebrow">Escolha a categoria</p>
            <CategoryPicker
              :marketplace="props.marketplace"
              :busy="busy || savingCategory"
              @select="onCategorySelected"
            />
            <p v-if="categoryError" class="text-xs text-bad-600">{{ categoryError }}</p>
          </div>

          <div class="grid gap-2">
            <p class="eyebrow">Variações ({{ product.variations.length }})</p>
            <p v-if="product.variations.length === 0" class="text-xs text-muted">Sem variações.</p>
            <p v-else class="text-xs text-muted">
              {{ product.variations.map((v) => `${v.name} (${v.stock})`).join(' · ') }}
            </p>
          </div>
        </div>

        <footer class="flex items-center justify-between gap-3 border-t border-line bg-panel px-6 py-4">
          <button type="button" class="btn btn-secondary" :disabled="busy" @click="emit('close')">
            Voltar a editar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="busy || !categoryReady"
            @click="emit('publish')"
          >
            <AppIcon name="send" class="size-4" />
            Publicar
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
