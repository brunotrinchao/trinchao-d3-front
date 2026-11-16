import { ref } from 'vue'
import { getMlNotifications } from '../api/marketplace'
import type { MlNotification } from '../types'

/** Central de notificações: live API + "lido" em localStorage (single-user,
 * per-device — sem schema no banco). */
const READ_KEY = 't3-read-notifs'

function readIds(): Set<string> {
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
const readSet = readIds()

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

  function markAllRead(): void {
    for (const n of notifications.value) readSet.add(n.id)
    persistRead(readSet)
  }

  const unreadCount = () => notifications.value.filter((n) => !readSet.has(n.id)).length

  return { notifications, loading, error, load, startPolling, stopPolling, markAllRead, unreadCount, readSet }
}
