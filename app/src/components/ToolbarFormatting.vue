<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import { Actions } from "../utils/actions";
import { registerFormattingActions, unregisterFormattingActions } from "../utils/formattingActions";
import {
  toggleImageFullWidth,
  resetImageSize,
  isImageSelected,
  getImageAttributes,
} from "../editor/commands/imageCommands.ts";

const getEditor = () => {
  return globalThis.__editor;
}

const menuRef = ref(null);
const shouldShow = ref(false);
const menuStyle = ref({});
const isPinned = ref(true);
const textColorInput = ref(null);
const bgColorInput = ref(null);
const cellBgColorInput = ref(null);
const isInteractingWithMenu = ref(false);
const isEditMode = ref(false);
const isInTable = ref(false);
const cellBackgroundColor = ref("transparent");
const copiedRow = ref(null);
const isInColumnLayout = ref(false);
const currentColumnCount = ref(2);
const isImageActive = ref(false);
const currentImageWidth = ref(null);
const currentImageDisplay = ref(null);
const headingDropdownOpen = ref(false);
const headingButtonRef = ref(null);

const currentHeadingLevel = ref(0); // 0 means paragraph

function updateCurrentHeadingLevel() {
  for (let level = 1; level <= 6; level++) {
    if (getEditor().isActive('heading', { level })) {
      currentHeadingLevel.value = level;
      return;
    }
  }
  currentHeadingLevel.value = 0;
}

function setHeading(level) {
  if (level === 0) {
    Actions.run("format:heading:paragraph");
  } else {
    Actions.run(`format:heading:${level}`);
  }
  headingDropdownOpen.value = false;
}

const headingDropdownStyle = computed(() => {
  if (!headingButtonRef.value || !headingDropdownOpen.value) {
    return {};
  }
  const rect = headingButtonRef.value.getBoundingClientRect();
  return {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    zIndex: 9999,
  };
});

const currentTextColor = ref("#000000");
const currentBgColor = ref("transparent");

function updateCurrentColors() {
  const attrs = getEditor().getAttributes("textStyle");
  currentTextColor.value = attrs.color || "#000000";
  currentBgColor.value = attrs.backgroundColor || "transparent";
}

function setLink() {
  Actions.run("format:link");
}

function setTextColor(event) {
  getEditor().chain().focus().setColor(event.target.value).run();
}

function setBgColor(event) {
  getEditor().chain().focus().setBackgroundColor(event.target.value).run();
}

function clearBgColor() {
  Actions.run("format:color:clear");
}

function togglePin() {
  isPinned.value = !isPinned.value;
  localStorage.setItem("toolbar-pinned", String(isPinned.value));
  updatePosition();
}

function checkVisibility() {
  const editor = getEditor();
  
  // If editor is not available or destroyed, unregister actions and hide toolbar
  if (!editor || editor.isDestroyed) {
    if (isEditMode.value) {
      isEditMode.value = false;
      unregisterFormattingActions();
    }
    shouldShow.value = false;
    return;
  }
  
  isInTable.value = editor.isActive("table");
  isInColumnLayout.value = editor.isActive("columnLayout");
  isImageActive.value = isImageSelected(editor);
  updateCurrentHeadingLevel();
  updateCurrentColors();

  // When pinned, always show the toolbar
  if (isPinned.value) {
    shouldShow.value = true;
    updatePosition();
    if (isInTable.value) {
      updateCellBackgroundColor();
    }
    if (isInColumnLayout.value) {
      updateColumnLayoutInfo();
    }
    return;
  }

  if (isInTable.value) {
    shouldShow.value = true;
    updatePosition();
    updateCellBackgroundColor();
    return;
  }

  if (isInColumnLayout.value) {
    shouldShow.value = true;
    updatePosition();
    updateColumnLayoutInfo();
    return;
  }

  if (isImageActive.value) {
    shouldShow.value = true;
    updatePosition();
    updateImageInfo();
    return;
  }

  const { state } = getEditor();
  const { selection } = state;
  const { from, to } = selection;

  if (from === to) {
    shouldShow.value = false;
    return;
  }

  const selectedText = state.doc.textBetween(from, to, " ");
  if (selectedText.trim().length === 0) {
    shouldShow.value = false;
    return;
  }

  shouldShow.value = true;
  updatePosition();
}

