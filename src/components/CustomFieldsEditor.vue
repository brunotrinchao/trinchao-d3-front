<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import type { ProductCustomField } from '../types'

const props = defineProps<{ fields: ProductCustomField[]; busy: boolean }>()
const emit = defineEmits<{ save: [{ key: string; value: string }[]] }>()

type Row = { key: string; value: string }

const rows = ref<Row[]>([])
const error = ref<string | null>(null)

// Resincroniza quando o pai recarrega o produto (ou as props chegam depois do mount).
watch(
  () => props.fields,
  (fields) => {
    rows.value = fields.map((field) => ({ key: field.key, value: field.value }))
  },
  { immediate: true },
)

const canSave = computed(
  () =>
    !props.busy &&
    rows.value.every((row) => row.key.trim().length > 0 && row.value.trim().length > 0),
)

function addRow(): void {
  rows.value = [...rows.value, { key: '', value: '' }]
}

function removeRow(index: number): void {
  rows.value = rows.value.filter((_, i) => i !== index)
}

function setRow(index: number, patch: Partial<Row>): void {
  rows.value = rows.value.map((row, i) => (i === index ? { ...row, ...patch } : row))
}

function save(): void {
  error.value = null
  if (!canSave.value) {
    error.value = 'Preencha nome e valor de todos os campos antes de salvar.'
    return
  }
  emit('save', rows.value.map((row) => ({ key: row.key.trim(), value: row.value.trim() })))
}
</script>

<template>
  <section class="card">
    <header class="card-head">
      <div class="flex items-center gap-3">
        <span class="icon-chip"><AppIcon name="tag" /></span>
        <div>
          <h2 class="card-title">Características extras</h2>
          <p class="card-sub">
            Campos que o produto não tem por padrão (ex: Materiais, Capacidade). No publish do
            Mercado Livre, viram atributos do anúncio quando casam com um atributo da categoria.
          </p>
        </div>
      </div>
    </header>
    <div class="card-body grid gap-3">
      <div v-if="rows.length === 0" class="text-sm text-muted">
        Nenhum campo extra. Use quando a categoria pedir uma característica que o produto não
        tem (ex: "Materiais").
      </div>

      <div
        v-for="(row, index) in rows"
        :key="index"
        class="grid gap-2 rounded-xl border border-line bg-panel p-3 sm:grid-cols-[220px_minmax(0,1fr)_auto]"
      >
        <label class="block">
          <span class="label">Nome</span>
          <input
            class="input"
            :disabled="props.busy"
            :value="row.key"
            placeholder="Ex: Materiais"
            @input="setRow(index, { key: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <label class="block">
          <span class="label">Valor</span>
          <input
            class="input"
            :disabled="props.busy"
            :value="row.value"
            placeholder="Ex: PLA (plástico biodegradável)"
            @input="setRow(index, { value: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <div class="flex items-end">
          <button
            type="button"
            class="btn btn-secondary btn-sm !text-bad-600"
            :disabled="props.busy"
            title="Remover campo"
            @click="removeRow(index)"
          >
            <AppIcon name="trash" :size="14" />
          </button>
        </div>
      </div>

      <p v-if="error" class="text-xs text-bad-600">{{ error }}</p>
    </div>
    <footer class="flex justify-between border-t border-line bg-panel/70 px-5 py-4 sm:px-6">
      <button type="button" class="btn btn-secondary" :disabled="props.busy" @click="addRow">
        <AppIcon name="plus" :size="14" />
        Adicionar campo
      </button>
      <button type="button" class="btn btn-primary" :disabled="!canSave" @click="save">
        Salvar campos
      </button>
    </footer>
  </section>
</template>
