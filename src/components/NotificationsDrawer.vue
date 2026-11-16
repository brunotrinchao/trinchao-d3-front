<script setup lang="ts">
import { onMounted } from 'vue'
import { useNotifications } from '../composables/notifications'
import AppIcon from '../components/AppIcon.vue'
import MarketplaceBadge from '../components/MarketplaceBadge.vue'
import type { MlNotification } from '../types'

const { notifications, unread, visible, filter, drawerOpen, loading, error, load, startPolling, markRead, markAllRead, isRead } =
  useNotifications()

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
</script>

<template>
  <Teleport to="body">
    <!-- Overlay -->
    <Transition name="fade">
      <div v-if="drawerOpen" class="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]" @click="drawerOpen = false" />
    </Transition>

    <!-- Painel -->
    <Transition name="slide-right">
      <aside
        v-if="drawerOpen"
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-panel shadow-pop"
        role="dialog"
        aria-label="Central de notificações"
      >
        <header class="flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div>
            <h2 class="text-base font-semibold text-ink">Notificações</h2>
            <p class="text-[12px] text-muted">Últimos 30 dias · Mercado Livre</p>
          </div>
          <button class="btn btn-icon btn-ghost" aria-label="Fechar" @click="drawerOpen = false">
            <AppIcon name="close" :size="16" />
          </button>
        </header>

        <!-- Switch Novas / Todas -->
        <div class="flex items-center justify-between gap-2 border-b border-line bg-white px-5 py-2.5">
          <div class="flex rounded-xl border border-line bg-panel p-0.5 text-[13px]">
            <button
              class="rounded-l-lg px-3 py-1.5 transition-colors"
              :class="filter === 'novas' ? 'bg-white font-medium text-ink shadow-card' : 'text-muted hover:text-ink'"
              @click="filter = 'novas'"
            >
              Novas <span class="num">({{ unread.length }})</span>
            </button>
            <button
              class="rounded-r-lg px-3 py-1.5 transition-colors"
              :class="filter === 'todas' ? 'bg-white font-medium text-ink shadow-card' : 'text-muted hover:text-ink'"
              @click="filter = 'todas'"
            >
              Todas <span class="num">({{ notifications.length }})</span>
            </button>
          </div>
          <button v-if="unread.length > 0" class="btn btn-sm btn-ghost" @click="markAllRead">
            Marcar lidas
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          <div v-if="loading" class="p-4 text-sm text-muted">Carregando…</div>

          <div v-else-if="error" class="alert alert-bad" role="alert">
            <AppIcon name="alert" :size="16" />
            <span>{{ error }}</span>
            <button class="btn btn-sm btn-secondary ml-auto" @click="load">Tentar</button>
          </div>

          <div v-else-if="visible.length === 0" class="grid place-items-center gap-2 p-10 text-center">
            <span class="icon-chip size-12 rounded-2xl"><AppIcon name="check" :size="20" /></span>
            <p class="text-sm font-medium text-ink">
              {{ filter === 'novas' ? 'Nenhuma nova notificação' : 'Sem novidades' }}
            </p>
            <p class="text-[13px] text-muted">
              {{ filter === 'novas' ? 'Tudo lido por aqui' : 'Nenhum evento nos últimos 30 dias' }}
            </p>
          </div>

          <article
            v-for="n in visible"
            :key="n.id"
            class="mb-2 flex items-start gap-3 rounded-2xl border bg-white p-3.5"
            :class="isRead(n.id) ? 'border-line opacity-75' : 'border-brand-200'"
          >
            <span class="icon-chip size-9 shrink-0 rounded-xl">
              <AppIcon :name="typeMeta[n.type].icon" :size="15" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <p class="text-[13px] font-medium text-ink">{{ n.title }}</p>
                <span class="pill" :class="typeMeta[n.type].tone">{{ typeMeta[n.type].label }}</span>
                <MarketplaceBadge marketplace="mercadolivre" />
              </div>
              <p class="mt-0.5 text-[13px] text-ink-2">{{ n.body }}</p>
              <p class="num mt-1 text-[11px] text-muted">{{ formatDate(n.date) }} · pedido {{ n.orderId }}</p>
            </div>
            <button
              v-if="!isRead(n.id)"
              class="btn btn-sm btn-ghost shrink-0"
              title="Marcar como lida"
              @click="markRead(n.id)"
            >
              <AppIcon name="check" :size="14" />
            </button>
          </article>
        </div>

        <footer class="border-t border-line bg-white px-5 py-3">
          <p class="text-[11px] text-muted">Atualiza automaticamente a cada 60s</p>
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
