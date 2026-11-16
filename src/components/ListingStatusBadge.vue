<script setup lang="ts">
import { computed } from 'vue'
import { MARKETPLACE_LABELS } from '../types'
import type { Marketplace, MarketplaceListing } from '../types'

const props = defineProps<{
  marketplace: Marketplace
  listing?: MarketplaceListing | null
}>()

const status = computed(() => props.listing?.status ?? 'none')

const styles: Record<string, string> = {
  none: 'pill-neutral',
  pending: 'pill-warn',
  published: 'pill-ok',
  failed: 'pill-bad',
}

const labels: Record<string, string> = {
  none: 'não publicado',
  pending: 'pendente',
  published: 'publicado',
  failed: 'falhou',
}
</script>

<template>
  <span class="pill" :class="styles[status]" :title="props.listing?.errorMessage || undefined">
    {{ MARKETPLACE_LABELS[props.marketplace] }} · {{ labels[status] }}
  </span>
</template>
