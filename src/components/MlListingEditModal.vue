<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { fetchMlListingDetail, syncMlListing, updateMlListing, addMlPictures } from '../api/marketplaceListings'
import { generateDescription } from '../api/ai'
import { apiErrorMessage } from '../api/client'
import AppIcon from './AppIcon.vue'
import type { MlListing, MlPicture } from '../types'

const props = defineProps<{ itemId: string; productId: string | null }>()
const emit = defineEmits<{
  close: []
  updated: [MlListing]
  synced: [{ itemId: string; productId: string }]
}>()

const loading = ref(true)
const saving = ref(false)
const syncingPictures = ref(false)
const savingPictureOrder = ref(false)
const generating = ref(false)
const error = ref<string | null>(null)
const pictures = ref<MlPicture[]>([])
const originalPictureIds = ref<string[]>([])
const picturesChanged = computed(
  () => pictures.value.map((p) => p.id).join(',') !== originalPictureIds.value.join(','),
)

const dragIndex = ref<number | null>(null)

function onPictureDragStart(index: number, event: DragEvent): void {
  dragIndex.value = index
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onPictureDrop(index: number): void {
  if (dragIndex.value === null || dragIndex.value === index) return
  const next = [...pictures.value]
  const [item] = next.splice(dragIndex.value, 1)
  next.splice(index, 0, item)
  pictures.value = next
  dragIndex.value = null
}

function removePicture(index: number): void {
  pictures.value = pictures.value.filter((_, i) => i !== index)
}

async function onSavePictureOrder(): Promise<void> {
  savingPictureOrder.value = true
  error.value = null
  try {
    const updated = await updateMlListing(props.itemId, { pictureIds: pictures.value.map((p) => p.id) })
    emit('updated', updated)
    originalPictureIds.value = pictures.value.map((p) => p.id)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    savingPictureOrder.value = false
  }
}

const draft = reactive({
  title: '',
  description: '',
  price: 0,
  availableQuantity: 0,
  heightCm: 0,
  widthCm: 0,
  lengthCm: 0,
  weightGrams: 0,
  freeShipping: true,
})
const currentStatus = ref<'active' | 'paused' | 'closed' | 'unknown'>('unknown')
const uploadingPictures = ref(false)
const pictureInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  try {
    const detail = await fetchMlListingDetail(props.itemId)
    draft.title = detail.title
    draft.description = detail.description
    draft.price = detail.price
    draft.availableQuantity = detail.availableQuantity
    draft.heightCm = detail.heightCm
    draft.widthCm = detail.widthCm
    draft.lengthCm = detail.lengthCm
    draft.weightGrams = detail.weightGrams
    draft.freeShipping = detail.freeShipping
    currentStatus.value = (detail.status as 'active' | 'paused' | 'closed') ?? 'unknown'
    pictures.value = detail.pictures
    originalPictureIds.value = detail.pictures.map((p) => p.id)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
})

async function onGenerateDescription(): Promise<void> {
  generating.value = true
  error.value = null
  try {
    draft.description = await generateDescription({
      title: draft.title,
      weightGrams: draft.weightGrams || 1,
      heightCm: draft.heightCm || 1,
      widthCm: draft.widthCm || 1,
      lengthCm: draft.lengthCm || 1,
    })
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    generating.value = false
  }
}

