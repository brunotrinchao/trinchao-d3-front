<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProductsStore } from '../stores/products'
import * as api from '../api/products'
import { fetchRequiredCategoryAttributes } from '../api/categories'
import { apiErrorMessage } from '../api/client'
import ProductForm from '../components/ProductForm.vue'
import ImageUploader from '../components/ImageUploader.vue'
import VariationEditor from '../components/VariationEditor.vue'
import CustomFieldsEditor from '../components/CustomFieldsEditor.vue'
import { hasPublishedListing } from '../composables/listingRows'
import MarketplaceSettingsPanel from '../components/MarketplaceSettingsPanel.vue'
import PublishConfirmModal from '../components/PublishConfirmModal.vue'
import CategoryPicker from '../components/CategoryPicker.vue'
import ListingStatusBadge from '../components/ListingStatusBadge.vue'
import AppIcon from '../components/AppIcon.vue'
import { MARKETPLACES, MARKETPLACE_LABELS } from '../types'
import type {
  CategorySearchResult,
  Marketplace,
  MarketplaceSettingsInput,
  ProductDetail,
  ProductImage,
  ProductInput,
  VariationInput,
} from '../types'

const props = defineProps<{ id: string }>()

const store = useProductsStore()
const router = useRouter()

async function onDeleteProduct(): Promise<void> {
  if (!product.value) return
  if (!window.confirm(`Excluir "${product.value.title}" do app? Isso não publica/remove nada nos marketplaces, só apaga o cadastro local.`)) {
    return
  }
  busy.value = true
  try {
    await api.deleteProduct(props.id)
    store.removeFromCache(props.id)
    router.push('/')
  } catch (e) {
    error.value = apiErrorMessage(e)
    busy.value = false
  }
}
const product = ref<ProductDetail | null>(null)
const form = ref<ProductInput | null>(null)
const busy = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const alertEl = ref<HTMLElement | null>(null)

/** Alerta fica no topo da página; ações (ex: publicar) ficam longe dele — sem isso, o
 *  feedback de erro/sucesso passa despercebido quando o usuário está com scroll embaixo. */
