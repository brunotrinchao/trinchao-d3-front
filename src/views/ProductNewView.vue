<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ProductForm from '../components/ProductForm.vue'
import AppIcon from '../components/AppIcon.vue'
import { createProduct } from '../api/products'
import { apiErrorMessage } from '../api/client'
import type { ProductInput } from '../types'

const router = useRouter()

const form = ref<ProductInput>({
  title: '',
  description: '',
  price: 0,
  stock: 0,
  weightGrams: 0,
  heightCm: 0,
  widthCm: 0,
  lengthCm: 0,
})

const saving = ref(false)
const error = ref<string | null>(null)

async function submit(): Promise<void> {
  if (form.value.title.trim() === '') {
    error.value = 'Informe um título.'
    return
  }
  saving.value = true
  error.value = null
  try {
    const product = await createProduct(form.value)
    router.push(`/products/${product.id}`)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="mx-auto grid gap-6">
    <header>
      <RouterLink to="/" class="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
        <AppIcon name="arrow-left" :size="15" />
        Produtos
      </RouterLink>
      <h1 class="page-title">Novo produto</h1>
      <p class="page-sub">Comece pelos dados básicos. O resto você completa na edição.</p>
    </header>

    <div v-if="error" class="alert alert-bad">
      <AppIcon name="alert" :size="18" />
      <span>{{ error }}</span>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="flex items-center gap-3">
          <span class="icon-chip"><AppIcon name="box" /></span>
          <div>
            <h2 class="card-title">Dados básicos</h2>
            <p class="card-sub">Título, preço, estoque e embalagem</p>
          </div>
        </div>
      </div>
      <div class="card-body">
        <ProductForm v-model="form" :disabled="saving" />
      </div>
      <footer
        class="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-panel/70 px-5 py-4 sm:px-6"
      >
        <span class="text-[13px] text-muted">
          Imagens, variações e categorias ficam na tela de edição.
        </span>
        <div class="flex gap-2">
          <RouterLink to="/" class="btn btn-ghost">Cancelar</RouterLink>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="submit">
            {{ saving ? 'Salvando…' : 'Criar produto' }}
          </button>
        </div>
      </footer>
    </div>
  </section>
</template>
