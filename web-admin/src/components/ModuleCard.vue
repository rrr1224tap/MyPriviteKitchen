<script setup lang="ts">
import StatusBadge from './StatusBadge.vue'

defineProps<{
  title: string
  description: string
  tag: string
  tone?: 'brand' | 'orange' | 'green' | 'muted'
}>()

defineEmits<{
  select: []
}>()
</script>

<template>
  <button class="module-card glass-card" type="button" @click="$emit('select')">
    <div class="module-card__top">
      <span class="module-card__icon">{{ title.slice(0, 1) }}</span>
      <StatusBadge :label="tag" :tone="tone || 'orange'" />
    </div>
    <div class="module-card__title">{{ title }}</div>
    <div class="module-card__description">{{ description }}</div>
  </button>
</template>
