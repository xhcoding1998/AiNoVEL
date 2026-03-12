<script setup>
defineProps({
  columns: { type: Array, default: () => [] },
  data: { type: Array, default: () => [] },
  emptyText: { type: String, default: '暂无数据' }
})
</script>

<template>
  <div class="v-table__wrapper">
    <table class="v-table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key" :style="{ width: col.width }">
            {{ col.title }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!data.length">
          <td :colspan="columns.length" class="v-table__empty">{{ emptyText }}</td>
        </tr>
        <tr v-for="(row, idx) in data" :key="row.id || idx">
          <td v-for="col in columns" :key="col.key">
            <slot :name="col.key" :row="row" :index="idx">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.v-table__wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
}

.v-table {
  width: 100%;
  font-size: 14px;
}

.v-table thead {
  background: var(--bg-secondary);
}

.v-table th {
  text-align: left;
  padding: 10px 16px;
  font-weight: 500;
  font-size: 12px;
  color: var(--text-tertiary);
  border-bottom: 1px solid var(--border-default);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.v-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.v-table tbody tr:last-child td {
  border-bottom: none;
}

.v-table tbody tr {
  transition: background var(--transition-fast);
}

.v-table tbody tr:hover {
  background: var(--bg-hover);
}

.v-table__empty {
  text-align: center;
  color: var(--text-tertiary);
  padding: 48px 16px;
}
</style>
