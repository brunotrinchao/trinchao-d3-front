<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { fetchRequiredCategoryAttributes, searchCategories } from '../api/categories'
import { API_URL, apiErrorMessage, apiErrorStatus } from '../api/client'
import AppIcon from './AppIcon.vue'
import { MARKETPLACE_LABELS } from '../types'
import type { CategorySearchResult, Marketplace, MlCategoryAttribute, ProductCategoryMap } from '../types'

const props = defineProps<{
  marketplace: Marketplace
  current?: ProductCategoryMap | null
  busy?: boolean
}>()
const emit = defineEmits<{
  select: [CategorySearchResult]
  'save-attributes': [Record<string, string>]
}>()

const query = ref('')
const results = ref<CategorySearchResult[]>([])
const searching = ref(false)
const error = ref<string | null>(null)
// A taxonomia dos dois marketplaces exige OAuth: ML recusa chamada anônima (401/403)
// e a Shopee responde 501 enquanto não há credencial salva.
const needsAuth = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const authUrl = computed(() => `${API_URL}/api/auth/${props.marketplace}`)

async function run(): Promise<void> {
  const q = query.value.trim()
  if (q === '') {
    results.value = []
    return
  }
  searching.value = true
  error.value = null
  needsAuth.value = false
  try {
    results.value = await searchCategories(props.marketplace, q)
  } catch (e) {
    const status = apiErrorStatus(e)
    needsAuth.value = status === 401 || status === 403 || status === 501
    error.value = apiErrorMessage(e)
    results.value = []
  } finally {
    searching.value = false
  }
}

function onInput(): void {
  clearTimeout(timer)
  timer = setTimeout(run, 350)
}

function choose(category: CategorySearchResult): void {
  emit('select', category)
  results.value = []
  query.value = ''
}

// Atributos de catálogo (BRAND, MODEL etc) — só o ML tem essa API ligada por enquanto.
// Varia por categoria, por isso recarrega sempre que a categoria selecionada muda.
const requiredAttrs = ref<MlCategoryAttribute[]>([])
const loadingAttrs = ref(false)
const attrsError = ref<string | null>(null)
const draftAttrs = reactive<Record<string, string>>({})

watch(
  () => props.current?.categoryId,
  async (categoryId) => {
    requiredAttrs.value = []
    attrsError.value = null
    if (!categoryId || props.marketplace !== 'mercadolivre') return
    loadingAttrs.value = true
    try {
      requiredAttrs.value = await fetchRequiredCategoryAttributes(categoryId)
      for (const attr of requiredAttrs.value) {
        draftAttrs[attr.id] = props.current?.attributes?.[attr.id] ?? ''
      }
    } catch (e) {
      attrsError.value = apiErrorMessage(e)
    } finally {
      loadingAttrs.value = false
    }
  },
  { immediate: true },
)

function saveAttributes(): void {
  emit('save-attributes', { ...draftAttrs })
}
</script>

<template>
  <div class="grid gap-3 rounded-xl border border-line bg-panel p-4">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ MARKETPLACE_LABELS[props.marketplace] }}</h3>
      <span v-if="searching" class="text-xs text-muted">buscando…</span>
    </div>

    <p
      class="rounded-lg border border-line bg-white px-3 py-2 text-[13px]"
      :class="props.current ? 'text-ink' : 'text-faint'"
    >
      <template v-if="props.current">
        {{ props.current.categoryPath }}
        <span class="num text-xs text-muted">· {{ props.current.categoryId }}</span>
      </template>
      <template v-else>Nenhuma categoria selecionada</template>
    </p>

    <div class="adorn adorn-start">
      <span class="adorn-start-el"><AppIcon name="search" :size="14" /></span>
      <input
        v-model="query"
        class="input input-sm"
        placeholder="Buscar categoria…"
        :disabled="props.busy"
        @input="onInput"
        @keyup.enter="run"
      />
    </div>

    <p v-if="needsAuth" class="alert alert-warn !px-3 !py-2 text-xs">
      <span>
        Conecte a conta {{ MARKETPLACE_LABELS[props.marketplace] }} para buscar categorias.
        <a :href="authUrl" class="font-semibold underline">Conectar agora</a>
      </span>
    </p>
    <p v-else-if="error" class="text-xs text-bad-600">{{ error }}</p>

    <ul
      v-if="results.length > 0"
      class="max-h-48 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-white shadow-card"
    >
      <li v-for="category in results" :key="category.id">
        <button
          type="button"
          class="w-full cursor-pointer px-3 py-2 text-left text-[13px] transition hover:bg-brand-50 disabled:opacity-50"
          :disabled="props.busy"
          @click="choose(category)"
        >
          {{ category.path }}
          <span class="num text-xs text-muted">· {{ category.id }}</span>
        </button>
      </li>
    </ul>

    <!-- Atributos de catálogo (BRAND, MODEL etc) exigidos pela categoria escolhida -->
    <div v-if="props.current && loadingAttrs" class="text-xs text-muted">Consultando atributos da categoria…</div>
    <p v-else-if="attrsError" class="text-xs text-bad-600">{{ attrsError }}</p>
    <div v-else-if="requiredAttrs.length > 0" class="grid gap-2 rounded-lg border border-line bg-white p-3">
      <p class="text-xs font-medium text-ink-2">
        Essa categoria exige atributos de catálogo pra publicar
      </p>
      <div v-for="attr in requiredAttrs" :key="attr.id" class="grid gap-1">
        <label class="text-xs text-muted">{{ attr.name }}</label>
        <input v-model="draftAttrs[attr.id]" class="input input-sm" :disabled="props.busy" />
      </div>
      <button type="button" class="btn btn-secondary btn-sm justify-self-start" :disabled="props.busy" @click="saveAttributes">
        <AppIcon name="check" :size="14" />
        Salvar atributos
      </button>
    </div>
  </div>
</template>
