import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'
import ProductListView from '../views/ProductListView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'products', component: ProductListView },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/products/new',
      name: 'product-new',
      component: () => import('../views/ProductNewView.vue'),
    },
    {
      path: '/products/:id',
      name: 'product-edit',
      component: () => import('../views/ProductEditView.vue'),
      props: true,
    },
    {
      path: '/publicados',
      name: 'published-listings',
      component: () => import('../views/PublishedListingsView.vue'),
    },
    {
      path: '/vendas',
      name: 'sales',
      component: () => import('../views/SalesView.vue'),
    },
    // compat: link antigo do painel de anúncios
    { path: '/anuncios', redirect: { name: 'published-listings' } },
  ],
})

// Guard: sem sessão Supabase → /login (exceto rotas meta.public). Já logado → fora do /login.
router.beforeEach(async (to) => {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (to.meta.public) return session && to.name === 'login' ? { name: 'products' } : true
  return session ? true : { name: 'login', query: { redirect: to.fullPath } }
})
