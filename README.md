# Frontend — Trinchão 3D

Interface Vue 3 + Vite + TypeScript para cadastro de anúncios de produto e publicação
em Mercado Livre e Shopee. Consome a API descrita em `../CONTRACT.md`.

## Configuração

```bash
cp .env.example .env   # ajuste VITE_API_URL se o backend não estiver em localhost:3001
npm install
npm run dev            # http://localhost:5173
```

O backend (`../backend`, Next.js em `http://localhost:3001`) precisa estar rodando com
CORS liberado para `http://localhost:5173`.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | servidor de desenvolvimento (porta 5173) |
| `npm run build` | type-check (`vue-tsc`) + build de produção em `dist/` |
| `npm run preview` | serve o build de produção |

## Telas

- `/` — lista de produtos com preço, estoque e status de cada listing (ML / Shopee)
- `/products/new` — criação: título, descrição, preço, estoque, peso e dimensões
- `/products/:id` — edição completa: dados básicos, imagens, variações, categoria por
  marketplace e publicação

## Estrutura

```
src/
  api/        client axios (VITE_API_URL) + um módulo por recurso
  components/ ImageUploader, VariationEditor, CategoryPicker, ListingStatusBadge, ProductForm
  router/     rotas do Vue Router
  stores/     store Pinia de produtos (lista + cache de detalhe)
  views/      telas de lista, criação e edição
  types.ts    tipos espelhando o schema Prisma do contrato
```
# trinchao-d3-front
