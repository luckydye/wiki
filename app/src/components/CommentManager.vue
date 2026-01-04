<script setup lang="ts">
import { onMounted, onUnmounted, computed } from "vue";
import CommentThread, { type Comment as CommentThreadType } from "./CommentThread.vue";
import CommentOverlays, { type Comment as CommentOverlaysType } from "./CommentOverlays.vue";
import { useComments } from "../composeables/useComments.js";
import type { Comment as ApiComment } from "../api/ApiClient.js";

const props = defineProps<{
  spaceId: string;
  documentId: string;
  currentRev?: number;
}>();

const {
  comments,
  activeReference,
  threadPosition,
  isSubmitting,
  isDeletingComment,
  activeComments,
  refetch,
  submitComment,
  deleteComment,
  handleOpenComment,
  setupListeners,
  cleanupListeners,
} = useComments({
  spaceId: computed(() => props.spaceId),
  documentId: computed(() => props.documentId),
  currentRev: computed(() => props.currentRev),
});

const commentsForOverlays = computed(() =>
  comments.value.map((c: ApiComment) => ({
    id: c.id,
    reference: c.reference ?? undefined,
  } as CommentOverlaysType))
);

const commentsForThread = computed(() =>
  activeComments.value.map((c: ApiComment) => ({
    id: c.id,
    content: c.content,
    createdAt: typeof c.createdAt === "string" ? c.createdAt : c.createdAt.toISOString(),
    createdBy: c.createdBy,
    reference: c.reference ?? undefined,
    parentId: c.parentId ?? undefined,
  } as CommentThreadType))
);

async function handleSubmit(payload: { content: string; reference: string | null }) {
  await submitComment(payload.content, payload.reference);
}

async function handleDeleteComment(commentId: string) {
  await deleteComment(commentId);
}

onMounted(() => {
  refetch();
  setupListeners();
});

onUnmounted(() => {
  cleanupListeners();
});
</script>

<template>
  <div class="contents">
    <CommentOverlays :comments="commentsForOverlays" />

    <div
      v-if="activeReference"
      class="absolute right-0 z-40"
      :style="{ top: `${threadPosition}px` }"
    >
      <CommentThread
        :comments="commentsForThread"
        :activeReference="activeReference"
        :isSubmitting="isSubmitting"
        :isDeletingComment="isDeletingComment"
        @submit="handleSubmit"
        @delete="handleDeleteComment"
        @close="activeReference = null"
      />
    </div>
  </div>
</template>
