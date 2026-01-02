<script setup lang="ts">
import { computed } from "vue";
import { useInfiniteQuery } from "@tanstack/vue-query";
import { api, type DocumentWithProperties } from "../api/client.ts";

const props = defineProps<{
  spaceId: string;
  spaceSlug: string;
}>();

const pageSize = 50;

const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
} = useInfiniteQuery({
  queryKey: ["drafts", props.spaceId],
  queryFn: async ({ pageParam = 0 }) => {
    return await api.drafts.get(props.spaceId, {
      limit: pageSize,
      offset: pageParam,
    });
  },
  getNextPageParam: (lastPage, allPages) => {
    const loadedCount = allPages.reduce((sum, page) => sum + page.documents.length, 0);
    return loadedCount < lastPage.total ? loadedCount : undefined;
  },
  initialPageParam: 0,
});

const allDrafts = computed(() => {
  if (!data.value) return [];
  return data.value.pages.flatMap((page) => page.documents);
});

const totalDrafts = computed(() => {
  return data.value?.pages[0]?.total || 0;
});

const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const handleScroll = () => {
  if (isFetchingNextPage.value || !hasNextPage.value) return;

  const scrollPosition = window.innerHeight + window.scrollY;
  const threshold = document.documentElement.scrollHeight - 500;

  if (scrollPosition >= threshold) {
    fetchNextPage();
  }
};

if (!import.meta.env.SSR) {
  window.addEventListener("scroll", handleScroll);
}
</script>

<template>
  <div class="drafts-container">
    <div v-if="isLoading" class="loading-state">
      <svg class="loading-icon animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
        </path>
      </svg>
      <p class="loading-text">Loading drafts...</p>
    </div>

    <div v-else-if="allDrafts.length === 0" class="empty-state">
      <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
      <h3 class="empty-title">No drafts</h3>
      <p class="empty-text">
        All your documents are organized. Create a new document to get started.
      </p>
    </div>

    <div v-else>
      <div class="drafts-header">
        <p class="drafts-count">
          <span class="font-semibold">{{ allDrafts.length }}</span>
          draft{{ allDrafts.length !== 1 ? "s" : "" }}
          <span v-if="totalDrafts > allDrafts.length" class="text-neutral">
            · {{ totalDrafts }} total
          </span>
        </p>
      </div>

      <div class="drafts-list">
        <a v-for="doc in allDrafts" :key="doc.id" :href="`/${spaceSlug}/doc/${doc.slug}`" class="draft-item">
          <div class="draft-content">
            <div class="draft-header">
              <h2 class="draft-title">
                {{ doc.properties.title || "Untitled Document" }}
              </h2>
            </div>

            <div v-if="Object.keys(doc.properties).filter(k => k !== 'title').length > 0" class="draft-properties">
              <span v-for="[key, value] in Object.entries(doc.properties).filter(([k]) => k !== 'title').slice(0, 3)"
                :key="key" class="property-tag">
                {{ key }}: {{ value }}
              </span>
            </div>

            <div class="draft-meta">
              <span>Updated {{ formatDate(doc.updatedAt) }}</span>
              <span v-if="doc.properties.author">• by {{ doc.properties.author }}</span>
            </div>
          </div>

          <svg class="draft-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      <div v-if="hasNextPage" class="load-more-container">
        <button @click="() => fetchNextPage()" :disabled="isFetchingNextPage" class="load-more-button">
          <svg v-if="!isFetchingNextPage" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
            </path>
          </svg>
          {{ isFetchingNextPage ? "Loading more..." : "Load more drafts" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drafts-container {
  max-width: 100%;
}

.loading-state {
  text-align: center;
  padding: 4rem 2rem;
}

.loading-icon {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 1rem;
  color: var(--color-primary, #3b82f6);
}

.loading-text {
  font-size: 1rem;
  color: #6b7280;
}

.empty-state {
  padding: 3rem 2rem;
  background-color: var(--color-neutral-50);
  border-radius: 0.5rem;
  border: 1px solid var(--color-neutral-200);
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 0.5rem;
  color: #9ca3af;
}

.empty-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-forground);
  margin-bottom: 0.25rem;
}

.empty-text {
  font-size: 0.875rem;
  color: #6b7280;
}

.drafts-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-neutral-200);
}

.drafts-count {
  font-size: 0.875rem;
  color: var(--color-neutral-800);
}

.text-neutral {
  color: #6b7280;
}

.drafts-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.draft-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  background-color: var(--color-background);
  border: 1px solid var(--color-neutral-200);
  border-radius: 0.5rem;
  text-decoration: none;
  color: inherit;
}

.draft-item:hover {
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.draft-content {
  flex: 1;
}

.draft-header {
  margin-bottom: 0.5rem;
}

.draft-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-forground);
  line-height: 1.4;
}

.draft-properties {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.property-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.625rem;
  background-color: var(--color-neutral-200);
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-neutral-800);
}

.draft-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.draft-arrow {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  color: #9ca3af;
}

.draft-item:hover .draft-arrow {
  color: var(--color-primary, #3b82f6);
}

.load-more-container {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
  padding-top: 2rem;
}

.load-more-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background-color: var(--color-background);
  border: 2px solid var(--color-neutral-200);
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-foreground);
  cursor: pointer;
}

.load-more-button:hover:not(:disabled) {
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.load-more-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.font-semibold {
  font-weight: 600;
}

.w-5 {
  width: 1.25rem;
}

.h-5 {
  height: 1.25rem;
}
</style>
