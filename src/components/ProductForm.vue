<script setup lang="ts">
import { computed, ref } from 'vue'
import { generateDescription } from '../api/ai'
import { apiErrorMessage } from '../api/client'
import AppIcon from './AppIcon.vue'
import { DESCRIPTION_LINES, countDescriptionLines } from '../types'
import type { ProductInput } from '../types'

type NumberField = 'price' | 'stock' | 'weightGrams' | 'heightCm' | 'widthCm' | 'lengthCm'

const props = defineProps<{
  modelValue: ProductInput
  disabled?: boolean
  /** Caracteristicas personalizadas — alimentam a descricao gerada por IA. */
  customFields?: { key: string; value: string }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [ProductInput] }>()

function set<K extends keyof ProductInput>(key: K, value: ProductInput[K]): void {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const generating = ref(false)
const generateError = ref<string | null>(null)

async function onGenerateDescription(): Promise<void> {
  generateError.value = null
  generating.value = true
  try {
    const description = await generateDescription({
      title: props.modelValue.title,
      weightGrams: props.modelValue.weightGrams,
      heightCm: props.modelValue.heightCm,
      widthCm: props.modelValue.widthCm,
      lengthCm: props.modelValue.lengthCm,
      customFields: props.customFields ?? [],
    })
    set('description', description)
  } catch (e) {
    generateError.value = apiErrorMessage(e)
  } finally {
    generating.value = false
  }
}

function setText(key: 'title' | 'description', event: Event): void {
  set(key, (event.target as HTMLInputElement | HTMLTextAreaElement).value)
}

function setNumber(key: NumberField, event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  const parsed = Number(raw)
  set(key, Number.isFinite(parsed) ? parsed : 0)
}

const descriptionLines = computed(() => countDescriptionLines(props.modelValue.description))
const descriptionLinesOk = computed(
  () =>
    descriptionLines.value >= DESCRIPTION_LINES.min && descriptionLines.value <= DESCRIPTION_LINES.max,
)

const dimensions: { key: NumberField; label: string; unit: string }[] = [
  { key: 'weightGrams', label: 'Peso', unit: 'g' },
  { key: 'heightCm', label: 'Altura', unit: 'cm' },
  { key: 'widthCm', label: 'Largura', unit: 'cm' },
  { key: 'lengthCm', label: 'Comprimento', unit: 'cm' },
]
</script>

<template>
  <div class="grid gap-5">
    <label class="block">
      <span class="label">Título</span>
      <input
        class="input"
        :disabled="props.disabled"
        :value="props.modelValue.title"
        placeholder="Ex: Vaso decorativo impresso em 3D"
        @input="setText('title', $event)"
      />
    </label>

    <label class="block">
      <div class="mb-1.5 flex items-center justify-between">
        <span class="label !mb-0">Descrição</span>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="props.disabled || generating || !props.modelValue.title"
          :title="!props.modelValue.title ? 'Preencha o título primeiro' : ''"
          @click="onGenerateDescription"
        >
          <AppIcon name="sync" :size="13" />
          {{ generating ? 'Gerando…' : 'Gerar com IA' }}
        </button>
      </div>
      <textarea
        class="input"
        :disabled="props.disabled"
        :value="props.modelValue.description"
        rows="10"
        placeholder="Material, acabamento, tamanho, cuidados… (ou use o botão acima pra gerar com IA)"
        @input="setText('description', $event)"
      />
      <p class="mt-1.5 text-xs" :class="descriptionLinesOk ? 'text-muted' : 'text-bad-600'">
        {{ descriptionLines }} linha(s) — precisa de {{ DESCRIPTION_LINES.min }} a
        {{ DESCRIPTION_LINES.max }} linhas (uma ideia por linha)
      </p>
      <p v-if="generateError" class="mt-1.5 text-xs text-bad-600">{{ generateError }}</p>
    </label>

    <div class="grid gap-5 sm:grid-cols-2">
      <label class="block">
        <span class="label">Preço</span>
        <div class="adorn adorn-start">
          <span class="adorn-start-el">R$</span>
          <input
            class="input num"
            :disabled="props.disabled"
            :value="props.modelValue.price"
            type="number"
            min="0"
            step="0.01"
            @input="setNumber('price', $event)"
          />
        </div>
      </label>
      <label class="block">
        <span class="label">Estoque</span>
        <div class="adorn">
          <input
            class="input num"
            :disabled="props.disabled"
            :value="props.modelValue.stock"
            type="number"
            min="0"
            step="1"
            @input="setNumber('stock', $event)"
          />
          <span class="adorn-end">un</span>
        </div>
      </label>
    </div>

    <div>
      <p class="eyebrow mb-3">Embalagem e dimensões</p>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label v-for="d in dimensions" :key="d.key" class="block">
          <span class="label">{{ d.label }}</span>
          <div class="adorn">
            <input
              class="input num"
              :disabled="props.disabled"
              :value="props.modelValue[d.key]"
              type="number"
              min="0"
              step="1"
              @input="setNumber(d.key, $event)"
            />
            <span class="adorn-end">{{ d.unit }}</span>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>
