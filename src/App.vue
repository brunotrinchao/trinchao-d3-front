<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './components/AppIcon.vue'
import NotificationsDrawer from './components/NotificationsDrawer.vue'
import { API_URL } from './api/client'
import { fetchAuthStatus } from './api/auth'
import { supabase } from './lib/supabase'
import { useNotifications } from './composables/notifications'
import { MARKETPLACES, MARKETPLACE_LABELS, MARKETPLACE_TONE } from './types'
import type { Marketplace } from './types'

const route = useRoute()
const router = useRouter()

async function logout(): Promise<void> {
  await supabase.auth.signOut()
  await router.replace({ name: 'login' })
}

const connected = ref<Record<Marketplace, boolean>>({ mercadolivre: false, shopee: false })
/** Credencial existe mas token expirou — botao vira "Reconectar conta". */
const expired = ref<Record<Marketplace, boolean>>({ mercadolivre: false, shopee: false })

async function loadAuthStatus(): Promise<void> {
  try {
    const status = await fetchAuthStatus()
    for (const s of status) {
      connected.value[s.marketplace] = s.connected
      expired.value[s.marketplace] = Boolean(s.expired)
    }
  } catch {
    // sidebar so informa estado; falha aqui nao bloqueia o resto da UI
  }
}

onMounted(loadAuthStatus)

/** Central de notificações: badge na sidebar + polling de 60s (ML live API). */
const { unread, load, startPolling, stopPolling, drawerOpen } = useNotifications()
onMounted(() => {
  void load()
  startPolling()
})
onUnmounted(() => stopPolling())

const crumb = computed(() => {
  if (route.path === '/') return 'Produtos'
  if (route.path === '/products/new') return 'Novo produto'
  if (route.path === '/publicados' || route.path === '/anuncios') return 'Publicados'
  if (route.path === '/vendas') return 'Vendas'
  if (route.path === '/perguntas') return 'Perguntas'
  if (route.path === '/configuracoes') return 'Configurações'
  return 'Editar produto'
})

const marketplaceTone = MARKETPLACE_TONE
</script>

<template>
  <!-- Login: página única, sem sidebar/header -->
  <div v-if="route.name === 'login'" class="min-h-screen bg-panel">
    <RouterView />
  </div>

  <div v-else class="min-h-screen lg:p-4">
    <div
      class="mx-auto flex min-h-screen max-w-[1480px] flex-col overflow-hidden bg-panel lg:h-[calc(100vh-2rem)] lg:min-h-0 lg:flex-row lg:rounded-[28px] lg:border lg:border-white/70 lg:shadow-pop"
    >
      <!-- Sidebar -->
      <aside
        class="flex shrink-0 flex-col gap-6 border-b border-line bg-white/80 px-4 py-4 backdrop-blur lg:w-[264px] lg:border-b-0 lg:border-r lg:px-5 lg:py-6"
      >
        <div class="flex items-center justify-between lg:justify-start">
          <RouterLink to="/" class="flex items-center gap-2.5">
            <span
              class="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-brand"
            >
              <AppIcon name="box" :size="20" />
            </span>
            <span class="text-[17px] font-semibold tracking-tight">
              trinchão<span class="text-brand-500">3d</span>
            </span>
          </RouterLink>
        </div>

        <nav class="flex gap-1 lg:flex-col" aria-label="Principal">
          <p class="eyebrow mb-1 hidden px-3 lg:block">Catálogo</p>
          <RouterLink to="/" class="nav-link">
            <AppIcon name="layers" class="nav-ico text-muted" />
            Produtos
          </RouterLink>
          <RouterLink to="/products/new" class="nav-link">
            <AppIcon name="plus" class="nav-ico text-muted" />
            Novo produto
          </RouterLink>
          <p class="eyebrow mb-1 mt-3 hidden px-3 lg:block">Anúncios</p>
          <RouterLink to="/publicados" class="nav-link">
            <AppIcon name="send" class="nav-ico text-muted" />
            Publicados
          </RouterLink>
          <RouterLink to="/vendas" class="nav-link">
            <AppIcon name="wallet" class="nav-ico text-muted" />
            Vendas
          </RouterLink>
          <RouterLink to="/perguntas" class="nav-link">
            <AppIcon name="search" class="nav-ico text-muted" />
            Perguntas
          </RouterLink>
          <RouterLink to="/configuracoes" class="nav-link">
            <AppIcon name="more" class="nav-ico text-muted" />
            Configurações
          </RouterLink>
        </nav>

        <div class="mt-auto hidden rounded-2xl border border-line bg-white p-3 shadow-card lg:block">
          <p class="eyebrow px-1 pb-2">Marketplaces</p>
          <ul class="grid gap-1">
            <li v-for="m in MARKETPLACES" :key="m">
              <a
                :href="connected[m] ? undefined : `${API_URL}/api/auth/${m}`"
                class="group flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 transition"
                :class="connected[m] ? 'cursor-default' : 'hover:bg-panel'"
                :title="connected[m] ? 'Conta conectada' : expired[m] ? 'Token expirado — reconectar conta' : 'Conectar conta'"
              >
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold"
                  :class="marketplaceTone[m]"
                >
                  {{ MARKETPLACE_LABELS[m].charAt(0) }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium leading-tight">
                    {{ MARKETPLACE_LABELS[m] }}
                  </span>
                  <span
                    v-if="connected[m]"
                    class="mt-0.5 flex items-center gap-1 text-xs font-medium text-ok-600"
                  >
                    <AppIcon name="check" :size="12" />
                    Conectado
                  </span>
                  <span
                    v-else
                    class="mt-0.5 block text-xs transition group-hover:text-brand-600"
                    :class="expired[m] ? 'font-medium text-warn-600' : 'text-muted'"
                  >
                    {{ expired[m] ? 'Reconectar conta' : 'Conectar conta' }}
                  </span>
                </span>
              </a>
            </li>
          </ul>
          <button
            type="button"
            class="mt-3 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-xs text-muted transition hover:bg-panel hover:text-ink"
            @click="logout"
          >
            <AppIcon name="close" :size="13" />
            Sair
          </button>
        </div>
      </aside>

      <!-- Conteúdo -->
      <div class="flex min-w-0 flex-1 flex-col">
        <header
          class="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-white/60 px-4 backdrop-blur sm:px-8"
        >
          <div class="flex items-center gap-2 text-sm text-muted">
            <AppIcon name="store" :size="16" />
            <span>Anúncios</span>
            <span class="text-faint">/</span>
            <span class="font-medium text-ink">{{ crumb }}</span>
          </div>
          <div class="flex items-center gap-2">
            <!-- Sino de notificações (abre drawer) -->
            <button
              class="relative grid size-9 place-items-center rounded-xl border border-line bg-white text-ink-2 shadow-card transition-colors hover:bg-panel"
              aria-label="Notificações"
              @click="drawerOpen = true"
            >
              <AppIcon name="bell" :size="16" />
              <span
                v-if="unread.length > 0"
                class="num absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold leading-[18px] text-white"
                >{{ unread.length > 9 ? '9+' : unread.length }}</span
              >
            </button>
            <RouterLink to="/products/new" class="btn btn-primary btn-sm lg:hidden">
              <AppIcon name="plus" :size="15" />
              <span class="sr-only">Novo produto</span>
            </RouterLink>
          </div>
        </header>

        <main class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          <RouterView v-slot="{ Component }">
            <component :is="Component" :key="route.fullPath" class="rise" />
          </RouterView>
        </main>
      </div>

      <NotificationsDrawer />
    </div>
  </div>
</template>
