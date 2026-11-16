<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { deleteMlListing, syncMlListing, updateMlListing } from '../api/marketplaceListings'
import { apiErrorMessage } from '../api/client'
import AppIcon from './AppIcon.vue'
import MarketplaceBadge from './MarketplaceBadge.vue'
import MlListingEditModal from './MlListingEditModal.vue'
import { MARKETPLACE_LABELS } from '../types'
import type { Marketplace, MlListing } from '../types'

const props = defineProps<{
  marketplace: Marketplace
  origin: 'local' | 'remote'
  title: string
  price: number
  quantity: number
  soldQuantity: number
  statusLabel: string
  statusTone: string
  /** status cru do ML ('active'|'paused'|'closed'|...) — null quando nao ha item ao vivo pra agir */
  rawStatus: string | null
  thumbnail: string | null
  permalink: string | null
  productId: string | null
  mlItemId: string | null
  indent?: boolean
}>()

const emit = defineEmits<{
  updated: [MlListing]
  deleted: [string]
  error: [string]
  /** Produto local criado a partir desse anuncio — pai deve recarregar a lista local. */
  synced: [{ itemId: string; productId: string }]
}>()

const saving = ref(false)
const showModal = ref(false)

const needsSync = computed(() => props.mlItemId && !props.productId)

/** Editar/pausar/ativar/encerrar um anuncio "direto" (sem Product local) passa a rastrea-lo
 * localmente tambem — nao falha a acao principal se so a sincronizacao der erro. */
async function syncIfNeeded(): Promise<void> {
  if (!needsSync.value || !props.mlItemId) return
  try {
    const { productId } = await syncMlListing(props.mlItemId)
    emit('synced', { itemId: props.mlItemId, productId })
  } catch (e) {
    emit('error', `Anúncio atualizado, mas não deu pra sincronizar com o app: ${apiErrorMessage(e)}`)
  }
}

async function syncNow(): Promise<void> {
  if (!props.mlItemId) return
  saving.value = true
  try {
    const { productId } = await syncMlListing(props.mlItemId)
    emit('synced', { itemId: props.mlItemId, productId })
  } catch (e) {
    emit('error', apiErrorMessage(e))
  } finally {
    saving.value = false
  }
}

function onModalUpdated(updated: MlListing): void {
  emit('updated', updated)
  showModal.value = false
}

function onModalSynced(payload: { itemId: string; productId: string }): void {
  emit('synced', payload)
}

async function setStatus(status: 'active' | 'paused' | 'closed'): Promise<void> {
  if (!props.mlItemId) return
  saving.value = true
  try {
    const updated = await updateMlListing(props.mlItemId, { status })
    emit('updated', updated)
    await syncIfNeeded()
  } catch (e) {
    emit('error', apiErrorMessage(e))
  } finally {
    saving.value = false
  }
}

async function remove(): Promise<void> {
  if (!props.mlItemId) return
  if (!window.confirm(`Excluir "${props.title}" do Mercado Livre? Isso é irreversível.`)) return
  saving.value = true
  try {
    await deleteMlListing(props.mlItemId)
    emit('deleted', props.mlItemId)
  } catch (e) {
    emit('error', apiErrorMessage(e))
  } finally {
    saving.value = false
  }
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Menu "mais ações" — fecha sozinho ao clicar fora, pra nao ter varios abertos ao mesmo tempo
// numa tabela com muitas linhas.
const menuOpen = ref(false)
const menuEl = ref<HTMLElement | null>(null)

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
}

function closeMenu(): void {
  menuOpen.value = false
}

