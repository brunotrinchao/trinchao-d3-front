<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { getMlFee, getMlShippingCosts } from '../api/marketplace'
import { apiErrorMessage } from '../api/client'
import AppIcon from './AppIcon.vue'
import { MARKETPLACES, MARKETPLACE_LABELS } from '../types'
import type { Marketplace, MlFee, MlShippingQuote, MlListingTypeId, ProductDetail } from '../types'

const emit = defineEmits<{
  save: [
    marketplace: Marketplace,
    input: {
      title: string | null
      description: string | null
      price: number | null
      listingTypeId: MlListingTypeId | null
      estimatedShippingCents: number | null
      freeShipping: boolean | null
    },
  ]
}>()

const props = defineProps<{ product: ProductDetail; busy: boolean }>()

type Fields = {
  title: string
  description: string
  price: string
  listingTypeId: MlListingTypeId
  shippingReais: string
  shippingMode: 'free' | 'buyer'
}

type MpState = { custom: boolean; fields: Fields }

const emptyFields = (): Fields => ({
  title: '',
  description: '',
  price: '',
  listingTypeId: 'gold_special',
  shippingReais: '',
  shippingMode: 'free',
})

// string vazia = usa o valor do Product (override null no backend)
function stateOf(product: ProductDetail, marketplace: Marketplace): MpState {
  const settings = product.marketplaceSettings.find((s) => s.marketplace === marketplace) ?? null
  const hasOverride =
    settings && (settings.title !== null || settings.description !== null || settings.price !== null || settings.listingTypeId !== null || settings.estimatedShippingCents !== null || settings.freeShipping !== null)
  return {
    custom: Boolean(hasOverride),
    fields: {
      title: settings?.title ?? '',
      description: settings?.description ?? '',
      price: settings?.price !== null && settings?.price !== undefined ? String(settings.price) : '',
      listingTypeId: settings?.listingTypeId ?? 'gold_special',
      shippingReais:
        settings?.estimatedShippingCents !== null && settings?.estimatedShippingCents !== undefined
          ? (settings.estimatedShippingCents / 100).toFixed(2)
          : '',
      shippingMode: settings?.freeShipping === false ? 'buyer' : 'free',
    },
  }
}

const states = reactive<Record<Marketplace, MpState>>({
  mercadolivre: stateOf(props.product, 'mercadolivre'),
  shopee: stateOf(props.product, 'shopee'),
})

watch(
  () => props.product,
  (product) => {
    for (const marketplace of MARKETPLACES) states[marketplace] = stateOf(product, marketplace)
  },
)

function toggleCustom(marketplace: Marketplace): void {
  const state = states[marketplace]
  if (state.custom) {
    if (!window.confirm(`Voltar "${MARKETPLACE_LABELS[marketplace]}" pro anúncio padrão? Os campos personalizados serão limpos.`)) return
    state.custom = false
    state.fields = emptyFields()
    // null em tudo = limpa os overrides no backend (anuncio volta a usar o Product)
    emit('save', marketplace, {
      title: null,
      description: null,
      price: null,
      listingTypeId: null,
      estimatedShippingCents: null,
      freeShipping: null,
    })
  } else {
    state.custom = true
  }
}

function setField(marketplace: Marketplace, key: keyof Fields, value: string): void {
  states[marketplace] = { ...states[marketplace], fields: { ...states[marketplace].fields, [key]: value } }
}

function save(marketplace: Marketplace): void {
  const f = states[marketplace].fields
  const priceNumber = Number(f.price)
  const shippingCents = Math.round(Number(f.shippingReais.replace(',', '.')) * 100)
  emit('save', marketplace, {
    title: f.title.trim() ? f.title.trim() : null,
    description: f.description.trim() ? f.description.trim() : null,
    price: f.price.trim() && Number.isFinite(priceNumber) && priceNumber > 0 ? priceNumber : null,
    listingTypeId: marketplace === 'mercadolivre' ? f.listingTypeId : null,
    estimatedShippingCents: f.shippingReais.trim() && Number.isFinite(shippingCents) ? shippingCents : null,
    freeShipping: marketplace === 'mercadolivre' ? f.shippingMode !== 'buyer' : null,
  })
}

