<script setup lang="ts">
defineProps<{
  columns: string[]
  rows: Array<Record<string, string | number>>
}>()

function cellTone(value: string | number) {
  const text = String(value)

  if (['启用', '上架中', '已配置', '已完成', '正常', '是', 'success'].includes(text)) {
    return 'green'
  }

  if (['待接单', '制作中', '未使用', 'warning', '缺食材', '缺做法', '需部署'].includes(text)) {
    return 'orange'
  }

  if (['禁用', '停用', '下架', '已禁用', '已过期', '已取消', '否', 'error'].includes(text)) {
    return 'danger'
  }

  if (['已使用', 'info', 'mock'].includes(text)) {
    return 'muted'
  }

  return ''
}

function isBadgeCell(value: string | number) {
  return Boolean(cellTone(value))
}
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
      <div v-for="column in columns" :key="column">
        <span v-if="isBadgeCell(row[column])" class="table-badge" :class="`tone-${cellTone(row[column])}`">
          {{ row[column] }}
        </span>
        <span v-else>{{ row[column] }}</span>
      </div>
    </div>
  </div>
</template>