function onDocumentClick(event: MouseEvent): void {
  if (menuOpen.value && menuEl.value && !menuEl.value.contains(event.target as Node)) closeMenu()
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

/** Acao do menu: fecha o menu e executa. */
function runFromMenu(action: () => void): void {
  closeMenu()
  action()
}
</script>

<template>
  <tr class="table-row">
      <td :class="indent ? 'pl-10' : ''">
        <component
          :is="productId ? 'RouterLink' : permalink ? 'a' : 'span'"
          :to="productId ? `/products/${productId}` : undefined"
          :href="!productId ? (permalink ?? undefined) : undefined"
          :target="!productId ? '_blank' : undefined"
          rel="noopener"
          class="flex items-center gap-3"
        >
          <span class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-panel text-faint">
            <img v-if="thumbnail" :src="thumbnail" alt="" class="size-full object-cover" />
            <AppIcon v-else name="image" :size="16" />
          </span>
          <span class="text-[13px] font-medium text-ink">{{ title }}</span>
        </component>
      </td>
      <td class="flex items-center gap-2 text-xs text-muted"><MarketplaceBadge :marketplace="marketplace" :size="18" />{{ MARKETPLACE_LABELS[marketplace] }}</td>
      <td><span class="pill pill-neutral">{{ origin === 'local' ? 'App' : 'Direto' }}</span></td>
      <td class="num font-medium">{{ formatPrice(price) }}</td>
      <td><span class="num" :class="quantity === 0 ? 'text-bad-600' : ''">{{ quantity }}</span></td>
      <td><span class="num" :class="soldQuantity > 0 ? 'text-ok-600 font-medium' : 'text-muted'">{{ soldQuantity }}</span></td>
      <td><span class="pill" :class="statusTone">{{ statusLabel }}</span></td>
      <td class="text-right">
        <div class="flex items-center justify-end gap-1.5">
          <!-- Acao primaria: sempre visivel, com rotulo -->
          <RouterLink v-if="productId" :to="`/products/${productId}`" class="btn btn-secondary btn-sm">
            <AppIcon name="edit" :size="14" />
            Editar
          </RouterLink>
          <button
            v-else-if="mlItemId"
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="saving"
            @click="showModal = true"
          >
            <AppIcon name="edit" :size="14" />
            Editar
          </button>

          <!-- Sincronizar: chamada de atencao propria, so aparece quando faz sentido -->
          <button
            v-if="needsSync"
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="saving"
            @click="syncNow"
          >
            <AppIcon name="sync" :size="14" />
            Sincronizar
          </button>

          <!-- Demais acoes do ML: menu, pra nao empilhar icone sem rotulo -->
          <div v-if="mlItemId" ref="menuEl" class="relative">
            <button
              type="button"
              class="btn btn-secondary btn-sm btn-icon"
              title="Mais ações"
              :disabled="saving"
              @click="toggleMenu"
            >
              <AppIcon name="more" :size="14" />
            </button>
            <div
              v-if="menuOpen"
              class="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-pop"
            >
              <button
                v-if="productId"
                type="button"
                class="menu-item"
                :disabled="saving"
                @click="runFromMenu(() => (showModal = true))"
              >
                <AppIcon name="edit" :size="14" />
                Editar no ML
              </button>
              <button
                v-if="rawStatus === 'active'"
                type="button"
                class="menu-item"
                :disabled="saving"
                @click="runFromMenu(() => setStatus('paused'))"
              >
                <AppIcon name="pause" :size="14" />
                Pausar
              </button>
              <button
                v-else-if="rawStatus === 'paused'"
                type="button"
                class="menu-item"
                :disabled="saving"
                @click="runFromMenu(() => setStatus('active'))"
              >
                <AppIcon name="play" :size="14" />
                Ativar
              </button>
              <button
                v-if="rawStatus !== 'closed'"
                type="button"
                class="menu-item text-warn-600"
                :disabled="saving"
                @click="runFromMenu(() => setStatus('closed'))"
              >
                <AppIcon name="alert" :size="14" />
                Encerrar
              </button>
              <hr class="my-1 border-line" />
              <button type="button" class="menu-item text-bad-600" :disabled="saving" @click="runFromMenu(remove)">
                <AppIcon name="trash" :size="14" />
                Excluir
              </button>
            </div>
          </div>
        </div>
      </td>

      <MlListingEditModal
        v-if="showModal && mlItemId"
        :item-id="mlItemId"
        :product-id="productId"
        @close="showModal = false"
        @updated="onModalUpdated"
        @synced="onModalSynced"
      />
  </tr>
</template>
