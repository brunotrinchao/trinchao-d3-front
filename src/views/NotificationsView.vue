<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useNotifications } from '../composables/notifications'
import AppIcon from '../components/AppIcon.vue'
import MarketplaceBadge from '../components/MarketplaceBadge.vue'
import type { MlNotification } from '../types'

const { notifications, loading, error, load, startPolling, stopPolling, markAllRead, readSet } = useNotifications()

const typeMeta: Record<MlNotification['type'], { icon: string; tone: string; label: string }> = {
  venda: { icon: 'wallet', tone: 'pill-ok', label: 'Venda' },
  enviado: { icon: 'send', tone: 'pill-neutral', label: 'Enviado' },
  entregue: { icon: 'check', tone: 'pill-ok', label: 'Entregue' },
  atraso: { icon: 'sync', tone: 'pill-warn', label: 'Em trânsito' },
  cancelado: { icon: 'close', tone: 'pill-bad', label: 'Cancelado' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

onMounted(() => {
  void load()
  startPolling()
})
onUnmounted(() => stopPolling())

</script>

<template>
  <section class="mx-auto grid max-w-3xl gap-6">
    <header class="flex items-end justify-between gap-4">
      <div>
        <h1 class="page-title">Notificações</h1>
        <p class="page-sub">Vendas, envios e entregas dos últimos 30 dias</p>
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

    <div v-if="loading" class="card p-6 text-sm text-muted">Carregando notificações…</div>

    <div v-else-if="notifications.length === 0 && !error" class="card grid place-items-center gap-2 p-10 text-center">
      <span class="icon-chip size-12 rounded-2xl"><AppIcon name="check" :size="20" /></span>
      <p class="card-title">Sem novidades</p>
      <p class="card-sub">Nenhum evento nos últimos 30 dias</p>
    </div>

    <template v-else>
      <div class="flex justify-end">
        <button class="btn btn-sm btn-ghost" @click="markAllRead">Marcar todas como lidas</button>
      </div>
      <article
        v-for="n in notifications"
        :key="n.id"
        class="card flex items-start gap-3 p-4"
        :class="!readSet.has(n.id) && 'border-l-4 border-l-brand-500'"
      >
        <span class="icon-chip size-10 shrink-0 rounded-xl">
          <AppIcon :name="typeMeta[n.type].icon" :size="16" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="text-sm font-medium">{{ n.title }}</p>
            <span class="pill" :class="typeMeta[n.type].tone">{{ typeMeta[n.type].label }}</span>
            <MarketplaceBadge marketplace="mercadolivre" />
          </div>
          <p class="mt-0.5 text-[13px] text-ink-2">{{ n.body }}</p>
          <p class="num mt-1 text-[12px] text-muted">{{ formatDate(n.date) }} · pedido {{ n.orderId }}</p>
        </div>
        <span v-if="!readSet.has(n.id)" class="mt-1 size-2 shrink-0 rounded-full bg-brand-500" title="Nova"></span>
      </article>
    </template>
  </section>
</template>
