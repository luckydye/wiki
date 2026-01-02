<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Icon } from "../index.ts";

const getEditor = () => {
  return globalThis.__editor;
};

const shouldShow = ref(false);
const isInColumnLayout = ref(false);
const currentColumnCount = ref(2);

function checkVisibility() {
  const editor = getEditor();
  if (!editor) {
    shouldShow.value = false;
    return;
  }

  isInColumnLayout.value = editor.isActive("columnLayout");

  if (isInColumnLayout.value) {
    updateColumnLayoutInfo();
  }

  shouldShow.value = true;
}

function updateColumnLayoutInfo() {
  const attrs = getEditor().getAttributes("columnLayout");
  currentColumnCount.value = attrs.columns || 2;
}

function setColumnCount(newCount) {
  const { state } = getEditor();
  const { selection } = state;
  const { $from } = selection;

  // Find the column layout node
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "columnLayout") {
      const pos = $from.before(d);
      const currentColumns = node.content.childCount;

      const { tr } = state;

      if (newCount > currentColumns) {
        // Add columns
        for (let i = currentColumns; i < newCount; i++) {
          const columnNode = getEditor().schema.nodes.columnItem.create(
            null,
            getEditor().schema.nodes.paragraph.create(),
          );
          tr.insert(pos + node.nodeSize - 1, columnNode);
        }
      } else if (newCount < currentColumns) {
        // Remove columns from the end
        let offset = 0;
        for (let i = 0; i < currentColumns; i++) {
          const child = node.child(i);
          if (i >= newCount) {
            tr.delete(pos + 1 + offset, pos + 1 + offset + child.nodeSize);
          } else {
            offset += child.nodeSize;
          }
        }
      }

      // Update the columns attribute
      tr.setNodeMarkup(pos, null, { columns: newCount });
      getEditor().view.dispatch(tr);
      currentColumnCount.value = newCount;
      return;
    }
  }
}

onMounted(() => {
  window.addEventListener("editor-update", checkVisibility);
  checkVisibility();
});

onBeforeUnmount(() => {
  window.removeEventListener("editor-update", checkVisibility);
});
</script>

<template>
  <div
    v-if="shouldShow"
    class="fixed right-0 top-30 h-full w-80 bg-background border-l border-gray-200 shadow-lg z-50 overflow-y-auto hidden md:block"
  >
    <div class="p-4 space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-gray-200">
        <h2 class="text-sm font-semibold text-gray-900">Format</h2>
      </div>

      <!-- Text Formatting Section -->
      <div class="space-y-3">
        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wider">Text</h3>
        <div class="flex flex-wrap gap-2">
          <button
            @click="getEditor()?.chain().focus().toggleBold().run()"
            :class="['px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors', { 'bg-blue-100 text-blue-700': getEditor()?.isActive('bold') }]"
            title="Bold"
          >
            <Icon name="bold" />
          </button>
          <button
            @click="getEditor()?.chain().focus().toggleItalic().run()"
            :class="['px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors', { 'bg-blue-100 text-blue-700': getEditor()?.isActive('italic') }]"
            title="Italic"
          >
            <Icon name="italic" />
          </button>
          <button
            @click="getEditor()?.chain().focus().toggleUnderline().run()"
            :class="['px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors', { 'bg-blue-100 text-blue-700': getEditor()?.isActive('underline') }]"
            title="Underline"
          >
            <Icon name="underline" />
          </button>
          <button
            @click="getEditor()?.chain().focus().toggleStrike().run()"
            :class="['px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors', { 'bg-blue-100 text-blue-700': getEditor()?.isActive('strike') }]"
            title="Strikethrough"
          >
            <Icon name="strikethrough" />
          </button>
        </div>
      </div>

      <!-- Alignment Section -->
      <div class="space-y-3">
        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wider">Alignment</h3>
        <div class="flex gap-2">
          <button
            @click="getEditor()?.chain().focus().setTextAlign('left').run()"
            :class="['flex-1 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center justify-center', { 'bg-blue-100 text-blue-700': getEditor()?.isActive({ textAlign: 'left' }) }]"
            title="Align Left"
          >
            <Icon name="align-left" />
          </button>
          <button
            @click="getEditor()?.chain().focus().setTextAlign('center').run()"
            :class="['flex-1 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center justify-center', { 'bg-blue-100 text-blue-700': getEditor()?.isActive({ textAlign: 'center' }) }]"
            title="Align Center"
          >
            <Icon name="align-center" />
          </button>
          <button
            @click="getEditor()?.chain().focus().setTextAlign('right').run()"
            :class="['flex-1 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center justify-center', { 'bg-blue-100 text-blue-700': getEditor()?.isActive({ textAlign: 'right' }) }]"
            title="Align Right"
          >
            <Icon name="align-right" />
          </button>
        </div>
      </div>

      <!-- Column Layout Section -->
      <div v-if="isInColumnLayout" class="space-y-3">
        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wider">Layout</h3>
        <div class="space-y-2">
          <button
            @click="setColumnCount(2)"
            :class="['w-full px-3 py-2 text-sm text-left border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-2', { 'bg-blue-100 text-blue-700': currentColumnCount === 2 }]"
          >
            <Icon name="columns-2" />
            <span>2 Columns</span>
          </button>
          <button
            @click="setColumnCount(3)"
            :class="['w-full px-3 py-2 text-sm text-left border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-2', { 'bg-blue-100 text-blue-700': currentColumnCount === 3 }]"
          >
            <Icon name="columns-3" />
            <span>3 Columns</span>
          </button>
          <button
            @click="setColumnCount(4)"
            :class="['w-full px-3 py-2 text-sm text-left border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-2', { 'bg-blue-100 text-blue-700': currentColumnCount === 4 }]"
          >
            <Icon name="columns-4" />
            <span>4 Columns</span>
          </button>
        </div>
      </div>

      <!-- Insert Column Layout Section -->
      <div v-if="!isInColumnLayout" class="space-y-3">
        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wider">Insert Layout</h3>
        <div class="space-y-2">
          <button
            @click="getEditor()?.chain().focus().setColumnLayout({ columns: 2 }).run()"
            class="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Icon name="columns-2" />
            <span>2 Columns</span>
          </button>
          <button
            @click="getEditor()?.chain().focus().setColumnLayout({ columns: 3 }).run()"
            class="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Icon name="columns-3" />
            <span>3 Columns</span>
          </button>
          <button
            @click="getEditor()?.chain().focus().setColumnLayout({ columns: 4 }).run()"
            class="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Icon name="columns-4" />
            <span>4 Columns</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
