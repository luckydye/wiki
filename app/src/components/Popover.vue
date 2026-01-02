<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import ButtonGhost from "./ButtonGhost.vue";
import SelectMenu, { type SelectMenuItem } from "./SelectMenu.vue";
import MoreIcon from "../assets/icons/more.svg?raw";

interface Props {
  text?: string;
  icon?: string;
  topItems?: SelectMenuItem[];
  bottomItems?: SelectMenuItem[];
  modelValue?: string | null;
  isOpen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  text: "",
  icon: MoreIcon,
  topItems: () => [],
  bottomItems: () => [],
  modelValue: null,
  isOpen: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:isOpen": [value: boolean];
  select: [item: SelectMenuItem];
  toggle: [];
}>();

const internalOpen = ref(false);
const popoverRef = ref<HTMLElement | null>(null);

// Use external isOpen if provided, otherwise use internal state
const isControlled = computed(() => props.isOpen !== undefined);
const currentOpen = computed(() =>
  isControlled.value ? props.isOpen : internalOpen.value,
);

const togglePopover = (event: Event) => {
  event.stopPropagation();
  if (isControlled.value) {
    emit("toggle");
    emit("update:isOpen", !props.isOpen);
  } else {
    internalOpen.value = !internalOpen.value;
  }
};

const handleSelect = (item: SelectMenuItem) => {
  emit("update:modelValue", item.id);
  emit("select", item);

  if (isControlled.value) {
    emit("update:isOpen", false);
  } else {
    internalOpen.value = false;
  }
};

// Close popover when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (popoverRef.value && !popoverRef.value.contains(event.target as Node)) {
    if (currentOpen.value) {
      if (isControlled.value) {
        emit("update:isOpen", false);
      } else {
        internalOpen.value = false;
      }
    }
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div ref="popoverRef" class="relative inline-block">
    <!-- Popover Menu -->
    <div v-if="currentOpen"
      class="absolute bottom-full mb-3xs left-0 bg-background border border-neutral-100 rounded-lg p-[4px] flex flex-col gap-[4px] z-50 min-w-[205px]"
      style="box-shadow: 0px 2px 24px 0px rgba(0, 0, 0, 0.1)">
      <!-- Top Menu Group -->
      <SelectMenu v-if="topItems.length > 0" :items="topItems" :model-value="modelValue" @select="handleSelect" />

      <!-- Divider -->
      <div v-if="topItems.length > 0 && bottomItems.length > 0" class="h-px w-full bg-neutral-50" />

      <!-- Bottom Menu Group -->
      <SelectMenu v-if="bottomItems.length > 0" :items="bottomItems" :model-value="modelValue" @select="handleSelect" />
    </div>

    <!-- Trigger Button -->
    <div @click="togglePopover">
      <ButtonGhost :text="text" :icon="icon" variant="no-text" />
    </div>
  </div>
</template>
