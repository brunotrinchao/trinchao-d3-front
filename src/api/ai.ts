import { client } from './client'

export interface GenerateDescriptionInput {
  title: string
  weightGrams: number
  heightCm: number
  widthCm: number
  lengthCm: number
  /** Caracteristicas personalizadas do produto — guiam a descricao gerada. */
  customFields?: { key: string; value: string }[]
}

/** Opcional — botao "Gerar com IA" na descricao. Nao persiste nada, so devolve o texto. */
export async function generateDescription(input: GenerateDescriptionInput): Promise<string> {
  const { data } = await client.post<{ description: string }>('/api/ai/generate-description', input)
  return data.description
}
