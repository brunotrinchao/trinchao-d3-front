import { createRouter, createWebHistory } from 'vue-router'
import ProductListView from '../views/ProductListView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'products', component: ProductListView },
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
    // compat: link antigo do painel de anúncios
    { path: '/anuncios', redirect: { name: 'published-listings' } },
  ],
})
