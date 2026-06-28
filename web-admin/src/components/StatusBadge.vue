<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  tone?: 'brand' | 'orange' | 'green' | 'muted'
}>(), {
  tone: 'brand'
})
</script>

<template>
  <span class="status-badge" :class="`tone-${tone}`">{{ label }}</span>
</template>
