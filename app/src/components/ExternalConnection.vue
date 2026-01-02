<script setup lang="ts">
import ExternIcon from "../assets/icons/extern.svg?raw";
import CheckCircleIcon from "../assets/icons/check-circle.svg?raw";

interface Props {
  text?: string;
  icon?: string;
  href?: string;
}

const props = withDefaults(defineProps<Props>(), {
  text: "Button",
  icon: CheckCircleIcon,
  href: "#",
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const handleClick = (event: MouseEvent) => {
  emit("click", event);
};
</script>

<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-3xs px-3xs font-normal text-link text-neutral-700 transition-colors cursor-pointer hover:text-neutral-950"
    @click="handleClick"
  >
    <div v-html="icon" class="w-[18px] h-[18px] shrink-0 text-green-600" />
    <span class="flex-1">{{ text }}</span>
    <div v-html="ExternIcon" class="w-3xs h-3xs shrink-0" />
  </a>
</template>

<style scoped>
a :deep(svg) {
  color: inherit;
}

/* Icon on the left should be green */
a > div:first-of-type :deep(svg) {
  color: #16a34a; /* green-600 */
}

/* External icon on the right inherits text color */
a > div:last-of-type :deep(svg) {
  width: 12px;
  height: 12px;
}
</style>
