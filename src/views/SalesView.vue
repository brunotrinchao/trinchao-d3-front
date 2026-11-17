<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { downloadMlOrderLabel, getMlOrderShipment, getMlOrders } from '../api/marketplace'
import { apiErrorMessage } from '../api/client'
import AppIcon from '../components/AppIcon.vue'
import type { MlOrder, MlShipmentDetail } from '../types'

const PAGE_SIZE = 20

const orders = ref<MlOrder[]>([])
const total = ref(0)
const offset = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)

const qInput = ref('')
const q = ref('')
const status = ref('')
const fromInput = ref('')
const toInput = ref('')

/** debounce da busca: digitação não dispara request a cada tecla */
let qTimer: ReturnType<typeof setTimeout> | undefined
watch(qInput, (value) => {
  clearTimeout(qTimer)
  qTimer = setTimeout(() => {
    q.value = value.trim()
    offset.value = 0
    void load()
  }, 400)
})

watch([status, fromInput, toInput], () => {
  offset.value = 0
  void load()
})

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const res = await getMlOrders({
      q: q.value || undefined,
      status: status.value || undefined,
      from: fromInput.value ? new Date(`${fromInput.value}T00:00:00`).toISOString() : undefined,
      to: toInput.value ? new Date(`${toInput.value}T23:59:59`).toISOString() : undefined,
      offset: offset.value,
    })
    orders.value = res.orders
    total.value = res.total
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

function paginate(delta: number): void {
  offset.value = Math.max(0, offset.value + delta * PAGE_SIZE)
  void load()
}

const pageLabel = (): string => {
  const start = total.value === 0 ? 0 : offset.value + 1
  const end = Math.min(offset.value + orders.value.length, total.value)
  return `${start}–${end} de ${total.value}`
}

/** Expansão de linha: shipment lazy + cache por pedido (1 chamada por pedido). */
const expanded = ref(new Set<string>())
const shipments = ref(new Map<string, { envio: MlShipmentDetail | null; reason?: string }>())
const shipmentLoading = ref(new Set<string>())
const shipmentErrors = ref(new Map<string, string>())

function toggleExpand(order: MlOrder): void {
  const id = order.id
  if (expanded.value.has(id)) {
    expanded.value.delete(id)
    return
  }
  expanded.value.add(id)
  if (!shipments.value.has(id) && order.envio && !shipmentErrors.value.has(id)) {
    void loadShipment(id)
  }
}

async function loadShipment(orderId: string): Promise<void> {
  shipmentLoading.value.add(orderId)
  try {
    shipments.value.set(orderId, await getMlOrderShipment(orderId))
  } catch (e) {
    shipmentErrors.value.set(orderId, apiErrorMessage(e))
  } finally {
    shipmentLoading.value.delete(orderId)
  }
}

const paymentTone = (o: MlOrder): string =>
  o.statusPagamento === 'pago' ? 'pill-ok' : o.statusPagamento === 'pendente' ? 'pill-warn' : 'pill-bad'
const paymentLabel = (o: MlOrder): string =>
  o.statusPagamento === 'pago' ? 'Pago' : o.statusPagamento === 'pendente' ? 'Pendente' : 'Recusado'

const shippingTone = (o: MlOrder): string => {
  const s = o.envio?.status ?? ''
  if (s === 'delivered') return 'pill-ok'
  if (s === 'cancelled') return 'pill-bad'
  return 'pill-neutral'
}

