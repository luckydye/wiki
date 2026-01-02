<script setup lang="ts">
interface Props {
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: "Field Label",
});
</script>

<template>
  <div class="flex flex-col gap-[4px] flex-1">
    <label class="text-[12px] font-medium leading-[1.5em] text-neutral-800">
      {{ label }}
    </label>
    <slot />
  </div>
</template>