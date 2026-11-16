<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import type { ProductVariation, VariationInput } from '../types'

const props = defineProps<{ variations: ProductVariation[]; busy?: boolean }>()
const emit = defineEmits<{
  create: [VariationInput]
  update: [string, VariationInput]
  remove: [string]
}>()

const draft = reactive<VariationInput>({ name: '', sku: '', stock: 0 })
const edits = ref<Record<string, VariationInput>>({})

// Mantém um rascunho editável por variação, preservando edições não salvas.
watch(
  () => props.variations,
  (list) => {
    const previous = edits.value
    edits.value = Object.fromEntries(
      list.map((v) => [v.id, previous[v.id] ?? { name: v.name, sku: v.sku, stock: v.stock }]),
    )
  },
  { immediate: true },
)

function patch(id: string, key: keyof VariationInput, event: Event): void {
  const current = edits.value[id]
  if (!current) return
  const raw = (event.target as HTMLInputElement).value
  const value = key === 'stock' ? Number(raw) || 0 : raw
  edits.value = { ...edits.value, [id]: { ...current, [key]: value } }
}

function save(id: string): void {
  const current = edits.value[id]
  if (current) emit('update', id, current)
}

function submitDraft(): void {
  if (draft.name.trim() === '') return
  emit('create', { name: draft.name, sku: draft.sku, stock: draft.stock })
  draft.name = ''
  draft.sku = ''
  draft.stock = 0
}
</script>

<template>
  <section class="card">
    <header class="card-head">
      <div class="flex items-center gap-3">
        <span class="icon-chip"><AppIcon name="tag" /></span>
        <div>
          <h2 class="card-title">Variações</h2>
          <p class="card-sub">Cor, tamanho e SKU com estoque próprio</p>
        </div>
      </div>
    </header>

    <div class="card-body overflow-x-auto">
      <table class="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr class="eyebrow">
            <th class="pb-2 font-medium">Nome</th>
            <th class="w-36 pb-2 pl-2 font-medium">SKU</th>
            <th class="w-28 pb-2 pl-2 font-medium">Estoque</th>
            <th class="w-28 pb-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="variation in props.variations" :key="variation.id">
            <td class="py-1">
              <input
                class="input input-sm"
                :value="edits[variation.id]?.name"
                @input="patch(variation.id, 'name', $event)"
              />
            </td>
            <td class="py-1 pl-2">
              <input
                class="input input-sm num"
                :value="edits[variation.id]?.sku"
                @input="patch(variation.id, 'sku', $event)"
              />
            </td>
            <td class="py-1 pl-2">
              <input
                class="input input-sm num"
                type="number"
                min="0"
                :value="edits[variation.id]?.stock"
                @input="patch(variation.id, 'stock', $event)"
              />
            </td>
            <td class="py-1 pl-2">
              <div class="flex justify-end gap-1">
                <button
                  type="button"
                  class="btn btn-secondary btn-icon"
                  title="Salvar"
                  :disabled="props.busy"
                  @click="save(variation.id)"
                >
                  <AppIcon name="check" :size="15" />
                </button>
                <button
                  type="button"
                  class="btn btn-danger btn-icon"
                  title="Remover"
                  :disabled="props.busy"
                  @click="emit('remove', variation.id)"
                >
                  <AppIcon name="trash" :size="15" />
                </button>
              </div>
            </td>
          </tr>

          <tr>
            <td colspan="4" class="pt-2">
              <div class="h-px bg-line"></div>
            </td>
          </tr>
          <tr>
            <td class="pt-3">
              <input v-model="draft.name" class="input input-sm" placeholder="Cor: Azul / Tam: M" />
            </td>
            <td class="pt-3 pl-2">
              <input v-model="draft.sku" class="input input-sm num" placeholder="SKU-001" />
            </td>
            <td class="pt-3 pl-2">
              <input v-model.number="draft.stock" class="input input-sm num" type="number" min="0" />
            </td>
            <td class="pt-3 pl-2">
              <button
                type="button"
                class="btn btn-dark btn-sm w-full"
                :disabled="props.busy"
                @click="submitDraft"
              >
                <AppIcon name="plus" :size="14" />
                Adicionar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