/** Status/substatus do envio ML → PT-BR. Fallback: valor cru. */
const SHIPPING_STATUS_PT: Record<string, string> = {
  pending: 'Pendente',
  handling: 'Preparando',
  ready_to_ship: 'Pronto p/ enviar',
  ready_to_print: 'Pronto p/ imprimir',
  printed: 'Etiqueta impressa',
  shipped: 'Enviado',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  not_delivered: 'Não entregue',
  cancelled: 'Cancelado',
  to_be_agreed: 'A combinar',
  stale: 'Sem movimentação',
  delayed: 'Atrasado',
  lost: 'Extraviado',
}
const shippingLabel = (o: MlOrder): string => {
  const s = o.envio?.status ?? ''
  return SHIPPING_STATUS_PT[s] ?? (o.envio ? s : '—')
}
const shipmentStatusPt = (s: string | undefined): string => (s ? (SHIPPING_STATUS_PT[s] ?? s) : '')

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** URL de rastreamento Correios — só para códigos no formato deles (ex: RB123456789BR). */
function trackingUrl(code: string): string | null {
  if (!/^[A-Z]{2}[0-9]{9,11}BR$/i.test(code.trim())) return null
  return `https://rastreio.correios.com.br/objetos/track?objectCodes=${code.trim().toUpperCase()}`
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const labelBusy = ref<string | null>(null)
async function downloadLabel(orderId: string): Promise<void> {
  if (labelBusy.value) return
  labelBusy.value = orderId
  try {
    await downloadMlOrderLabel(orderId)
  } catch (e) {
    shipmentErrors.value.set(orderId, apiErrorMessage(e))
  } finally {
    labelBusy.value = null
  }
}

const copied = ref<string | null>(null)
const canShare = typeof navigator.share === 'function'

async function shareTracking(code: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Rastreamento da entrega', text: `Código de rastreamento: ${code}` })
      return
    } catch {
      /* cancelado */
    }
  }
  await navigator.clipboard.writeText(code)
}

async function copyTracking(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code)
    copied.value = code
    setTimeout(() => (copied.value = null), 1500)
  } catch {
    // clipboard indisponível (http/permissão) — código segue visível, copiável manualmente
  }
}

onMounted(load)
</script>

