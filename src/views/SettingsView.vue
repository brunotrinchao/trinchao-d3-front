<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getAffiliateTag, putAffiliateTag } from '../api/settings'
import { buildAffiliateLink, extractAffiliateTag, validateAffiliateTag } from '../lib/affiliate'
import { apiErrorMessage } from '../api/client'
import AppIcon from '../components/AppIcon.vue'

const props = defineProps<{ secao?: string }>()

/** Seções vieram pro sidebar (sub-menu da sessão Configurações). */
const validSections = ['afiliado', 'conta-ml', 'shopee']
const active = computed(() =>
  validSections.includes(props.secao ?? '') ? (props.secao as string) : 'afiliado',
)

const tag = ref('')
const saved = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)

const activeLabel = computed(() =>
  active.value === 'afiliado'
    ? 'Afiliado Mercado Livre'
    : active.value === 'conta-ml'
      ? 'Conta Mercado Livre'
      : 'Shopee',
)

onMounted(async () => {
  try {
    tag.value = (await getAffiliateTag()) ?? ''
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
})

/** Colou um link de afiliado completo? Extrai a tag na hora (matt: ou tag=). */
watch(tag, (value) => {
  if (value.includes('://')) {
    const extracted = extractAffiliateTag(value)
    if (extracted) tag.value = extracted
  }
})

const formato = computed(() => validateAffiliateTag(tag.value).formato)
const formatoLabel = computed(() =>
  formato.value === 'tag'
    ? 'Formato 1 — tag simples'
    : formato.value === 'matt'
      ? 'Formato 2 — Matt Tool'
      : tag.value.trim()
        ? 'Formato não reconhecido'
        : '',
)

/** Testador: URL ML → link de afiliado gerado, sem tocar no servidor. */
const testUrl = ref('https://www.mercadolivre.com.br/vaso-3d-20cm/p/MLB123456')
const previewLink = computed(() => buildAffiliateLink(testUrl.value, tag.value))
const copied = ref(false)
async function copyPreview(): Promise<void> {
  try {
    await navigator.clipboard.writeText(previewLink.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // clipboard indisponível — link segue visível pra copiar manualmente
  }
}

async function save(): Promise<void> {
  error.value = null
  saved.value = false
  try {
    tag.value = (await putAffiliateTag(tag.value)) ?? ''
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}
</script>

<template>
  <section class="mx-auto grid max-w-4xl gap-6">
    <div v-if="error" class="alert alert-bad" role="alert">
      <AppIcon name="alert" :size="18" />
      <span>{{ error }}</span>
    </div>

    <!-- Afiliado ML -->
    <div v-if="active === 'afiliado'" class="card grid gap-5 p-6">
      <div>
        <h2 class="card-title">Afiliado Mercado Livre</h2>
        <p class="card-sub">
          Tag usada ao gerar links de afiliado dos seus produtos — você ganha comissão por venda
          vinda deles
        </p>
      </div>

      <div class="grid gap-2 text-sm text-ink-2">
        <p class="font-medium">Como encontrar seus dados de afiliado?</p>
        <ol class="list-decimal space-y-1 pl-5">
          <li>
            Acesse o
            <a
              class="underline decoration-line-strong underline-offset-2 hover:text-brand-600"
              href="https://afiliados.mercadolivre.com.br/"
              target="_blank"
              rel="noopener"
              >programa de afiliados do Mercado Livre</a
            >
          </li>
          <li>Faça login com sua conta de afiliado</li>
          <li>Gere um link de afiliado para qualquer produto e cole no campo abaixo — a app extrai a tag sozinha</li>
          <li>
            Se o link contiver <code class="num">matt_word</code> e
            <code class="num">matt_tool</code>, o formato é o 2
          </li>
          <li>Se o link contiver apenas <code class="num">tag</code>, o formato é o 1</li>
          <li>
            O parâmetro <code class="num">ref</code> do link social é um token gerado pelo painel —
            identifica o produto e não pode ser reutilizado. Por isso a app anexa
            <code class="num">matt_word</code>/<code class="num">matt_tool</code> direto no
            permalink do produto
          </li>
        </ol>
      </div>

      <label class="grid gap-1.5">
        <span class="flex items-baseline gap-2 text-sm text-ink-2">
          Sua tag de afiliado
          <span v-if="formatoLabel" class="pill" :class="formato ? 'pill-ok' : 'pill-warn'">{{
            formatoLabel
          }}</span>
        </span>
        <input
          v-model="tag"
          class="input"
          placeholder="Cole seu link de afiliado ou digite matt:usuario:78793736"
          spellcheck="false"
        />
        <span class="text-[12px] text-muted">
          Formato 1 — tag simples: <code class="num">SEUNOME-20</code> · Formato 2 — Matt Tool
          (recomendado): <code class="num">matt:usuario:78793736</code>
        </span>
      </label>

      <!-- Testador -->
      <div class="grid gap-1.5 rounded-2xl border border-line bg-panel p-4">
        <span class="text-sm font-medium text-ink-2">Testar</span>
        <p class="text-[12px] text-muted">
          Use a URL de um anúncio <strong>real</strong> seu — a de exemplo leva a produto
          inexistente. O link gerado só funciona com anúncio existente no ML.
        </p>
        <input v-model="testUrl" class="input" spellcheck="false" placeholder="URL de um anúncio ML" />
        <div class="flex items-start gap-2">
          <code class="num min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-[13px] text-ink-2">{{
            previewLink || '—'
          }}</code>
          <button
            class="btn btn-sm btn-secondary shrink-0"
            :disabled="!previewLink"
            @click="copyPreview"
          >
            <AppIcon :name="copied ? 'check' : 'copy'" :size="14" />
            {{ copied ? 'Copiado!' : 'Copiar' }}
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button class="btn btn-primary" :disabled="loading || formato === null" @click="save">
          Salvar
        </button>
        <span v-if="saved" class="text-[13px] font-medium text-brand-600">Salvo!</span>
      </div>
    </div>

    <!-- Seções ainda sem configuração -->
    <div v-else class="card grid place-items-center gap-2 p-10 text-center">
      <span class="icon-chip size-12 rounded-2xl">
        <AppIcon name="more" :size="20" />
      </span>
      <p class="card-title">{{ activeLabel }}</p>
      <p class="card-sub">Configurações para esta seção chegam em breve</p>
    </div>
  </section>
</template>
