import { client } from './client'
import type { MlFee, MlShippingQuote } from '../types'

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
