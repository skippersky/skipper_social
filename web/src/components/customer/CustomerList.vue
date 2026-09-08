<script setup lang="ts">
import CustomerItem from './CustomerItem.vue';
import type { Customer } from '../../types';

defineProps<{ customers: Customer[] }>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'edit', id: string): void;
  (e: 'delete', id: string): void;
}>();
</script>

<template>
  <div class="cust-list">
    <CustomerItem
      v-for="customer in customers"
      :key="customer.id"
      :customer="customer"
      @select="emit('select', customer.id)"
      @edit="emit('edit', customer.id)"
      @delete="emit('delete', customer.id)"
    />
  </div>
</template>

<style scoped>
.cust-list {
  display: flex;
  flex-direction: column;
}
.cust-list > :deep(:not(:last-child)) {
  border-bottom: 1px solid var(--ks-border-default);
}
</style>