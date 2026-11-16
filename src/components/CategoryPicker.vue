<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { fetchCategoryChildren, fetchRequiredCategoryAttributes, searchCategories } from '../api/categories'
import { API_URL, apiErrorMessage, apiErrorStatus } from '../api/client'
import AppIcon from './AppIcon.vue'
import { MARKETPLACE_LABELS } from '../types'
import type { CategoryNode } from '../api/categories'
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

// ===== Explorar (navegação hierárquica, só ML) =====
const mode = ref<'search' | 'explore'>(props.marketplace === 'mercadolivre' ? 'explore' : 'search')
const trail = ref<{ id: string; name: string }[]>([])
const nodes = ref<CategoryNode[]>([])
const exploring = ref(false)
const exploreError = ref<string | null>(null)

async function loadChildren(categoryId: string | null, trailEntry: { id: string; name: string } | null, truncateTo?: string): Promise<void> {
  exploring.value = true
  exploreError.value = null
  try {
    if (truncateTo) {
      // clique no breadcrumb: trunca trail até a entrada clicada
      const idx = trail.value.findIndex((t) => t.id === truncateTo)
      trail.value = idx >= 0 ? trail.value.slice(0, idx + 1) : []
    } else if (trailEntry) {
      trail.value = [...trail.value, trailEntry]
    } else {
      trail.value = []
    }
    const list = categoryId
      ? await fetchCategoryChildren(categoryId)
      : (await searchCategories(props.marketplace, '')).map((r) => ({
          id: r.id,
          name: r.path,
          hasChildren: true,
        }))
    nodes.value = list.map((node) => ({
      ...node,
      hasChildren: 'hasChildren' in node ? node.hasChildren : true,
    }))
  } catch (e) {
    exploreError.value = apiErrorMessage(e)
    nodes.value = []
  } finally {
    exploring.value = false
  }
}

async function chooseNode(node: CategoryNode): Promise<void> {
  exploring.value = true
  try {
    const children = await fetchCategoryChildren(node.id)
    if (children.length > 0) {
      await loadChildren(node.id, { id: node.id, name: node.name })
      nodes.value = children
    } else {
      // folha: seleciona
      const path = [...trail.value.map((t) => t.name), node.name].join(' > ')
      emit('select', { id: node.id, path })
      nodes.value = []
      trail.value = []
    }
  } catch (e) {
    exploreError.value = apiErrorMessage(e)
  } finally {
    exploring.value = false
  }
}

const authUrl = computed(() => `${API_URL}/api/auth/${props.marketplace}`)

onMounted(() => {
  if (props.marketplace === 'mercadolivre') loadChildren(null, null)
})

// ===== Busca textual =====
const query = ref('')
const results = ref<CategorySearchResult[]>([])
const searching = ref(false)
const error = ref<string | null>(null)
const needsAuth = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

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

    <!-- ML: navegação hierárquica ou busca textual -->
    <div v-if="props.marketplace === 'mercadolivre'" class="flex gap-1 text-xs">
      <button
        type="button"
        class="rounded-md px-2 py-1 transition"
        :class="mode === 'explore' ? 'bg-brand-100 font-semibold text-brand-800' : 'text-muted hover:text-ink'"
        @click="mode = 'explore'"
      >
        Explorar
      </button>
      <button
        type="button"
        class="rounded-md px-2 py-1 transition"
        :class="mode === 'search' ? 'bg-brand-100 font-semibold text-brand-800' : 'text-muted hover:text-ink'"
        @click="mode = 'search'"
      >
        Buscar
      </button>
    </div>

    <!-- Explorar: trilha + subcategorias -->
    <div v-if="mode === 'explore' && props.marketplace === 'mercadolivre'" class="grid gap-2">
      <div v-if="trail.length > 0" class="flex flex-wrap items-center gap-1 text-xs text-muted">
        <button type="button" class="underline hover:text-ink" @click="loadChildren(null, null)">Início</button>
        <template v-for="t in trail" :key="t.id">
          <span>›</span>
          <button
            type="button"
            class="underline hover:text-ink"
            @click="loadChildren(t.id, null, t.id)"
          >
            {{ t.name }}
          </button>
        </template>
      </div>
      <p v-if="exploreError" class="text-xs text-bad-600">{{ exploreError }}</p>
      <p v-else-if="exploring" class="text-xs text-muted">carregando…</p>
      <ul v-else-if="nodes.length > 0" class="max-h-48 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-white shadow-card">
        <li v-for="node in nodes" :key="node.id">
          <button
            type="button"
            class="w-full cursor-pointer px-3 py-2 text-left text-[13px] transition hover:bg-brand-50 disabled:opacity-50"
            :disabled="props.busy || exploring"
            @click="chooseNode(node)"
          >
            {{ node.name }}
            <span class="num text-xs text-muted">· {{ node.id }}</span>
          </button>
        </li>
      </ul>
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

    <div v-if="mode === 'search' || props.marketplace !== 'mercadolivre'" class="adorn adorn-start">
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

    <template v-if="mode === 'search' || props.marketplace !== 'mercadolivre'">
      <p v-if="needsAuth" class="alert alert-warn !px-3 !py-2 text-xs">
        <span>
          Conecte a conta {{ MARKETPLACE_LABELS[props.marketplace] }} para buscar categorias.
          <a :href="authUrl" class="font-semibold underline">Conectar agora</a>
        </span>
      </p>
      <p v-else-if="error" class="text-xs text-bad-600">{{ error }}</p>
    </template>

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
