import { client } from './client'
import type { MlFee, MlOrder, MlQuestion, MlSalesStats, MlShipmentDetail, MlShippingQuote } from '../types'

/** Comissão real do ML pra preço+categoria+tipo de anúncio (valor exato da API, não estimativa). */
export async function getMlFee(
  price: number,
  categoryId: string,
  listingTypeId: string,
): Promise<MlFee> {
  const { data } = await client.get<MlFee>('/api/marketplace/mercadolivre/fee', {
    params: { price, categoryId, listingTypeId },
  })
  return data
}

/** Cotações de envio ME2: `itemId` (anúncio ML) ou `productId` (produto local, usa dimensões+preço). */
export async function getMlShippingCosts(
  params: { productId?: string; itemId?: string },
): Promise<MlShippingQuote[]> {
  const { data } = await client.get<{ options: MlShippingQuote[] }>(
    '/api/marketplace/mercadolivre/shipping-costs',
    { params },
  )
  return data.options
}

/** Stats de venda read-only: vendas do mês corrente (Orders API) + saldo Mercado Pago.
 * Fonte que falha vem `null` — o bloco mostra "—", nunca número fake. */
export async function getMlSalesStats(): Promise<MlSalesStats> {
  const { data } = await client.get<MlSalesStats>('/api/marketplace/mercadolivre/sales-stats')
  return data
}

/** Lista paginada de pedidos ML (read-only). Filtros: q, status, from/to ISO, offset. */
export async function getMlOrders(
  params: { q?: string; status?: string; from?: string; to?: string; offset?: number } = {},
): Promise<{ orders: MlOrder[]; total: number }> {
  const { data } = await client.get<{ orders: MlOrder[]; total: number }>(
    '/api/marketplace/mercadolivre/orders',
    { params },
  )
  return data
}

/** Detalhe de entrega de um pedido — envio sem frete/indisponível vem `envio: null`. */
export async function getMlOrderShipment(
  orderId: string,
): Promise<{ envio: MlShipmentDetail | null; reason?: string }> {
  const { data } = await client.get<{ envio: MlShipmentDetail | null; reason?: string }>(
    `/api/marketplace/mercadolivre/orders/${orderId}/shipment`,
  )
  return data
}

/** Perguntas não respondidas dos compradores (live API, enriquecidas c/ Product). */
export async function getMlQuestions(): Promise<MlQuestion[]> {
  const { data } = await client.get<MlQuestion[]>('/api/marketplace/mercadolivre/questions')
  return data
}

/** Responde uma pergunta (POST /answers no ML). */
export async function answerMlQuestion(questionId: string, text: string): Promise<void> {
  await client.post(`/api/marketplace/mercadolivre/questions/${questionId}/answer`, { text })
}

/** Rascunho de resposta IA (Gemini, contexto do Product local). Só rascunho. */
export async function suggestMlAnswer(questionId: string, itemId: string, question: string): Promise<string> {
  const { data } = await client.post<{ text: string }>(
    `/api/marketplace/mercadolivre/questions/${questionId}/suggest`,
    { itemId, question },
  )
  return data.text
}
