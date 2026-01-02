<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { handleImageUpload } from "../editor/extensions/ImageUpload.ts";

const getEditor = () => {
  return globalThis.__editor;
}

const props = defineProps({
  spaceId: {
    type: String,
    required: true,
  },
  documentId: {
    type: String,
    required: true,
  },
});

const menuRef = ref(null);
const isOpen = ref(false);
const query = ref("");
const selectedIndex = ref(0);
const menuStyle = ref({});
const commandRange = ref(null);
const selectedItemRef = ref(null);

const items = [
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: "H2",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: "H3",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: "Heading 4",
    description: "Small section heading",
    icon: "H4",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 4 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Create a simple bullet list",
    icon: "•",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Create a list with numbering",
    icon: "1.",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    description: "Track tasks with a checkbox",
    icon: "☐",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Table",
    description: "Insert a table",
    icon: "⊞",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: "Image",
    description: "Upload and insert an image",
    icon: "🖼️",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      handleImageUpload(editor, props.spaceId, props.documentId);
    },
  },
  {
    title: "2 Columns",
    description: "Insert a 2-column layout",
    icon: "⫴⫴",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setColumnLayout({ columns: 2 })
        .run();
    },
  },
  {
    title: "3 Columns",
    description: "Insert a 3-column layout",
    icon: "⫴⫴⫴",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setColumnLayout({ columns: 3 })
        .run();
    },
  },
  {
    title: "4 Columns",
    description: "Insert a 4-column layout",
    icon: "⫴⫴⫴⫴",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setColumnLayout({ columns: 4 })
        .run();
    },
  },
  {
    title: "HTML Block",
    description: "Insert raw HTML markup",
    icon: "<>",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertHtmlBlock()
        .run();
    },
  },
  {
    title: "Date",
    description: "Insert a date picker",
    icon: "📅",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertDatePicker()
        .run();
    },
  },
];

const filteredItems = computed(() => {
  if (!query.value) return items;
  const lowerQuery = query.value.toLowerCase();
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery),
  );
});

function selectItem(item) {
  if (item && commandRange.value) {
    try {
      item.command({ editor: getEditor(), range: commandRange.value });
      closeMenu();
    } catch(err) {
      console.error(err)
    }
  }
}

function closeMenu() {
  isOpen.value = false;
  query.value = "";
  selectedIndex.value = 0;
  commandRange.value = null;
}

function openMenu(range) {
  commandRange.value = range;
  isOpen.value = true;
  updatePosition();
}

function updatePosition() {
  if (!commandRange.value) return;

  const { view } = getEditor();
  const from = commandRange.value.from;

  const coords = view.coordsAtPos(from);

  menuStyle.value = {
    left: `${coords.left}px`,
    top: `${coords.bottom + 8}px`,
  };
}

async function scrollToSelected() {
  await nextTick();
  if (selectedItemRef.value && menuRef.value) {
    selectedItemRef.value.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }
}

function handleKeyDown(editorEvent: CustomEvent<KeyboardEvent>) {
  if (!isOpen.value) {
    return;
  }

  const event = editorEvent.detail;

  if (event.key === "ArrowDown") {
    selectedIndex.value = (selectedIndex.value + 1) % filteredItems.value.length;
    scrollToSelected();
    editorEvent.preventDefault();
    return;
  }

  if (event.key === "ArrowUp") {
    selectedIndex.value =
      selectedIndex.value <= 0 ? filteredItems.value.length - 1 : selectedIndex.value - 1;
    scrollToSelected();
    editorEvent.preventDefault();
    return;
  }

  if (event.key === "Enter") {
    const item = filteredItems.value[selectedIndex.value];
    if (item) {
      selectItem(item);
    }
    editorEvent.preventDefault();
    return;
  }

  if (event.key === "Escape") {
    closeMenu();
    editorEvent.preventDefault();
    return;
  }
}

function handleInput() {
  const { state } = getEditor();
  const { selection } = state;
  const { $from } = selection;

  const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
  const match = textBefore.match(/^\/([a-zA-Z0-9]*)$/);

  if (match) {
    const [fullMatch, searchQuery] = match;
    query.value = searchQuery;
    const from = $from.pos - fullMatch.length;
    const to = $from.pos;
    openMenu({ from, to });
  } else {
    closeMenu();
  }
}

onMounted(() => {
  window.addEventListener("editor-keydown", handleKeyDown);
  window.addEventListener("editor-update", handleInput);
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', updatePosition);
});

onBeforeUnmount(() => {
  window.removeEventListener("editor-keydown", handleKeyDown);
  window.removeEventListener("editor-update", handleInput);
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition);
});

watch(filteredItems, () => {
  selectedIndex.value = 0;
});
</script>

<template>
  <div
    v-if="isOpen"
    ref="menuRef"
    class="fixed z-50 bg-background rounded-lg shadow-xl border border-neutral-200 w-80 max-h-60 overflow-y-auto"
    :style="menuStyle"
  >
    <div class="py-2">
      <div
        v-for="(item, index) in filteredItems"
        :key="item.title"
        :ref="el => { if (index === selectedIndex) selectedItemRef = el }"
        :class="[
          'flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors',
          { 'bg-neutral-100': index === selectedIndex }
        ]"
        @click="selectItem(item)"
        @mouseenter="selectedIndex = index"
      >
        <div class="w-10 h-10 flex items-center justify-center bg-neutral-300 rounded font-bold text-neutral-900 text-sm shrink-0">
          {{ item.icon }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-neutral-900 text-sm">{{ item.title }}</div>
          <div class="text-xs text-neutral-900 mt-0.5">{{ item.description }}</div>
        </div>
      </div>
      <div v-if="filteredItems.length === 0" class="px-4 py-8 text-center text-sm text-neutral">
        No results found
      </div>
    </div>
  </div>
</template>
