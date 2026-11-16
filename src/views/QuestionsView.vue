<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { answerMlQuestion, getMlQuestions, suggestMlAnswer } from '../api/marketplace'
import { apiErrorMessage } from '../api/client'
import AppIcon from '../components/AppIcon.vue'
import type { MlQuestion } from '../types'

const questions = ref<MlQuestion[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const sending = reactive(new Set<string>())
const suggesting = reactive(new Set<string>())
const answers = ref<Record<string, string>>({})
const errors = reactive(new Map<string, string>())
const answeredIds = reactive(new Set<string>())

/** Rascunho IA — só preenche o campo; o vendedor edita antes de enviar. */
async function suggest(q: MlQuestion): Promise<void> {
  if (suggesting.has(q.id)) return
  suggesting.add(q.id)
  errors.delete(q.id)
  try {
    answers.value[q.id] = await suggestMlAnswer(q.id, q.itemId, q.texto)
  } catch (e) {
    errors.set(q.id, apiErrorMessage(e))
  } finally {
    suggesting.delete(q.id)
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    questions.value = await getMlQuestions()
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

async function send(q: MlQuestion): Promise<void> {
  const text = (answers.value[q.id] ?? '').trim()
  if (!text || sending.has(q.id)) return
  sending.add(q.id)
  errors.delete(q.id)
  try {
    await answerMlQuestion(q.id, text)
    answeredIds.add(q.id)
    questions.value = questions.value.filter((x) => x.id !== q.id)
  } catch (e) {
    errors.set(q.id, apiErrorMessage(e))
  } finally {
    sending.delete(q.id)
  }
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

onMounted(load)
</script>

<template>
  <section class="mx-auto grid max-w-4xl gap-6">
    <header class="flex items-end justify-between gap-4">
      <div>
        <h1 class="page-title">Perguntas</h1>
        <p class="page-sub">Não respondidas — responda direto da app, sem abrir o painel do ML</p>
      </div>
      <button class="btn btn-secondary" :disabled="loading" @click="load">
        <AppIcon name="sync" :size="14" />
        Atualizar
      </button>
    </header>

    <div v-if="error" class="alert alert-bad" role="alert">
      <AppIcon name="alert" :size="18" />
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-secondary ml-auto" @click="load">Tentar de novo</button>
    </div>

    <div v-if="loading" class="card p-6 text-sm text-muted">Carregando perguntas…</div>

    <div v-else-if="questions.length === 0 && !error" class="card grid place-items-center gap-2 p-10 text-center">
      <span class="icon-chip size-12 rounded-2xl"><AppIcon name="check" :size="20" /></span>
      <p class="card-title">Tudo respondido</p>
      <p class="card-sub">Nenhuma pergunta pendente no momento</p>
    </div>

    <article v-for="q in questions" :key="q.id" class="card grid gap-3 p-5">
      <div class="flex items-start gap-3">
        <img
          v-if="q.produto?.thumbnail ?? q.anuncio.thumbnail"
          :src="q.produto?.thumbnail ?? q.anuncio.thumbnail ?? ''"
          alt=""
          class="size-12 shrink-0 rounded-xl border border-line object-cover"
          loading="lazy"
        />
        <span v-else class="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-panel text-faint">
          <AppIcon name="box" :size="18" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ q.produto?.titulo || q.anuncio.titulo || 'Anúncio' }}</p>
          <p class="text-[12px] text-muted">
            {{ q.comprador || 'Comprador' }} · {{ formatDate(q.data) }}
          </p>
        </div>
        <span class="pill pill-warn shrink-0">Pergunta</span>
      </div>

      <p class="rounded-xl bg-panel px-4 py-3 text-sm text-ink-2">{{ q.texto }}</p>

      <label class="grid gap-1.5">
        <span class="flex items-center justify-between gap-2 text-sm">
          <span class="font-medium text-ink-2">Sua resposta</span>
          <button
            class="btn btn-sm btn-ghost"
            :disabled="suggesting.has(q.id)"
            @click="suggest(q)"
          >
            <AppIcon name="edit" :size="13" />
            {{ suggesting.has(q.id) ? 'Gerando…' : 'Sugerir com IA' }}
          </button>
        </span>
        <textarea
          v-model="answers[q.id]"
          class="input"
          rows="3"
          placeholder="Responda como vendedor — seja claro e direto"
        ></textarea>      </label>

      <div v-if="errors.get(q.id)" class="text-[13px] text-bad">{{ errors.get(q.id) }}</div>

      <div class="flex items-center gap-3">
        <button
          class="btn btn-primary"
          :disabled="sending.has(q.id) || !(answers[q.id] ?? '').trim()"
          @click="send(q)"
        >
          {{ sending.has(q.id) ? 'Enviando…' : 'Responder' }}
        </button>
      </div>
    </article>
  </section>
</template>
