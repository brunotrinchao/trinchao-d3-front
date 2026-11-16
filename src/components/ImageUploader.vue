<script setup lang="ts">
import { ref } from 'vue'
import { assetUrl } from '../api/client'
import AppIcon from './AppIcon.vue'
import type { ProductImage } from '../types'

const props = defineProps<{ images: ProductImage[]; busy?: boolean }>()
const emit = defineEmits<{
  upload: [File[]]
  remove: [string]
  reorder: [ProductImage[]]
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length > 0) emit('upload', files)
  input.value = ''
}

function reorderTo(from: number, to: number): void {
  if (from === to || from < 0 || to < 0 || from >= props.images.length || to >= props.images.length) return
  const next = [...props.images]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  emit(
    'reorder',
    next.map((image, position) => ({ ...image, position })),
  )
}

function move(index: number, delta: number): void {
  reorderTo(index, index + delta)
}

const dragIndex = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent): void {
  dragIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onDrop(index: number): void {
  if (dragIndex.value !== null) reorderTo(dragIndex.value, index)
  dragIndex.value = null
}
</script>

<template>
  <section class="card">
    <header class="card-head">
      <div class="flex items-center gap-3">
        <span class="icon-chip"><AppIcon name="image" /></span>
        <div>
          <h2 class="card-title">Imagens</h2>
          <p class="card-sub">
            <span class="num">{{ props.images.length }}</span> arquivo(s) · a primeira é a capa do anúncio
          </p>
        </div>
      </div>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="props.busy"
        @click="fileInput?.click()"
      >
        <AppIcon name="upload" :size="14" />
        Adicionar
      </button>
    </header>

    <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onPick" />

    <div class="card-body">
      <button
        v-if="props.images.length === 0"
        type="button"
        class="grid w-full cursor-pointer place-items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-panel px-4 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50"
        :disabled="props.busy"
        @click="fileInput?.click()"
      >
        <span class="grid size-11 place-items-center rounded-full bg-white text-brand-500 shadow-card">
          <AppIcon name="upload" :size="20" />
        </span>
        <span class="text-sm font-medium text-ink">Envie as fotos do produto</span>
        <span class="text-xs text-muted">PNG ou JPG · várias de uma vez</span>
      </button>

      <ul v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <li
          v-for="(image, index) in props.images"
          :key="image.id"
          class="group relative overflow-hidden rounded-xl border bg-panel transition"
          :class="dragIndex === index ? 'cursor-grabbing border-brand-400 opacity-50' : 'cursor-grab border-line'"
          draggable="true"
          @dragstart="onDragStart(index, $event)"
          @dragover.prevent
          @drop.prevent="onDrop(index)"
          @dragend="dragIndex = null"
        >
          <img
            :src="assetUrl(image.path)"
            :alt="`Imagem ${index + 1}`"
            class="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            draggable="false"
          />
          <span
            v-if="index === 0"
            class="absolute left-2 top-2 rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur"
          >
            Capa
          </span>
          <div
            class="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-lg bg-white/90 p-1 opacity-0 shadow-card backdrop-blur transition group-hover:opacity-100 focus-within:opacity-100"
          >
            <div class="flex gap-0.5">
              <button
                type="button"
                class="btn btn-ghost btn-icon"
                :disabled="index === 0"
                title="Mover para frente"
                @click="move(index, -1)"
              >
                <AppIcon name="up" :size="14" />
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-icon"
                :disabled="index === props.images.length - 1"
                title="Mover para trás"
                @click="move(index, 1)"
              >
                <AppIcon name="down" :size="14" />
              </button>
            </div>
            <button
              type="button"
              class="btn btn-danger btn-icon"
              :disabled="props.busy"
              title="Remover"
              @click="emit('remove', image.id)"
            >
              <AppIcon name="trash" :size="14" />
            </button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