function updateCellBackgroundColor() {
  const attrs = getEditor().getAttributes("tableCell");
  cellBackgroundColor.value = attrs.backgroundColor || "transparent";
}

function setCellBackground(event) {
  getEditor()
    .chain()
    .focus()
    .setCellAttribute("backgroundColor", event.target.value)
    .run();
}

function clearCellBackground() {
  getEditor().chain().focus().setCellAttribute("backgroundColor", null).run();
}

function insertExpressionCell() {
  getEditor().chain().focus().insertExpressionCell({ formula: "=" }).run();
}

function cutRow() {
  const { state } = getEditor();
  const { selection } = state;
  const { $from } = selection;

  // Find the current row
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "tableRow") {
      // Store the row content
      copiedRow.value = node.toJSON();
      // Delete the row
      getEditor().chain().focus().deleteRow().run();
      return;
    }
  }
}

function pasteRow() {
  if (!copiedRow.value) return;

  const { state, view } = getEditor();
  const { tr, selection, schema } = state;
  const { $from } = selection;

  // Find current row position in table
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "tableRow") {
      // Create the copied row from JSON
      const copiedRowNode = schema.nodeFromJSON(copiedRow.value);

      // Insert directly after the current row
      const insertPos = $from.after(d);
      tr.insert(insertPos, copiedRowNode);
      view.dispatch(tr);
      return;
    }
  }
}

function updateColumnLayoutInfo() {
  const attrs = getEditor().getAttributes("columnLayout");
  currentColumnCount.value = attrs.columns || 2;
}

function updateImageInfo() {
  const attrs = getImageAttributes(getEditor());
  currentImageWidth.value = attrs?.width || null;
  currentImageDisplay.value = attrs?.display || null;
}

function toggleFullWidth() {
  toggleImageFullWidth(getEditor());
  updateImageInfo();
}

function resetImage() {
  resetImageSize(getEditor());
  updateImageInfo();
}

function canIndentListItem() {
  const editor = getEditor();
  return editor.can().sinkListItem('listItem') || editor.can().sinkListItem('taskItem');
}

function canOutdentListItem() {
  const editor = getEditor();
  return editor.can().liftListItem('listItem') || editor.can().liftListItem('taskItem');
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

function deleteColumnLayout() {
  Actions.run("format:columns:delete");
}

function updatePosition() {
  if (!shouldShow.value) return;

  if (isPinned.value) {
    menuStyle.value = {};
    return;
  }

  const { state, view } = getEditor();
  const { selection } = state;
  const { from } = selection;

  const $from = state.doc.resolve(from);

  let tableNode = null;
  let tableDepth = null;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "table") {
      tableNode = node;
      tableDepth = depth;
      break;
    }
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const toolbarHeight = 48;
  const padding = 8;

  let left, top;

  if (tableNode && tableDepth !== null) {
    const tablePos = $from.before(tableDepth);
    const tableStartCoords = view.coordsAtPos(tablePos);

    left = tableStartCoords.left;
    top = tableStartCoords.top - toolbarHeight;

    if (top < padding) {
      top = padding;
    }
  } else {
    const nodeDepth = $from.depth;
    const nodeStartPos = $from.start(nodeDepth);
    const nodeCoords = view.coordsAtPos(nodeStartPos);

    left = nodeCoords.left;
    top = nodeCoords.top - toolbarHeight;

    if (top < padding) {
      top = padding;
    }
  }

  const menuWidth = menuRef.value?.offsetWidth ?? 600;
  const maxLeft = viewportWidth - menuWidth - padding;

  if (left < padding) {
    left = padding;
  } else if (left > maxLeft) {
    left = Math.max(padding, maxLeft);
  }

  if (top + toolbarHeight > viewportHeight - padding) {
    top = viewportHeight - toolbarHeight - padding;
  }

  menuStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
  };
}

function handleKeyDown(event) {
  if (event.key === "Escape" && shouldShow.value) {
    shouldShow.value = false;
    isInteractingWithMenu.value = false;
    event.preventDefault();
  }
}

function handleMenuMouseDown() {
  isInteractingWithMenu.value = true;
}

function handleMenuMouseUp() {
  setTimeout(() => {
    isInteractingWithMenu.value = false;
  }, 100);
}

