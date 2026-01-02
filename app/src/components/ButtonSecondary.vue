<script setup lang="ts">
const props = defineProps<{
  text?: string;
  icon?: string;
}>();
</script>

<template>
  <button
    class="button-secondary"
  >
    <slot/>
    <div v-html="props.icon" class="text-primary-600" />
    <span v-if="props.text">{{ props.text }}</span>
  </button>
</template>
