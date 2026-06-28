<script setup lang="ts">
defineProps<{
  columns: string[]
  rows: Array<Record<string, string | number>>
}>()
</script>

<template>
  <div class="mock-table">
    <div class="mock-table__head" :style="{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }">
      <div v-for="column in columns" :key="column">{{ column }}</div>
    </div>
    <div
      v-for="(row, rowIndex) in rows"
      :key="rowIndex"
      class="mock-table__row"
      :style="{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }"
    >
      <div v-for="column in columns" :key="column">{{ row[column] }}</div>
    </div>
  </div>
</template>