async function onSave(): Promise<void> {
  saving.value = true
  error.value = null
  try {
    const updated = await updateMlListing(props.itemId, {
      title: draft.title,
      description: draft.description,
      price: draft.price,
      availableQuantity: draft.availableQuantity,
      heightCm: draft.heightCm,
      widthCm: draft.widthCm,
      lengthCm: draft.lengthCm,
      weightGrams: draft.weightGrams,
      freeShipping: draft.freeShipping,
    })
    emit('updated', updated)
    emit('close')
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

async function onSyncPictures(): Promise<void> {
  syncingPictures.value = true
  error.value = null
  try {
    const updated = await updateMlListing(props.itemId, { syncPicturesFromProduct: true })
    emit('updated', updated)
    const detail = await fetchMlListingDetail(props.itemId)
    pictures.value = detail.pictures
    originalPictureIds.value = detail.pictures.map((p) => p.id)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    syncingPictures.value = false
  }
}

async function onSyncProduct(): Promise<void> {
  saving.value = true
  error.value = null
  try {
    const { productId } = await syncMlListing(props.itemId)
    emit('synced', { itemId: props.itemId, productId })
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

/** Muda o status do anuncio direto no ML (ativo/pausado/encerrar). */
async function onSetStatus(status: 'active' | 'paused' | 'closed'): Promise<void> {
  if (status === 'closed' && !window.confirm('Encerrar o anúncio? Ele sai do ar no Mercado Livre.')) return
  saving.value = true
  error.value = null
  try {
    const updated = await updateMlListing(props.itemId, { status })
    currentStatus.value = (updated.status as 'active' | 'paused' | 'closed') ?? 'unknown'
    emit('updated', updated)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

/** Upload de fotos novas: backend envia pro Storage e repassa a URL pro ML. */
async function onAddPictures(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (files.length === 0) return
  uploadingPictures.value = true
  error.value = null
  try {
    const updatedPictures = await addMlPictures(props.itemId, files)
    pictures.value = updatedPictures
    originalPictureIds.value = updatedPictures.map((p) => p.id)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    uploadingPictures.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" @click.self="emit('close')">
      <div class="grid max-h-[90vh] w-full max-w-2xl grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl bg-white shadow-pop">
        <header class="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 class="text-base font-semibold text-ink">Editar anúncio no Mercado Livre</h2>
          <button type="button" class="btn btn-ghost btn-icon" @click="emit('close')">
            <AppIcon name="close" :size="16" />
          </button>
        </header>

        <div class="overflow-y-auto px-6 py-5">
          <p v-if="loading" class="text-sm text-muted">Carregando…</p>
          <div v-else class="grid gap-5">
            <div v-if="error" class="alert alert-bad">
              <AppIcon name="alert" :size="18" />
              <span>{{ error }}</span>
            </div>

            <label class="block">
              <span class="label">Título</span>
              <input v-model="draft.title" class="input" :disabled="saving" />
            </label>

            <label class="block">
              <div class="mb-1.5 flex items-center justify-between">
                <span class="label !mb-0">Descrição</span>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  :disabled="saving || generating || !draft.title"
                  @click="onGenerateDescription"
                >
                  <AppIcon name="sync" :size="13" />
                  {{ generating ? 'Gerando…' : 'Gerar com IA' }}
                </button>
              </div>
              <textarea v-model="draft.description" class="input" rows="6" :disabled="saving" />
            </label>

            <div>
              <p class="eyebrow mb-2">Status do anúncio</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="opt in (['active', 'paused', 'closed'] as const)"
                  :key="opt"
                  type="button"
                  class="btn btn-sm"
                  :class="currentStatus === opt ? (opt === 'active' ? 'btn-primary' : 'btn-secondary') : 'btn-ghost border border-line'"
                  :disabled="saving || currentStatus === opt"
                  @click="onSetStatus(opt)"
                >
                  {{ opt === 'active' ? 'Ativo' : opt === 'paused' ? 'Pausado' : 'Encerrado' }}
                </button>
              </div>
              <p class="mt-1 text-xs text-muted">Encerrar tira o anúncio do ar (voltar a ativar é possível).</p>
            </div>

            <div class="grid gap-5 sm:grid-cols-2">
              <label class="block">
                <span class="label">Preço</span>
                <div class="adorn adorn-start">
                  <span class="adorn-start-el">R$</span>
                  <input v-model.number="draft.price" class="input num" type="number" min="0" step="0.01" :disabled="saving" />
                </div>
              </label>
              <label class="block">
                <span class="label">Estoque</span>
                <div class="adorn">
                  <input v-model.number="draft.availableQuantity" class="input num" type="number" min="0" step="1" :disabled="saving" />
                  <span class="adorn-end">un</span>
                </div>
              </label>
            </div>

            <div>
              <p class="eyebrow mb-3">Embalagem e dimensões</p>
              <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <label class="block">
                  <span class="label">Peso</span>
                  <div class="adorn">
                    <input v-model.number="draft.weightGrams" class="input num" type="number" min="0" step="1" :disabled="saving" />
                    <span class="adorn-end">g</span>
                  </div>
                </label>
                <label class="block">
                  <span class="label">Altura</span>
                  <div class="adorn">
                    <input v-model.number="draft.heightCm" class="input num" type="number" min="0" step="1" :disabled="saving" />
                    <span class="adorn-end">cm</span>
                  </div>
                </label>
                <label class="block">
                  <span class="label">Largura</span>
                  <div class="adorn">
                    <input v-model.number="draft.widthCm" class="input num" type="number" min="0" step="1" :disabled="saving" />
                    <span class="adorn-end">cm</span>
                  </div>
                </label>
                <label class="block">
                  <span class="label">Comprimento</span>
                  <div class="adorn">
                    <input v-model.number="draft.lengthCm" class="input num" type="number" min="0" step="1" :disabled="saving" />
                    <span class="adorn-end">cm</span>
                  </div>
                </label>
              </div>
            </div>

            <label class="flex cursor-pointer items-center gap-2">
              <input v-model="draft.freeShipping" type="checkbox" class="size-4" :disabled="saving" />
              <span class="text-sm text-ink">Frete grátis (você paga o envio)</span>
            </label>

            <div>
              <div class="mb-3 flex items-center justify-between">
                <p class="eyebrow !mb-0">Fotos</p>
                <div class="flex items-center gap-2">
                  <input
                    ref="pictureInput"
                    type="file"
                    accept="image/*"
                    multiple
                    class="hidden"
                    @change="onAddPictures"
                  />
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    :disabled="saving || uploadingPictures"
                    @click="pictureInput?.click()"
                  >
                    <AppIcon name="upload" :size="13" />
                    {{ uploadingPictures ? 'Enviando…' : 'Adicionar fotos' }}
                  </button>
                  <button
                    v-if="picturesChanged"
                    type="button"
                    class="btn btn-primary btn-sm"
                    :disabled="savingPictureOrder"
                    @click="onSavePictureOrder"
                  >
                    <AppIcon name="check" :size="13" />
                    {{ savingPictureOrder ? 'Salvando…' : 'Salvar ordem/remoção' }}
                  </button>
                </div>
              </div>
              <p v-if="pictures.length > 0" class="mb-2 text-xs text-muted">Arraste pra reordenar. A primeira é a capa.</p>
              <ul v-if="pictures.length > 0" class="grid grid-cols-4 gap-2">
                <li
                  v-for="(picture, i) in pictures"
                  :key="picture.id"
                  class="group relative cursor-grab overflow-hidden rounded-lg border border-line transition"
                  :class="dragIndex === i ? 'opacity-50' : ''"
                  draggable="true"
                  @dragstart="onPictureDragStart(i, $event)"
                  @dragover.prevent
                  @drop.prevent="onPictureDrop(i)"
                  @dragend="dragIndex = null"
                >
                  <img :src="picture.url" alt="" class="aspect-square w-full object-cover" draggable="false" />
                  <span
                    v-if="i === 0"
                    class="absolute left-1 top-1 rounded-full bg-ink/85 px-1.5 py-0.5 text-[9px] font-medium uppercase text-white"
                  >
                    Capa
                  </span>
                  <button
                    type="button"
                    class="btn btn-danger btn-icon absolute right-1 top-1 !size-6 opacity-0 transition group-hover:opacity-100"
                    title="Remover"
                    @click="removePicture(i)"
                  >
                    <AppIcon name="close" :size="12" />
                  </button>
                </li>
              </ul>
              <p v-else class="text-xs text-muted">Nenhuma foto no anúncio.</p>

              <div v-if="productId" class="mt-3">
                <button type="button" class="btn btn-secondary btn-sm" :disabled="syncingPictures" @click="onSyncPictures">
                  <AppIcon name="sync" :size="13" />
                  {{ syncingPictures ? 'Enviando…' : 'Reenviar fotos do produto pro ML' }}
                </button>
                <p class="mt-1.5 text-xs text-muted">Usa as fotos cadastradas no produto do app (card de Imagens).</p>
              </div>
              <div v-else class="mt-3 rounded-lg border border-line bg-panel p-3">
                <p class="text-xs text-muted">
                  Esse anúncio não tem produto vinculado no app ainda — sincronize pra poder gerenciar fotos por aqui.
                </p>
                <button type="button" class="btn btn-secondary btn-sm mt-2" :disabled="saving" @click="onSyncProduct">
                  <AppIcon name="sync" :size="13" />
                  Sincronizar com o app
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer class="flex justify-end gap-2 border-t border-line px-6 py-4">
          <button type="button" class="btn btn-secondary btn-sm" :disabled="saving" @click="emit('close')">Cancelar</button>
          <button type="button" class="btn btn-primary btn-sm" :disabled="saving || loading" @click="onSave">
            <AppIcon name="check" :size="14" />
            {{ saving ? 'Salvando…' : 'Salvar' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