async function scrollToAlert(): Promise<void> {
  await nextTick()
  alertEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

onMounted(load)

async function load(): Promise<void> {
  loading.value = true
  try {
    const detail = await store.fetchOne(props.id)
    if (detail) {
      // Split duro: publicado edita o anúncio em /publicados, não o catálogo local.
      if (hasPublishedListing(detail)) {
        router.replace('/publicados')
        return
      }
      product.value = detail
      form.value = toInput(detail)
    } else {
      error.value = store.error
    }
  } finally {
    // Redirect ou não: o estado de carregamento nunca pode travar a tela.
    loading.value = false
  }
}

function toInput(detail: ProductDetail): ProductInput {
  return {
    title: detail.title,
    description: detail.description,
    price: Number(detail.price) || 0,
    stock: detail.stock,
    weightGrams: detail.weightGrams,
    heightCm: detail.heightCm,
    widthCm: detail.widthCm,
    lengthCm: detail.lengthCm,
    affiliateTag: detail.affiliateTag ?? null,
  }
}

/** Reaplica o detalhe vindo do backend no estado local + cache da store. */
function apply(detail: ProductDetail): void {
  product.value = detail
  store.setDetail(detail)
}

/** Executa uma ação de API e recarrega o detalhe do produto. */
async function run(action: () => Promise<unknown>, successMessage?: string): Promise<void> {
  busy.value = true
  error.value = null
  notice.value = null
  try {
    await action()
    if (successMessage) notice.value = successMessage
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
  // Recarrega mesmo em falha: uma publicação que falha grava o listing
  // com status "failed" e errorMessage, e isso precisa aparecer na tela.
  try {
    apply(await api.getProduct(props.id))
  } catch (e) {
    error.value = error.value ?? apiErrorMessage(e)
  } finally {
    busy.value = false
  }
  if (error.value || notice.value) scrollToAlert()
}

async function saveBasics(): Promise<void> {
  if (!form.value) return
  const input = form.value
  await run(() => api.updateProduct(props.id, input), 'Dados básicos salvos.')
  if (product.value) form.value = toInput(product.value)
}

function onUpload(files: File[]): void {
  run(() => api.uploadImages(props.id, files), `${files.length} imagem(ns) enviada(s).`)
}

function onRemoveImage(imageId: string): void {
  run(() => api.deleteImage(props.id, imageId), 'Imagem removida.')
}

function onReorderImages(images: ProductImage[]): void {
  // Reflete a nova ordem na hora; o run() recarrega o detalhe e confirma com o backend.
  if (product.value) product.value = { ...product.value, images }
  run(
    () => api.reorderImages(props.id, images.map((image) => image.id)),
    'Ordem das imagens salva.',
  )
}

function onCreateVariation(input: VariationInput): void {
  run(() => api.createVariation(props.id, input), 'Variação adicionada.')
}

function onUpdateVariation(variationId: string, input: VariationInput): void {
  run(() => api.updateVariation(props.id, variationId, input), 'Variação atualizada.')
}

function onRemoveVariation(variationId: string): void {
  run(() => api.deleteVariation(props.id, variationId), 'Variação removida.')
}

function onSaveCustomFields(fields: { key: string; value: string }[]): void {
  run(() => api.saveCustomFields(props.id, { fields }), 'Campos extras salvos.')
}

function onSaveMarketplaceSettings(
  marketplace: Marketplace,
  input: MarketplaceSettingsInput,
): void {
  run(
    () => api.saveMarketplaceSettings(props.id, marketplace, input),
    `Personalização de ${MARKETPLACE_LABELS[marketplace]} salva.`,
  )
}

function onSelectCategory(marketplace: Marketplace, category: CategorySearchResult): void {
  run(
    () =>
      api.saveCategoryMap(props.id, {
        marketplace,
        categoryId: category.id,
        categoryPath: category.path,
      }),
    `Categoria de ${MARKETPLACE_LABELS[marketplace]} salva.`,
  )
  // Só ML: atributos catalog_required da categoria escolhida viram linhas nos Campos
  // extras (Marca, Material...) — o usuário preenche ali e o publish já encontra.
  if (marketplace === 'mercadolivre') {
    void seedRequiredAttributes(props.id, category.id)
  }
}

/** Campos catalog_required da categoria que ainda não existem como custom field →
 * adicionados vazios no editor de Campos extras. Melhor esforço: falha não bloqueia
 * a seleção de categoria. */
async function seedRequiredAttributes(productId: string, categoryId: string): Promise<void> {
  try {
    const [attributes, current] = await Promise.all([
      fetchRequiredCategoryAttributes(categoryId),
      api.getProduct(productId),
    ])
    // Pula os que o Product ja cobre (dimensoes/peso viram shipping.dimensions no publish).
    const productCovered = /^(WIDTH|HEIGHT|LENGTH|WEIGHT)$/i
    const candidates = attributes.filter(
      (attr) => (attr.catalogRequired || attr.required) && !productCovered.test(attr.id),
    )
    const existingKeys = new Set(current.customFields.map((field) => field.key.trim().toLowerCase()))
    const missing = candidates.filter((attr) => !existingKeys.has(attr.name.trim().toLowerCase()))
    if (missing.length === 0) return
    const fields = [...current.customFields.map(({ key, value }) => ({ key, value })), ...missing.map(({ name }) => ({ key: name, value: '' }))]
    await api.saveCustomFields(productId, { fields })
    apply(await api.getProduct(productId))
  } catch (e) {
    console.error('seedRequiredAttributes failed:', e)
  }
}

function onSaveAttributes(marketplace: Marketplace, attributes: Record<string, string>): void {
  const current = categoryOf(marketplace)
  if (!current) return
  run(
    () =>
      api.saveCategoryMap(props.id, {
        marketplace,
        categoryId: current.categoryId,
        categoryPath: current.categoryPath,
        attributes,
      }),
    `Atributos de ${MARKETPLACE_LABELS[marketplace]} salvos.`,
  )
}

const publishModal = ref<Marketplace | null>(null)

function onPublish(marketplace: Marketplace): void {
  publishModal.value = marketplace
}

function confirmPublish(): void {
  const marketplace = publishModal.value
  if (!marketplace) return
  publishModal.value = null
  run(
    () => api.publishProduct(props.id, marketplace),
    `Publicação em ${MARKETPLACE_LABELS[marketplace]} solicitada.`,
  )
}

const images = computed(() => [...(product.value?.images ?? [])].sort((a, b) => a.position - b.position))
const variations = computed(() => product.value?.variations ?? [])

function categoryOf(marketplace: Marketplace) {
  return product.value?.categoryMaps.find((c) => c.marketplace === marketplace) ?? null
}

function listingOf(marketplace: Marketplace) {
  return product.value?.listings.find((l) => l.marketplace === marketplace) ?? null
}

const price = computed(() =>
  (Number(product.value?.price) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
)
</script>

<template>
  <section class="mx-auto grid max-w-6xl gap-6">
    <header>
      <div class="flex items-center justify-between">
        <RouterLink to="/" class="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
          <AppIcon name="arrow-left" :size="15" />
          Produtos
        </RouterLink>
        <button
          v-if="product"
          type="button"
          class="btn btn-secondary btn-sm !text-bad-600"
          :disabled="busy"
          @click="onDeleteProduct"
        >
          <AppIcon name="trash" :size="14" />
          Excluir produto
        </button>
      </div>
      <h1 class="page-title">{{ product?.title || 'Produto' }}</h1>
      <div v-if="product" class="mt-3 flex flex-wrap gap-1.5">
        <ListingStatusBadge
          v-for="marketplace in MARKETPLACES"
          :key="marketplace"
          :marketplace="marketplace"
          :listing="listingOf(marketplace)"
        />
      </div>
    </header>

    <p v-if="loading" class="text-sm text-muted">Carregando…</p>

    <template v-else-if="product && form">
      <div v-if="error" ref="alertEl" class="alert alert-bad" role="alert">
        <AppIcon name="alert" :size="18" />
        <span>{{ error }}</span>
      </div>
      <div v-else-if="notice" ref="alertEl" class="alert alert-ok" role="status">
        <AppIcon name="check" :size="18" />
        <span>{{ notice }}</span>
      </div>

      <!-- Indicadores -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <article class="card p-4">
          <p class="eyebrow">Preço</p>
          <p class="num mt-2 text-xl font-semibold">{{ price }}</p>
        </article>
        <article class="card p-4">
          <p class="eyebrow">Estoque</p>
          <p class="num mt-2 text-xl font-semibold">{{ product.stock }}</p>
        </article>
        <article class="card p-4">
          <p class="eyebrow">Imagens</p>
          <p class="num mt-2 text-xl font-semibold">{{ images.length }}</p>
        </article>
        <article class="card p-4">
          <p class="eyebrow">Variações</p>
          <p class="num mt-2 text-xl font-semibold">{{ variations.length }}</p>
        </article>
      </div>

      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <!-- Coluna principal -->
        <div class="grid gap-6">
          <section class="card">
            <header class="card-head">
              <div class="flex items-center gap-3">
                <span class="icon-chip"><AppIcon name="box" /></span>
                <div>
                  <h2 class="card-title">Dados básicos</h2>
                  <p class="card-sub">Título, preço, estoque e embalagem</p>
                </div>
              </div>
            </header>
            <div class="card-body">
              <ProductForm
                v-model="form"
                :disabled="busy"
                :custom-fields="product.customFields.map((field) => ({ key: field.key, value: field.value }))"
              />
            </div>
            <footer class="flex justify-end border-t border-line bg-panel/70 px-5 py-4 sm:px-6">
              <button type="button" class="btn btn-primary" :disabled="busy" @click="saveBasics">
                Salvar dados básicos
              </button>
            </footer>
          </section>

          <ImageUploader
            :images="images"
            :busy="busy"
            @upload="onUpload"
            @remove="onRemoveImage"
            @reorder="onReorderImages"
          />

          <VariationEditor
            :variations="variations"
            :busy="busy"
            @create="onCreateVariation"
            @update="onUpdateVariation"
            @remove="onRemoveVariation"
          />

          <CustomFieldsEditor
            :fields="product.customFields"
            :busy="busy"
            @save="onSaveCustomFields"
          />
        </div>

        <!-- Coluna lateral -->
        <aside class="grid gap-6 xl:sticky xl:top-0">
          <section class="card">
            <header class="card-head">
              <div class="flex items-center gap-3">
                <span class="icon-chip"><AppIcon name="send" /></span>
                <div>
                  <h2 class="card-title">Publicação</h2>
                  <p class="card-sub">Envie o anúncio para cada marketplace</p>
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
                  <ListingStatusBadge :marketplace="marketplace" :listing="listingOf(marketplace)" />
                </div>
                <p v-if="listingOf(marketplace)?.externalId" class="text-xs text-muted">
                  ID externo
                  <span class="num text-ink-2">{{ listingOf(marketplace)?.externalId }}</span>
                </p>
                <p
                  v-if="listingOf(marketplace)?.errorMessage"
                  class="alert alert-bad !px-3 !py-2 text-xs"
                >
                  {{ listingOf(marketplace)?.errorMessage }}
                </p>
                <button
                  type="button"
                  class="btn btn-dark w-full"
                  :disabled="busy"
                  @click="onPublish(marketplace)"
                >
                  <AppIcon name="send" :size="15" />
                  Publicar no {{ MARKETPLACE_LABELS[marketplace] }}
                </button>
              </div>
            </div>
          </section>

          <PublishConfirmModal
            v-if="publishModal && product"
            :product="product"
            :marketplace="publishModal"
            :busy="busy"
            @close="publishModal = null"
            @publish="confirmPublish"
          />

          <MarketplaceSettingsPanel
            :product="product"
            :busy="busy"
            @save="onSaveMarketplaceSettings"
          />

          <section class="card">
            <header class="card-head">
              <div class="flex items-center gap-3">
                <span class="icon-chip"><AppIcon name="layers" /></span>
                <div>
                  <h2 class="card-title">Categorias</h2>
                  <p class="card-sub">Mapeamento por marketplace</p>
                </div>
              </div>
            </header>
            <div class="card-body grid gap-3">
              <CategoryPicker
                v-for="marketplace in MARKETPLACES"
                :key="marketplace"
                :marketplace="marketplace"
                :current="categoryOf(marketplace)"
                :busy="busy"
                @select="onSelectCategory(marketplace, $event)"
                @save-attributes="onSaveAttributes(marketplace, $event)"
              />
            </div>
          </section>
        </aside>
      </div>
    </template>

    <div v-else class="alert alert-bad">
      <AppIcon name="alert" :size="18" />
      <span>{{ error || 'Produto não encontrado.' }}</span>
    </div>
  </section>
</template>
