<script setup lang="ts">
import { MARKETPLACE_LABELS, MARKETPLACE_TONE } from '../types'
import type { Marketplace } from '../types'

const props = withDefaults(defineProps<{ marketplace: Marketplace; size?: number }>(), { size: 20 })
</script>

<template>
  <span
    class="grid shrink-0 place-items-center rounded-md text-[11px] font-bold"
    :class="MARKETPLACE_TONE[props.marketplace]"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
    :title="MARKETPLACE_LABELS[props.marketplace]"
  >
    {{ MARKETPLACE_LABELS[props.marketplace].charAt(0) }}
  </span>
</template>
