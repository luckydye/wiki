<script setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref, computed, watch } from "vue";
import ToolbarFormatting from "./ToolbarFormatting.vue";
import DiffView from "./DiffView.vue";
import { useSpace } from "../composeables/useSpace.js";

const props = defineProps({
  documentId: {
    type: String,
  },
  spaceId: {
    type: String,
    required: true,
  },
  documentType: {
    type: String,
    default: "document",
  },
  readonly: {
    type: Boolean,
    default: false,
  },
  initialEditMode: {
    type: Boolean,
    default: false,
  },
});

const isEditing = ref(props.initialEditMode);
const isEditingReady = ref(false);
const viewingRevision = ref(false);
const revisionNumber = ref(null);
const revisionContent = ref("");
const sidebarOpen = ref(false);
const showingDiff = ref(false);
const diffPatch = ref("");
const { currentSpaceId } = useSpace();

const Editor = defineAsyncComponent(() => import("./Editor.vue"));

function handleEditModeStart() {
  if (!viewingRevision.value) {
    isEditing.value = true;
  }
}

watch(isEditingReady, (ready) => {
  document.body.dataset.editing = !!isEditingReady.value;
});

function handleEditorReady(saveFunction) {
  window.dispatchEvent(new CustomEvent("editor-ready", { detail: { saveFunction } }));
  isEditingReady.value = true;
}

function handleSaveStatus({ status, error }) {
  window.dispatchEvent(
    new CustomEvent("save-status-changed", { detail: { status, error } }),
  );
  if (props.documentType !== 'canvas') {
    isEditing.value = false;
  }
}

function handleRevisionView(event) {
  viewingRevision.value = true;
  document.body.dataset.revision = true;
  revisionNumber.value = event.detail.revision;
  revisionContent.value = event.detail.content;
  isEditing.value = false;
  isEditingReady.value = false;
}

function handleRevisionClose() {
  viewingRevision.value = false;
  document.body.removeAttribute('data-revision');
  revisionNumber.value = null;
  revisionContent.value = "";

  const params = new URLSearchParams(location.search);
  params.delete("revision");

  history.replaceState(null, "", `${location.origin}${location.pathname}${params.toString()}`)
}

function closeRevisionView() {
  showingDiff.value = false;
  handleRevisionClose();
}

function handleSidebarToggle(event) {
  sidebarOpen.value = event.detail.isOpen;
}

async function handleRevisionDiff(event) {
  if (!currentSpaceId.value) return;

  try {
    const response = await fetch(
      `/api/v1/spaces/${currentSpaceId.value}/documents/${props.documentId}/diff?rev=${event.detail.revision}`
    );
    if (!response.ok) throw new Error("Failed to fetch diff");

    diffPatch.value = await response.text();
    showingDiff.value = true;
    viewingRevision.value = true;
    document.body.dataset.revision = true;
    revisionNumber.value = event.detail.revision;
    isEditing.value = false;
    isEditingReady.value = false;
  } catch (error) {
    console.error("Failed to load diff:", error);
  }
}

onMounted(() => {
  if (props.documentType !== 'canvas') {
    window.addEventListener("edit-mode-start", handleEditModeStart);
  }

  window.addEventListener("revision:view", handleRevisionView);
  window.addEventListener("revision:close", handleRevisionClose);
  window.addEventListener("revisions:toggled", handleSidebarToggle);
  window.addEventListener("revision:diff", handleRevisionDiff);
});

onUnmounted(() => {
  window.removeEventListener("edit-mode-start", handleEditModeStart);
  window.removeEventListener("revision:view", handleRevisionView);
  window.removeEventListener("revision:close", handleRevisionClose);
  window.removeEventListener("revisions:toggled", handleSidebarToggle);
  window.removeEventListener("revision:diff", handleRevisionDiff);
});
</script>

<template>
  <div>
    <!-- Floating Text Formatting Menu -->
    <ToolbarFormatting />

    <!-- Revision Disclaimer Banner -->
    <div
      v-if="viewingRevision"
      class="sticky top-0 z-60 bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center justify-between duration-300 mb-10"
      :style="{ marginRight: sidebarOpen ? '432px' : '0' }"
    >
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p class="text-sm font-semibold text-amber-900">
            Viewing Revision {{ revisionNumber }}
          </p>
          <p class="my-0! text-xs text-amber-700">
            This is a historical version of the document. Changes cannot be made.
          </p>
        </div>
      </div>
      <button
        @click="closeRevisionView"
        class="px-4 py-2 text-sm font-medium text-amber-900 bg-amber-100 border border-amber-300 rounded hover:bg-amber-200 transition-colors"
      >
        Show published version
      </button>
    </div>

    <!-- Revision View with Diff -->
    <div v-if="viewingRevision && showingDiff">
      <div>
        <DiffView
          :patch="diffPatch"
        />
      </div>
    </div>

    <!-- Revision View -->
    <div v-if="viewingRevision && !showingDiff">
      <document-view>
        <template v-html="revisionContent"></template>
      </document-view>
    </div>
  </div>

  <!-- Format Sidebar -->
  <!-- <FormatSidebar v-if="isEditing && isEditingReady && !viewingRevision" /> -->

  <!-- Editor -->
  <div v-if="isEditing && !viewingRevision" :class="[!isEditingReady && 'opacity-0']">
    <Editor
      :documentId="documentId"
      :spaceId="spaceId"
      :documentType="documentType"
      @editor-ready="handleEditorReady"
      @save-status="handleSaveStatus"
    />
  </div>
</template>