<template>
  <section class="mx-auto grid gap-6">

    <button v-if="!loading && !error" class="btn btn-sm btn-ghost justify-self-end" @click="load">
      <AppIcon name="sync" :size="13" />
      Atualizar
    </button>
    <div v-if="error" class="alert alert-bad" role="alert">
      <AppIcon name="alert" :size="18" />
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-secondary ml-auto" @click="load">Tentar de novo</button>
    </div>

    <!-- Filtros -->
    <div class="card flex flex-wrap items-end gap-3 p-4">
      <label class="grid gap-1 text-sm text-ink-2">
        Buscar
        <input v-model="qInput" class="input w-56" type="search" placeholder="comprador ou produto" />
      </label>
      <label class="grid gap-1 text-sm text-ink-2">
        Status
        <select v-model="status" class="input w-40">
          <option value="">Todos</option>
          <option value="paid">Pago</option>
          <option value="pending">Pendente</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </label>
      <label class="grid gap-1 text-sm text-ink-2">
        De
        <input v-model="fromInput" class="input w-40" type="date" />
      </label>
      <label class="grid gap-1 text-sm text-ink-2">
        Até
        <input v-model="toInput" class="input w-40" type="date" />
      </label>
    </div>

    <!-- Tabela -->
    <div class="card overflow-hidden">
      <div v-if="loading" class="p-6 text-sm text-muted">Carregando pedidos…</div>
      <div v-else-if="orders.length === 0" class="p-6 text-sm text-muted">
        Nenhuma venda no período
      </div>
      <table v-else class="hidden w-full text-left text-sm md:table">
        <tbody>
          <template v-for="o in orders" :key="o.id">
            <tr class="table-row cursor-pointer" @click="toggleExpand(o)">
              <td class="whitespace-nowrap px-4 py-3 align-top">{{ formatDate(o.dateCreated) }}</td>
              <td class="px-4 py-3 align-top">
                <p class="font-medium">{{ o.comprador.nome }}</p>
                <p class="text-[12px] text-muted">{{ o.comprador.nickname }}</p>
              </td>
              <td class="px-4 py-3 align-top">
                <div v-for="item in o.itens" :key="`${o.id}-${item.titulo}-${item.sku ?? ''}`" class="mb-1 flex items-start gap-2 last:mb-0">
                  <img
                    v-if="item.thumbnail"
                    :src="item.thumbnail"
                    :alt="item.titulo"
                    class="size-10 shrink-0 rounded-lg border border-line object-cover"
                    loading="lazy"
                  />
                  <span v-else class="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-panel text-faint">
                    <AppIcon name="box" :size="16" />
                  </span>
                  <span>
                    <span class="num">{{ item.quantidade }}×</span> {{ item.titulo }}
                    <span v-if="item.variacao" class="block text-[12px] text-muted">{{ item.variacao }}</span>
                  </span>
                </div>
              </td>
              <td class="num whitespace-nowrap px-4 py-3 align-top">{{ formatPrice(o.total) }}</td>
              <td class="px-4 py-3 align-top">
                <span class="pill" :class="paymentTone(o)">{{ paymentLabel(o) }}</span>
              </td>
              <td class="px-4 py-3 align-top">
                <span class="pill" :class="shippingTone(o)">{{ shippingLabel(o) }}</span>
              </td>
              <td class="w-8 px-4 py-3 align-top text-muted">
                <AppIcon :name="expanded.has(o.id) ? 'up' : 'chevron-down'" :size="16" />
              </td>
            </tr>
            <tr v-if="expanded.has(o.id)" class="table-row bg-faint/20">
              <td :colspan="7" class="px-4 py-4">
                <div v-if="shipmentLoading.has(o.id)" class="text-sm text-muted">
                  Carregando envio…
                </div>
                <div v-else-if="shipmentErrors.has(o.id)" class="text-sm text-bad">
                  {{ shipmentErrors.get(o.id) }}
                </div>
                <div v-else-if="shipments.get(o.id)?.envio === null" class="text-sm text-muted">
                  {{ shipments.get(o.id)?.reason ?? 'detalhes de envio indisponíveis' }}
                </div>
                <dl v-else class="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt class="text-[12px] text-muted">Rastreamento</dt>
                    <dd class="mt-0.5 flex items-center gap-2">
                      <template v-if="shipments.get(o.id)!.envio!.rastreamento">
                        <a
                          v-if="trackingUrl(shipments.get(o.id)!.envio!.rastreamento!)"
                          class="num underline decoration-line-strong underline-offset-2 hover:text-brand-600"
                          :href="trackingUrl(shipments.get(o.id)!.envio!.rastreamento!)!"
                          target="_blank"
                          rel="noopener"
                        >{{ shipments.get(o.id)!.envio!.rastreamento }}</a>
                        <span v-else class="num">{{ shipments.get(o.id)!.envio!.rastreamento }}</span>
                      </template>
                      <span v-else class="num">—</span>
                      <button
                        v-if="shipments.get(o.id)!.envio!.rastreamento"
                        class="btn btn-icon btn-ghost"
                        :title="copied === shipments.get(o.id)!.envio!.rastreamento ? 'Copiado!' : 'Copiar'"
                        @click.stop="copyTracking(shipments.get(o.id)!.envio!.rastreamento!)"
                      >
                        <AppIcon :name="copied === shipments.get(o.id)!.envio!.rastreamento ? 'check' : 'copy'" :size="14" />
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[12px] text-muted">Método</dt>
                    <dd class="mt-0.5">{{ shipments.get(o.id)!.envio!.metodo ?? '—' }}</dd>
                  </div>
                  <div>
                    <dt class="text-[12px] text-muted">Status do envio</dt>
                    <dd class="mt-0.5">
                      {{ shipmentStatusPt(shipments.get(o.id)!.envio!.status)
                      }}<template v-if="shipments.get(o.id)!.envio!.substatus">
                        · {{ shipmentStatusPt(shipments.get(o.id)!.envio!.substatus) }}</template
                      >
                    </dd>
                  </div>
                  <div v-if="shipments.get(o.id)!.envio!.endereco">
                    <dt class="text-[12px] text-muted">Endereço de entrega</dt>
                    <dd class="mt-0.5">
                      {{ shipments.get(o.id)!.envio!.endereco!.rua }},
                      {{ shipments.get(o.id)!.envio!.endereco!.numero }}<template
                        v-if="shipments.get(o.id)!.envio!.endereco!.complemento"
                      >
                        — {{ shipments.get(o.id)!.envio!.endereco!.complemento }}</template
                      >
                      · {{ shipments.get(o.id)!.envio!.endereco!.cidade }}/{{
                        shipments.get(o.id)!.envio!.endereco!.estado
                      }}
                      · CEP {{ shipments.get(o.id)!.envio!.endereco!.cep }}
                    </dd>
                  </div>
                </dl>
                <div
                  v-if="shipments.get(o.id)?.envio?.substatus === 'invoice_pending'"
                  class="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-warn-600/30 bg-warn-50 px-3 py-2 text-[13px] text-warn-600"
                >
                  <AppIcon name="alert" :size="14" />
                  <span>Etiqueta aguarda <strong>faturamento</strong> — emita a DC-e/no painel do ML</span>
                  <a
                    class="btn btn-sm btn-secondary"
                    :href="`https://www.mercadolivre.com.br/vendas/${o.id}/detalhe`"
                    target="_blank"
                    rel="noopener"
                    @click.stop
                  >
                    Faturar no painel ML
                    <AppIcon name="link" :size="13" />
                  </a>
                </div>
                <div v-if="!shipments.get(o.id)?.envio?.rastreamento" class="mt-3 flex items-center gap-2">
                  <button
                    class="btn btn-sm btn-secondary"
                    :disabled="labelBusy === o.id"
                    @click.stop="downloadLabel(o.id)"
                  >
                    <AppIcon name="up" :size="13" />
                    {{ labelBusy === o.id ? 'Baixando…' : 'Baixar etiqueta (PDF)' }}
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Mobile: cards em vez de tabela -->
      <div v-if="!loading && orders.length > 0" class="grid gap-3 md:hidden">
        <article
          v-for="o in orders"
          :key="o.id"
          class="card cursor-pointer p-4"
          @click="toggleExpand(o)"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="o.itens[0]?.thumbnail"
              :src="o.itens[0].thumbnail"
              alt=""
              class="size-12 shrink-0 rounded-xl border border-line object-cover"
              loading="lazy"
            />
            <span v-else class="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-panel text-faint">
              <AppIcon name="box" :size="18" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ o.comprador.nome }}</p>
              <p class="num text-[12px] text-muted">{{ formatDate(o.dateCreated) }}</p>
            </div>
            <div class="text-right">
              <p class="num text-sm font-semibold">{{ formatPrice(o.total) }}</p>
              <span class="pill mt-1 inline-block" :class="paymentTone(o)">{{ paymentLabel(o) }}</span>
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
            <span class="truncate">{{ o.itens[0]?.titulo }}</span>
            <span v-if="o.itens.length > 1" class="text-muted">+{{ o.itens.length - 1 }}</span>
            <span class="ml-auto"><span class="pill" :class="shippingTone(o)">{{ shippingLabel(o) }}</span></span>
          </div>

          <!-- Detalhe expandido (mobile) -->
          <div v-if="expanded.has(o.id)" class="mt-3 border-t border-line pt-3" @click.stop>
            <div v-if="shipmentLoading.has(o.id)" class="text-sm text-muted">Carregando envio…</div>
            <div v-else-if="shipmentErrors.has(o.id)" class="text-sm text-bad">{{ shipmentErrors.get(o.id) }}</div>
            <div v-else-if="shipments.get(o.id)?.envio === null" class="text-sm text-muted">
              {{ shipments.get(o.id)?.reason ?? 'detalhes de envio indisponíveis' }}
            </div>
            <dl v-else class="grid gap-2 text-sm">
              <div>
                <dt class="text-[12px] text-muted">Rastreamento</dt>
                <dd class="num mt-0.5 flex flex-wrap items-center gap-2">
                  <template v-if="shipments.get(o.id)!.envio!.rastreamento">
                    <a
                      v-if="trackingUrl(shipments.get(o.id)!.envio!.rastreamento!)"
                      class="underline decoration-line-strong underline-offset-2"
                      :href="trackingUrl(shipments.get(o.id)!.envio!.rastreamento!)!"
                      target="_blank"
                      rel="noopener"
                    >{{ shipments.get(o.id)!.envio!.rastreamento }}</a>
                    <span v-else>{{ shipments.get(o.id)!.envio!.rastreamento }}</span>
                  </template>
                  <span v-else>—</span>                  {{ shipments.get(o.id)!.envio!.rastreamento ?? '—' }}
                  <button
                    v-if="shipments.get(o.id)!.envio!.rastreamento"
                    class="btn btn-icon btn-ghost"
                    @click="copyTracking(shipments.get(o.id)!.envio!.rastreamento!)"
                  >
                    <AppIcon :name="copied === shipments.get(o.id)!.envio!.rastreamento ? 'check' : 'copy'" :size="13" />
                  </button>
                  <button
                    v-if="shipments.get(o.id)!.envio!.rastreamento && canShare"
                    class="btn btn-icon btn-ghost"
                    aria-label="Compartilhar rastreamento"
                    @click.stop="shareTracking(shipments.get(o.id)!.envio!.rastreamento!)"
                  >
                    <AppIcon name="send" :size="13" />
                  </button>
                </dd>
              </div>
              <div v-if="shipments.get(o.id)!.envio!.endereco">
                <dt class="text-[12px] text-muted">Endereço</dt>
                <dd class="mt-0.5">
                  {{ shipments.get(o.id)!.envio!.endereco!.rua }},
                  {{ shipments.get(o.id)!.envio!.endereco!.numero }}
                  · {{ shipments.get(o.id)!.envio!.endereco!.cidade }}/{{
                    shipments.get(o.id)!.envio!.endereco!.estado
                  }}
                  · CEP {{ shipments.get(o.id)!.envio!.endereco!.cep }}
                </dd>
              </div>
              <div
                v-if="shipments.get(o.id)?.envio?.substatus === 'invoice_pending'"
                class="flex flex-wrap items-center gap-2 rounded-xl border border-warn-600/30 bg-warn-50 px-3 py-2 text-[13px] text-warn-600"
              >
                <AppIcon name="alert" :size="14" />
                <span>Etiqueta aguarda <strong>faturamento</strong></span>
                <a
                  class="btn btn-sm btn-secondary"
                  :href="`https://www.mercadolivre.com.br/vendas/${o.id}/detalhe`"
                  target="_blank"
                  rel="noopener"
                  @click.stop
                >Faturar no painel ML</a>
              </div>
              <button
                v-if="!shipments.get(o.id)?.envio?.rastreamento"
                class="btn btn-sm btn-secondary mt-1"
                :disabled="labelBusy === o.id"
                @click.stop="downloadLabel(o.id)"
              >
                <AppIcon name="up" :size="13" />
                {{ labelBusy === o.id ? 'Baixando…' : 'Baixar etiqueta (PDF)' }}
              </button>
            </dl>
          </div>
        </article>
        <p class="num text-center text-[12px] text-muted">{{ pageLabel() }}</p>
      </div>
      <footer v-if="total > PAGE_SIZE" class="flex items-center justify-between border-t border-line p-3 text-sm">
        <button class="btn btn-sm btn-secondary" :disabled="offset === 0 || loading" @click="paginate(-1)">
          Anterior
        </button>
        <span class="num text-muted">{{ pageLabel() }}</span>
        <button
          class="btn btn-sm btn-secondary"
          :disabled="offset + PAGE_SIZE >= total || loading"
          @click="paginate(1)"
        >
          Próxima
        </button>
      </footer>
    </div>
  </section>
</template>