function handleClickOutside(event) {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    setTimeout(() => {
      isInteractingWithMenu.value = false;
      headingDropdownOpen.value = false;
    }, 100);
  }
}

// Handle color picker events from Actions
function handleTextColorOpen() {
  textColorInput.value?.click();
}

function handleBgColorOpen() {
  bgColorInput.value?.click();
}

// Handle edit mode changes
function handleEditModeStart() {
  if (!isEditMode.value) {
    isEditMode.value = true;
    registerFormattingActions();
  }
}

function handleEditModeEnd() {
  if (isEditMode.value) {
    isEditMode.value = false;
    unregisterFormattingActions();
  }
}

onMounted(() => {
  const savedPinState = localStorage.getItem("toolbar-pinned");
  if (savedPinState !== null) {
    isPinned.value = savedPinState === "true";
  }

  window.addEventListener("editor-update", checkVisibility);

  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("pointerup", handleClickOutside);
  document.addEventListener("scroll", updatePosition, { passive: true, capture: true });
  window.addEventListener("resize", updatePosition, { passive: true });

  // Listen for edit mode events
  window.addEventListener("edit-mode-start", handleEditModeStart);
  window.addEventListener("editor-ready", handleEditModeStart);

  // Subscribe to color picker events
  Actions.subscribe("format:color:text:open", handleTextColorOpen);
  Actions.subscribe("format:color:background:open", handleBgColorOpen);
});

onBeforeUnmount(() => {
  // Unregister formatting actions if still in edit mode
  if (isEditMode.value) {
    unregisterFormattingActions();
  }

  window.removeEventListener("edit-mode-start", handleEditModeStart);
  window.removeEventListener("editor-ready", handleEditModeStart);

  window.removeEventListener("editor-update", checkVisibility);

  document.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("pointerup", handleClickOutside);
  document.removeEventListener("scroll", updatePosition);
  window.removeEventListener("resize", updatePosition);
});

</script>

