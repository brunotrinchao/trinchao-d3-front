<script setup lang="ts">
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 })

const paths: Record<string, string> = {
  box: 'M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Zm0 9 8.5-4.5M12 12 3.5 7.5M12 12v9',
  plus: 'M12 5v14M5 12h14',
  store: 'M3 9l1.5-5h15L21 9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8M10 20v-4h4v4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1',
  'arrow-left': 'M19 12H5m6-6-6 6 6 6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  up: 'M12 19V5m-6 6 6-6 6 6',
  down: 'M12 5v14m6-6-6 6-6-6',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  alert:
    'M12 8v5m0 3.5h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  search: 'm21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5',
  tag: 'M3 12V4h8l10 10-8 8L3 12Zm5-5h.01',
  send: 'm21 3-9.5 18-2.2-7.8L3 11 21 3Zm-11.7 10.2L21 3',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 20h16',
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Zm9-13 4 4',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2Zm13 7h.01',
  ruler: 'm3 17 14-14 4 4L7 21l-4-4Zm5-6 2 2m1-5 2 2m-7 1 2 2',
  pause: 'M8 5v14M16 5v14',
  play: 'm7 5 12 7-12 7V5Z',
  'chevron-down': 'm6 9 6 6 6-6',
  sync: 'M4 12a8 8 0 0 1 14.93-4M20 12a8 8 0 0 1-14.93 4M4 4v5h5M20 20v-5h-5',
  more: 'M12 5v.01M12 12v.01M12 19v.01',
  close: 'M18 6 6 18M6 6l12 12',
}
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="props.name === 'more' ? 3.2 : 1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[props.name] ?? ''" />
  </svg>
</template>