// --- "Quanto vou receber" (Mercado Livre) ---

const mlCategory = computed(
  () => props.product.categoryMaps.find((c) => c.marketplace === 'mercadolivre') ?? null,
)

function settingsOf(marketplace: Marketplace) {
  return props.product.marketplaceSettings.find((s) => s.marketplace === marketplace) ?? null
}

/** Preço efetivo: override do marketplace quando preenchido, senão o do Product. */
const effectivePrice = computed(() => {
  const override = Number(states.mercadolivre.fields.price)
  if (states.mercadolivre.custom && override > 0) return override
  return Number(props.product.price) || 0
})

const effectiveListingTypeId = computed(() =>
  states.mercadolivre.custom ? states.mercadolivre.fields.listingTypeId : 'gold_special',
)

const fee = ref<MlFee | null>(null)
const feeError = ref<string | null>(null)
const feeLoading = ref(false)

async function fetchFee(): Promise<void> {
  fee.value = null
  feeError.value = null
  if (!mlCategory.value || effectivePrice.value <= 0) return
  feeLoading.value = true
  try {
    fee.value = await getMlFee(effectivePrice.value, mlCategory.value.categoryId, effectiveListingTypeId.value)
  } catch (e) {
    feeError.value = apiErrorMessage(e)
  } finally {
    feeLoading.value = false
  }
}

watch([effectivePrice, effectiveListingTypeId, mlCategory], fetchFee, { immediate: true })

/** Frete estimado manual (override ou settings salvas) em reais — é estimativa, nunca exato. */
const estimatedShipping = computed(() => {
  const local = Number(states.mercadolivre.fields.shippingReais.replace(',', '.'))
  if (states.mercadolivre.custom && Number.isFinite(local)) return local
  const saved = settingsOf('mercadolivre')?.estimatedShippingCents
  return saved !== null && saved !== undefined ? saved / 100 : null
})

/** Forma de envio efetiva: seleção local quando personalizando, senão a salva (null = grátis). */
const effectiveShippingMode = computed(() =>
  states.mercadolivre.custom ? states.mercadolivre.fields.shippingMode : (settingsOf('mercadolivre')?.freeShipping === false ? 'buyer' : 'free'),
)

/** Recebimento estimado = preço - comissão - frete (só quando grátis; ~ estimativa). */
const netAmount = computed(() => {
  if (!fee.value) return null
  const shipping = effectiveShippingMode.value === 'free' ? (estimatedShipping.value ?? 0) : 0
  const net = effectivePrice.value - fee.value.saleFeeAmount - shipping
  return Number.isFinite(net) ? net : null
})

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// --- Cotações de envio (ML) ---

const shippingQuotes = ref<MlShippingQuote[]>([])
const shippingError = ref<string | null>(null)
const shippingLoading = ref(false)
const shippingOpen = ref(false)

async function fetchShipping(): Promise<void> {
  shippingError.value = null
  shippingQuotes.value = []
  shippingLoading.value = true
  try {
    shippingQuotes.value = await getMlShippingCosts({ productId: props.product.id })
  } catch (e) {
    shippingError.value = apiErrorMessage(e)
  } finally {
    shippingLoading.value = false
  }
}

function toggleShipping(): void {
  shippingOpen.value = !shippingOpen.value
  if (shippingOpen.value) void fetchShipping()
}

/** Preenche o frete estimado com o custo cheio da cotação (list_cost — o que o vendedor paga). */
function useQuote(quote: MlShippingQuote): void {
  states.mercadolivre = {
    custom: true,
    fields: { ...states.mercadolivre.fields, shippingReais: quote.listCost.toFixed(2) },
  }
}

const COVERAGE_LABELS: Record<string, string> = { all_country: 'Todo o país' }

