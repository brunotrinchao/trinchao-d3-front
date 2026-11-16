import { computed, ref } from 'vue'
import { getMlNotifications } from '../api/marketplace'
import type { MlNotification } from '../types'

/** Central de notificações: live API + "lido" em localStorage (single-user,
 * per-device — sem schema no banco). Estado é singleton (drawer global). */
const READ_KEY = 't3-read-notifs'

function loadReadIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function persistRead(ids: Set<string>): void {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]))
  } catch {
    // storage indisponível — badge volta no próximo load, sem quebrar
  }
}

const notifications = ref<MlNotification[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const drawerOpen = ref(false)
const filter = ref<'novas' | 'todas'>('novas')
const readSet = ref<Set<string>>(loadReadIds())

let timer: ReturnType<typeof setInterval> | undefined

export function useNotifications() {
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      notifications.value = await getMlNotifications()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** Polling de novos eventos (padrão 60s — rate limit ML ok pra single-user). */
  function startPolling(intervalMs = 60_000): void {
    stopPolling()
    timer = setInterval(() => {
      if (!loading.value) void load()
    }, intervalMs)
  }

  function stopPolling(): void {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  function markRead(id: string): void {
    const next = new Set(readSet.value)
    next.add(id)
    readSet.value = next
    persistRead(next)
  }

  function markAllRead(): void {
    const next = new Set(readSet.value)
    for (const n of notifications.value) next.add(n.id)
    readSet.value = next
    persistRead(next)
  }

  const isRead = (id: string) => readSet.value.has(id)
  const unread = computed(() => notifications.value.filter((n) => !isRead(n.id)))
  const visible = computed(() =>
    filter.value === 'novas' ? unread.value : notifications.value,
  )

  return {
    notifications,
    unread,
    visible,
    filter,
    drawerOpen,
    loading,
    error,
    load,
    startPolling,
    stopPolling,
    markRead,
    markAllRead,
    isRead,
  }
}