<template>
  <div
    v-if="shouldShow"
    ref="menuRef"
    :class="['floating-menu', { 'floating-menu--pinned': isPinned }]"
    :style="menuStyle"
    @mousedown="handleMenuMouseDown"
    @mouseup="handleMenuMouseUp"
  >
    <!-- Image Actions (shown when image is selected) -->
    <div v-if="isImageActive" class="toolbar-section">
      <div class="menu-group">
        <button
          @click="toggleFullWidth"
          :class="['menu-btn', { active: currentImageDisplay === 'full' }]"
          title="Toggle Full Width (drag corner to resize)"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 15h2v2h-2v-2zm0-4h2v2h-2v-2zm2 8h-2v2c1 0 2-1 2-2zM13 3h2v2h-2V3zm8 4h2v2h-2V7zm0-4v2h2c0-1-1-2-2-2zM1 7h2v2H1V7zm16-4h2v2h-2V3zm0 16h2v2h-2v-2zM3 3C2 3 1 4 1 5h2V3zm6 0h2v2H9V3zM5 3h2v2H5V3zm-4 8v8c0 1.1.9 2 2 2h12V11H1zm2 8l2.5-3.21 1.79 2.15 2.5-3.22L13 19H3z"/>
          </svg>
        </button>
        <button
          @click="resetImage"
          class="menu-btn"
          title="Reset Image Size"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="toolbar-section">
        <!-- Undo/Redo -->
        <div class="menu-group">
        <button
        @click="Actions.run('format:undo')"
        class="menu-btn"
        title="Undo (Ctrl+Z)"
        type="button"
        >
            <Icon name="undo" class="icon" />
        </button>
        <button
        @click="Actions.run('format:redo')"
        class="menu-btn"
        title="Redo (Ctrl+Y)"
        type="button"
        >
            <Icon name="redo" class="icon" />
        </button>
        </div>
    </div>

    <!-- Formatting Toolbar -->
    <div class="toolbar-section">
      <!-- Heading Dropdown -->
      <div class="menu-group">
        <button
          ref="headingButtonRef"
          @click.stop="headingDropdownOpen = !headingDropdownOpen"
          @mousedown.stop
          class="menu-btn heading-dropdown-trigger"
          title="Heading Level"
          type="button"
        >
          <span class="text-xs font-semibold">{{ currentHeadingLevel === 0 ? 'P' : `H${currentHeadingLevel}` }}</span>
          <Icon name="chevron-down" class="ml-0.5" />
        </button>
        <Teleport to="body">
          <div v-if="headingDropdownOpen" class="heading-dropdown" :style="headingDropdownStyle">
            <button
                @click="setHeading(0)"
                :class="['heading-option', { active: currentHeadingLevel === 0 }]"
                type="button"
            >
                Paragraph
            </button>
            <button
                v-for="level in [2, 3, 4]"
                :key="level"
                @click="setHeading(level)"
                :class="['heading-option', { active: currentHeadingLevel === level }]"
                type="button"
            >
                <span :class="`heading-preview-${level}`">Heading {{ level }}</span>
            </button>
            </div>
        </Teleport>
      </div>

      <div class="menu-divider"></div>

      <!-- Text Formatting -->
      <div class="menu-group">
        <button
          @click="Actions.run('format:bold')"
          :class="['menu-btn', { active: getEditor().isActive('bold') }]"
          title="Bold"
          type="button"
        >
          <Icon name="bold" class="icon" />
        </button>
        <button
          @click="Actions.run('format:italic')"
          :class="['menu-btn', { active: getEditor().isActive('italic') }]"
          title="Italic"
          type="button"
        >
          <Icon name="italic" class="icon" />
        </button>
        <button
          @click="Actions.run('format:underline')"
          :class="['menu-btn', { active: getEditor().isActive('underline') }]"
          title="Underline"
          type="button"
        >
          <Icon name="underline" class="icon" />
        </button>
        <button
          @click="Actions.run('format:strikethrough')"
          :class="['menu-btn', { active: getEditor().isActive('strike') }]"
          title="Strikethrough"
          type="button"
        >
          <Icon name="strikethrough" class="icon" />
        </button>
      </div>

      <div class="menu-divider"></div>

      <!-- Lists -->
      <div class="menu-group">
        <button
          @click="Actions.run('format:list:bullet')"
          :class="['menu-btn', { active: getEditor().isActive('bulletList') }]"
          title="Bullet List"
          type="button"
        >
          <Icon name="list-unordered" class="icon" />
        </button>
        <button
          @click="Actions.run('format:list:ordered')"
          :class="['menu-btn', { active: getEditor().isActive('orderedList') }]"
          title="Numbered List"
          type="button"
        >
          <Icon name="list-ordered" class="icon" />
        </button>
        <button
          @click="Actions.run('format:list:task')"
          :class="['menu-btn', { active: getEditor().isActive('taskList') }]"
          title="Task List"
          type="button"
        >
          <Icon name="list-check" class="icon" />
        </button>
        <button
          @click="Actions.run('format:list:indent')"
          :class="['menu-btn']"
          :disabled="!canIndentListItem()"
          title="Indent List Item"
          type="button"
        >
          <Icon name="indent" class="icon" />
        </button>
        <button
          @click="Actions.run('format:list:outdent')"
          :class="['menu-btn']"
          :disabled="!canOutdentListItem()"
          title="Outdent List Item"
          type="button"
        >
          <Icon name="outdent" class="icon" />
        </button>
      </div>

      <div class="menu-divider"></div>

      <!-- Text Alignment -->
      <div class="menu-group">
        <button
          @click="Actions.run('format:align:left')"
          :class="['menu-btn', { active: getEditor().isActive({ textAlign: 'left' }) }]"
          title="Align Left"
          type="button"
        >
          <Icon name="align-left" class="icon" />
        </button>
        <button
          @click="Actions.run('format:align:center')"
          :class="['menu-btn', { active: getEditor().isActive({ textAlign: 'center' }) }]"
          title="Align Center"
          type="button"
        >
          <Icon name="align-center" class="icon" />
        </button>
        <button
          @click="Actions.run('format:align:right')"
          :class="['menu-btn', { active: getEditor().isActive({ textAlign: 'right' }) }]"
          title="Align Right"
          type="button"
        >
          <Icon name="align-right" class="icon" />
        </button>
        <button
          @click="Actions.run('format:align:justify')"
          :class="['menu-btn', { active: getEditor().isActive({ textAlign: 'justify' }) }]"
          title="Justify"
          type="button"
        >
          <Icon name="align-justify" class="icon" />
        </button>
      </div>

      <div class="menu-divider"></div>

      <!-- Link -->
      <div class="menu-group">
        <button
          @click="setLink"
          :class="['menu-btn', { active: getEditor().isActive('link') }]"
          title="Link (Ctrl+K)"
          type="button"
        >
          <Icon name="link" class="icon" />
        </button>
      </div>

      <div class="menu-divider"></div>

      <!-- Text Color -->
      <div class="menu-group">
        <div class="color-picker-wrapper">
          <button
            class="menu-btn color-trigger"
            :class="{ active: currentTextColor !== '#000000' }"
            title="Text Color"
            type="button"
            @click="textColorInput?.click()"
          >
            <Icon name="text-color" class="icon" />
            <span class="color-bar" :style="{ backgroundColor: currentTextColor }"></span>
          </button>
          <input
            ref="textColorInput"
            type="color"
            :value="currentTextColor"
            @input="setTextColor"
            class="hidden-color-input"
          />
          <button
            v-if="currentTextColor !== '#000000'"
            @click="getEditor().chain().focus().unsetColor().run()"
            class="color-clear-btn"
            title="Clear Text Color"
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>

        <!-- Background Color -->
        <div class="color-picker-wrapper">
          <button
            class="menu-btn color-trigger"
            :class="{ active: currentBgColor !== 'transparent' }"
            title="Background Color"
            type="button"
            @click="bgColorInput?.click()"
          >
            <Icon name="highlight" class="icon" />
            <span class="color-bar" :style="{ backgroundColor: currentBgColor }"></span>
          </button>
          <input
            ref="bgColorInput"
            type="color"
            :value="currentBgColor === 'transparent' ? '#ffff00' : currentBgColor"
            @input="setBgColor"
            class="hidden-color-input"
          />
          <button
            v-if="currentBgColor !== 'transparent'"
            @click="clearBgColor"
            class="color-clear-btn"
            title="Clear Background Color"
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
      </div>
    </div>

    <!-- Table Actions (shown when in table) -->
    <div v-if="isInTable" class="toolbar-section">

      <!-- Column Operations -->
      <div class="menu-group">
        <button
          @click="Actions.run('format:table:addColumnBefore')"
          class="menu-btn"
          title="Add Column Before"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 3H6c-.55 0-1 .45-1 1v16c0 .55.45 1 1 1h7V3zm2 0v18h3c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1h-3zm-4 7h-2v2h2v-2z"/>
          </svg>
          <svg class="icon-overlay" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
        <button
          @click="Actions.run('format:table:addColumnAfter')"
          class="menu-btn"
          title="Add Column After"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11 3H4c-.55 0-1 .45-1 1v16c0 .55.45 1 1 1h7V3zm2 0v18h7c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1h-7zm-2 7H9v2h2v-2z"/>
          </svg>
          <svg class="icon-overlay" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
        <button
          @click="Actions.run('format:table:deleteColumn')"
          class="menu-btn menu-btn--danger"
          title="Delete Column"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 3H6c-.55 0-1 .45-1 1v16c0 .55.45 1 1 1h7V3zm2 0v18h3c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1h-3z"/>
          </svg>
          <svg class="icon-overlay-danger" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div class="menu-divider"></div>

      <!-- Row Operations -->
      <div class="menu-group">
        <button
          @click="Actions.run('format:table:addRowBefore')"
          class="menu-btn"
          title="Add Row Before"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 13v7c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-7H3zm7-2V9h2v2h-2z"/>
          </svg>
          <svg class="icon-overlay" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
        <button
          @click="Actions.run('format:table:addRowAfter')"
          class="menu-btn"
          title="Add Row After"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 4v7h18V4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1zm7 5H9v2h2V9z"/>
          </svg>
          <svg class="icon-overlay" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
        <button
          @click="Actions.run('format:table:deleteRow')"
          class="menu-btn menu-btn--danger"
          title="Delete Row"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 13v7c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-7H3zm0-2h18V4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v7z"/>
          </svg>
          <svg class="icon-overlay-danger" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
        <button
          @click="cutRow"
          class="menu-btn"
          title="Cut Row"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 13v7c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-7H3zm0-2h18V4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v7z"/>
          </svg>
          <svg class="icon-overlay" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/>
          </svg>
        </button>
        <button
          @click="pasteRow"
          :disabled="!copiedRow"
          class="menu-btn"
          :class="{ 'opacity-50': !copiedRow }"
          title="Paste Row"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 13v7c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-7H3zm0-2h18V4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v7z"/>
          </svg>
          <svg class="icon-overlay" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/>
          </svg>
        </button>
      </div>

      <div class="menu-divider"></div>

      <!-- Cell Operations -->
      <div class="menu-group">
        <button
          @click="getEditor().chain().focus().toggleHeaderCell().run()"
          :class="['menu-btn', { active: getEditor().isActive('tableHeader') }]"
          title="Toggle Header Cell"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 4v16h18V4H3zm16 14H5V8h14v10z"/>
            <path d="M7 10h10v2H7z"/>
          </svg>
        </button>
        <button
          @click="Actions.run('format:table:mergeCells')"
          class="menu-btn"
          title="Merge Cells"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 17.25V14h2v5h-5v-2h3.25L14 13.75l1.41-1.41L18.66 15.5V12h2v5.25M7 6.75V10H5V5h5v2H6.75L10 10.25 8.59 11.66 5.34 8.5V12H3V6.75M11 19v-2h2v2h-2m0-14V3h2v2h-2M3 11v2h2v-2H3m16 0v2h2v-2h-2z"/>
          </svg>
        </button>
        <button
          @click="Actions.run('format:table:splitCell')"
          class="menu-btn"
          title="Split Cell"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 14v5h-5v-2h3.25L14 13.75l1.41-1.41L18.66 15.5V12h2v2M5 10h5v2H6.75L10 15.25 8.59 16.66 5.34 13.5V17H3v-5h2M3 3h8v2H3V3m10 0h8v2h-8V3M3 19h8v2H3v-2m10 0h8v2h-8v-2z"/>
          </svg>
        </button>
      </div>

      <div class="menu-divider"></div>

      <!-- Expression Cell -->
      <div class="menu-group">
        <button
          @click="insertExpressionCell"
          class="menu-btn"
          title="Insert Expression Cell"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-6 14h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        </button>
      </div>

      <div class="menu-divider"></div>

      <!-- Cell Background Color -->
      <div class="menu-group">
        <div class="color-picker-wrapper">
          <button
            class="menu-btn color-trigger"
            :class="{ active: cellBackgroundColor !== 'transparent' }"
            title="Cell Background Color"
            type="button"
            @click="cellBgColorInput?.click()"
          >
            <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z"/>
            </svg>
            <span class="color-bar" :style="{ backgroundColor: cellBackgroundColor }"></span>
          </button>
          <input
            ref="cellBgColorInput"
            type="color"
            :value="cellBackgroundColor === 'transparent' ? '#ffffff' : cellBackgroundColor"
            @input="setCellBackground"
            class="hidden-color-input"
          />
          <button
            v-if="cellBackgroundColor !== 'transparent'"
            @click="clearCellBackground"
            class="color-clear-btn"
            title="Clear Background Color"
            type="button"
          >
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="menu-divider"></div>

      <!-- Delete Table -->
      <div class="menu-group">
        <button
          @click="Actions.run('format:table:delete')"
          class="menu-btn menu-btn--danger"
          title="Delete Table"
          type="button"
        >
          <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 3.5H7V6h3V3.5zm4 0v2.5h3V3.5h-3zM7 11h3V8H7v3zm4 0h3V8h-3v3zm-4 4h3v-3H7v3zm4 0h3v-3h-3v3zm-4 4h3v-3H7v3zm4 0h3v-3h-3v3zM17 8v3h3V8h-3zm0 7h3v-3h-3v3zm-3-11.5C14 2.67 13.33 2 12.5 2h-1C10.67 2 10 2.67 10 3.5V3H6c-.55 0-1 .45-1 1v1H3v2h2v11c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V7h2V5h-2V4c0-.55-.45-1-1-1h-4v-.5z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Column Layout Actions (shown when in column layout) -->
    <div v-if="isInColumnLayout" class="toolbar-section hidden! lg:flex!">
        <div class="menu-group">
        <button
            @click="Actions.run('format:columns:2')"
            :class="['menu-btn', { active: currentColumnCount === 2 }]"
            title="2 Columns"
            type="button"
        >
            <Icon name="columns-2" />
        </button>
        <button
            @click="Actions.run('format:columns:3')"
            :class="['menu-btn', { active: currentColumnCount === 3 }]"
            title="3 Columns"
            type="button"
        >
            <Icon name="columns-3" />
        </button>
        <button
            @click="Actions.run('format:columns:4')"
            :class="['menu-btn', { active: currentColumnCount === 4 }]"
            title="4 Columns"
            type="button"
        >
            <Icon name="columns-4" />
        </button>
        </div>

        <div class="menu-divider"></div>

        <!-- Delete Column Layout -->
        <div class="menu-group">
        <button
            @click="Actions.run('format:columns:delete')"
            class="menu-btn menu-btn--danger"
            title="Delete Column Layout"
            type="button"
        >
            <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
        </button>
        </div>
    </div>

    <!-- Pin Button -->
    <div class="toolbar-section">
      <button
        @click="togglePin"
        class="menu-btn"
        :title="isPinned ? 'Unpin Toolbar' : 'Pin Toolbar to Top'"
        type="button"
      >
        <Icon v-if="isPinned" name="pin-filled" class="icon" />
        <Icon v-else name="pin" class="icon" />
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
@reference "../styles/utils.css";
@reference "../styles/theme.css";

