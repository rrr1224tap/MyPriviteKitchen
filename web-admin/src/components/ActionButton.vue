<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'normal' | 'small'
}>(), {
  variant: 'ghost',
  size: 'normal'
})
</script>

<template>
  <button
    class="action-button"
    :class="[`action-button--${variant}`, `action-button--${size}`]"
    type="button"
  >
    <slot />
  </button>
</template>
