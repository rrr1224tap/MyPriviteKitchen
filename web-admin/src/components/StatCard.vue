<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  caption: string
  icon?: string
  tone?: 'brand' | 'orange' | 'green' | 'muted'
}>()
</script>

<template>
  <article class="stat-card glass-card" :class="tone ? `tone-${tone}` : 'tone-brand'">
    <div class="stat-card__top">
      <div>
        <div class="stat-card__label">{{ title }}</div>
        <div class="stat-card__value">{{ value }}</div>
      </div>
      <span class="stat-card__icon">{{ icon || title.slice(0, 1) }}</span>
    </div>
    <div class="stat-card__caption">{{ caption }}</div>
  </article>
</template>