.floating-menu {
  @apply fixed z-50 flex flex-wrap items-start gap-2 h-[42px] content-start;
}

.floating-menu--pinned {
  @apply fixed h-0 top-[21px] w-[calc(100%-var(--sidebar-width)-100px)] justify-start mb-10;
}

.toolbar-section {
  @apply flex items-center gap-0.5 rounded-md p-1 max-w-[95vw] overflow-x-auto;
  @apply bg-neutral-50 shadow-lg;
}

.menu-group {
  @apply flex items-center gap-0.5;
}

.menu-btn .icon {
    min-width: 1em;
    height: 1em;
}

.menu-btn {
  @apply relative px-2.5 py-2 text-sm font-medium rounded transition-all;
  @apply text-neutral-700;
  @apply hover:bg-neutral-100;
  @apply min-w-[2rem] flex items-center justify-center;
}

.menu-btn.active {
  @apply bg-blue-500 text-white;
}

.menu-btn.active:hover {
  @apply bg-blue-600;
}

.menu-btn--danger {
  @apply text-red-600;
  @apply hover:bg-red-50;
}

.menu-btn--danger:hover {
  @apply text-red-700;
}

.menu-divider {
  @apply w-px h-6 bg-neutral-300 mx-1;
}

.icon-overlay {
  @apply w-3 h-3 absolute -top-0.5 -right-0.5;
  @apply text-green-600;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.3));
}