function coverageLabel(coverage: string): string {
  return COVERAGE_LABELS[coverage] ?? coverage
}
</script>

<template>
  <section class="card">
    <header class="card-head">
      <div class="flex items-center gap-3">
        <span class="icon-chip"><AppIcon name="edit" /></span>
        <div>
          <h2 class="card-title">Anúncio por marketplace</h2>
          <p class="card-sub">Mesmo anúncio pra todos, ou valores próprios por marketplace</p>
        </div>
      </div>
    </header>
    <div class="card-body grid gap-3">
      <div
        v-for="marketplace in MARKETPLACES"
        :key="marketplace"
        class="grid gap-3 rounded-xl border border-line bg-panel p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-semibold">{{ MARKETPLACE_LABELS[marketplace] }}</p>
          <label class="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              class="h-4 w-4 accent-current"
              :checked="states[marketplace].custom"
              :disabled="props.busy"
              @change="toggleCustom(marketplace)"
            />
            Personalizar
          </label>
        </div>

        <template v-if="states[marketplace].custom">
          <label class="block">
            <span class="label">Título</span>
            <input
              class="input"
              :disabled="props.busy"
              :value="states[marketplace].fields.title"
              :placeholder="props.product.title"
              @input="setField(marketplace, 'title', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="block">
            <span class="label">Descrição</span>
            <textarea
              class="input"
              rows="4"
              :disabled="props.busy"
              :value="states[marketplace].fields.description"
              :placeholder="'Usa a descrição do produto (' + Math.max(0, props.product.description.split(/\n+/).filter(l => l.trim()).length) + ' linhas)'"
              @input="setField(marketplace, 'description', ($event.target as HTMLTextAreaElement).value)"
            />
          </label>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block">
              <span class="label">Preço</span>
              <div class="adorn adorn-start">
                <span class="adorn-start-el">R$</span>
                <input
                  class="input num"
                  type="number"
                  min="0"
                  step="0.01"
                  :disabled="props.busy"
                  :value="states[marketplace].fields.price"
                  :placeholder="String(props.product.price)"
                  @input="setField(marketplace, 'price', ($event.target as HTMLInputElement).value)"
                />
              </div>
            </label>
            <label v-if="marketplace === 'mercadolivre'" class="block">
              <span class="label">Tipo de anúncio</span>
              <select
                class="input"
                :disabled="props.busy"
                :value="states[marketplace].fields.listingTypeId"
                @change="setField(marketplace, 'listingTypeId', ($event.target as HTMLSelectElement).value)"
              >
                <option value="gold_special">Clássico (comissão menor)</option>
                <option value="gold_pro">Premium (comissão maior)</option>
              </select>
            </label>
          </div>
          <label v-if="marketplace === 'mercadolivre'" class="block">
            <span class="label">Forma de envio</span>
            <select
              class="input"
              :disabled="props.busy"
              :value="states[marketplace].fields.shippingMode"
              @change="setField(marketplace, 'shippingMode', ($event.target as HTMLSelectElement).value)"
            >
              <option value="free">Grátis (você paga o envio)</option>
              <option value="buyer">Por conta do comprador</option>
            </select>
          </label>
          <label v-if="marketplace === 'mercadolivre' && states[marketplace].fields.shippingMode === 'free'" class="block">
            <span class="label">Frete grátis estimado</span>
            <div class="adorn adorn-start">
              <span class="adorn-start-el">R$</span>
              <input
                class="input num"
                type="number"
                min="0"
                step="0.01"
                :disabled="props.busy"
                :value="states[marketplace].fields.shippingReais"
                placeholder="0,00"
                @input="setField(marketplace, 'shippingReais', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <span class="mt-1 block text-xs text-muted">Sua estimativa manual — entra no cálculo com ~</span>
          </label>
          <div class="flex justify-end">
            <button type="button" class="btn btn-primary btn-sm" :disabled="props.busy" @click="save(marketplace)">
              Salvar personalização
            </button>
          </div>
        </template>
        <p v-else class="text-xs text-muted">
          Usa título, descrição, preço e dados do cadastro do produto.
        </p>
      </div>

      <!-- Quanto vou receber (ML) -->
      <div v-if="mlCategory" class="rounded-xl border border-line bg-panel p-4">
        <p class="eyebrow mb-3">Quanto vou receber (Mercado Livre)</p>
        <div class="grid gap-2 text-sm">
          <div class="flex justify-between">
            <span class="text-muted">Preço do anúncio</span>
            <span class="num font-medium">{{ brl(effectivePrice) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Comissão ({{ effectiveListingTypeId === 'gold_pro' ? 'Premium' : 'Clássico' }})</span>
            <span v-if="feeLoading" class="text-muted">calculando…</span>
            <span v-else-if="fee" class="num font-medium">-{{ brl(fee.saleFeeAmount) }}</span>
            <span v-else class="text-xs text-bad-600">{{ feeError ?? 'sem valor' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">
              {{ effectiveShippingMode === 'free' ? 'Frete grátis (~ estimado)' : 'Frete por conta do comprador' }}
            </span>
            <span class="num font-medium">
              {{ effectiveShippingMode === 'free' ? (estimatedShipping !== null ? `~ ${brl(estimatedShipping)}` : '—') : 'R$ 0' }}
            </span>
          </div>
          <div class="flex justify-between border-t border-line pt-2">
            <span class="font-semibold">Você recebe</span>
            <span class="num font-semibold">
              <template v-if="netAmount !== null">
                <template v-if="effectiveShippingMode === 'free' && estimatedShipping !== null">~ </template>{{ brl(netAmount) }}
              </template>
              <template v-else>—</template>
            </span>
          </div>
        </div>
        <p v-if="feeError" class="mt-2 text-xs text-bad-600">{{ feeError }}</p>
      </div>

      <!-- Cotações de envio (ML) -->
      <div v-if="mlCategory" class="rounded-xl border border-line bg-panel p-4">
        <div class="flex items-center justify-between gap-3">
          <p class="eyebrow">Custos de envio (cotação ML)</p>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="props.busy || shippingLoading"
            @click="toggleShipping"
          >
            {{ shippingOpen ? 'Ocultar' : 'Cotar' }}
          </button>
        </div>
        <p v-if="!shippingOpen && !shippingLoading" class="mt-2 text-xs text-muted">
          Consulta os custos reais de envio ME2 com base nas dimensões e preço do produto.
        </p>
        <div v-if="shippingLoading" class="mt-2 text-xs text-muted">cotando…</div>
        <p v-if="shippingError" class="mt-2 text-xs text-bad-600">{{ shippingError }}</p>
        <div v-if="shippingOpen && shippingQuotes.length > 0" class="mt-3 grid gap-2 text-sm">
          <div
            v-for="quote in shippingQuotes"
            :key="quote.coverage"
            class="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate font-medium">{{ coverageLabel(quote.coverage) }}</p>
              <p class="text-xs text-muted">
                peso cobrado {{ quote.billableWeight !== null ? `${quote.billableWeight} g` : '—' }}
                <template v-if="quote.discountRate !== null && quote.discountRate > 0">
                  · subsídio ML {{ Math.round(quote.discountRate * 100) }}% ({{ brl(quote.promotedAmount ?? 0) }})
                </template>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <span class="num font-medium">{{ quote.listCost > 0 ? brl(quote.listCost) : 'grátis' }}</span>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="props.busy"
                title="Preenche o frete estimado do Mercado Livre com esse custo"
                @click="useQuote(quote)"
              >
                Usar
              </button>
            </div>
          </div>
        </div>
        <p v-else-if="shippingOpen && !shippingLoading && shippingQuotes.length === 0 && !shippingError" class="mt-2 text-xs text-muted">
          Nenhuma cotação retornada — confira dimensões e peso do produto.
        </p>
      </div>
    </div>
  </section>
</template>