.icon-overlay-danger {
  @apply w-3 h-3 absolute -top-0.5 -right-0.5;
  @apply text-red-600;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.3));
}

.color-picker-wrapper {
  @apply relative flex items-center gap-0.5;
}

.color-trigger {
  @apply flex-col gap-0.5 pt-1.5 pb-1;
}

.color-bar {
  @apply w-full h-0.5 rounded-full;
}

.hidden-color-input {
  @apply absolute invisible w-0 h-0;
}

.color-clear-btn {
  @apply p-1 rounded transition-colors;
  @apply text-neutral-500 hover:text-neutral-700;
  @apply hover:bg-neutral-100;
}

.heading-dropdown-trigger {
  @apply flex items-center gap-0.5 min-w-[3rem];
}

.heading-dropdown {
  @apply bg-background rounded-md shadow-lg border border-neutral-200;
  @apply py-1 w-[140px];
}

.heading-option {
  @apply w-full px-3 py-1.5 text-left text-sm;
  @apply hover:bg-neutral-100 transition-colors;
}

.heading-option.active {
  @apply bg-blue-50 text-blue-600;
}

.heading-preview-1 { @apply text-lg font-bold; }
.heading-preview-2 { @apply text-base font-bold; }
.heading-preview-3 { @apply text-sm font-semibold; }
.heading-preview-4 { @apply text-sm font-medium; }
.heading-preview-5 { @apply text-xs font-medium; }
.heading-preview-6 { @apply text-xs font-normal; }
</style>