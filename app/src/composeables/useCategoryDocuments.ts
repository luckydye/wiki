import { computed, type Ref, watch } from "vue";
import { useQueries } from "@tanstack/vue-query";
import { useSpace } from "./useSpace.js";
import { api } from "../api/client.js";
import { useSync } from "./useSync.js";

export function useCategoryDocuments(categorySlugs: Ref<string[]>) {
  const { currentSpaceId } = useSpace();

  const queries = useQueries({
    queries: computed(() =>
      categorySlugs.value.map((slug) => ({
        queryKey: ["wiki_category_documents", currentSpaceId.value, slug],
        queryFn: async () => {
          if (!currentSpaceId.value) {
            throw new Error("No space ID");
          }
          return await api.categories.documents(currentSpaceId.value, slug);
        },
        enabled: !!currentSpaceId.value && !!slug,
        staleTime: 1000 * 60 * 5, // 5 minutes
      }))
    ),
  });

  // Map slug to documents
  const documentsBySlug = computed(() => {
    const map = new Map<string, any[]>();
    categorySlugs.value.forEach((slug, index) => {
      const query = queries.value[index];
      map.set(slug, query?.data || []);
    });
    return map;
  });

  const isLoading = computed(() =>
    queries.value.some((query) => query.isPending)
  );

  const hasError = computed(() =>
    queries.value.some((query) => query.isError)
  );

  const refetchAll = () => {
    queries.value.forEach((query) => query.refetch());
  };

  // TODO: syncs are not scopped to documents,
  // one prop updates will send a sync event to all users anywhere in the space
  useSync(currentSpaceId, keys => {
    if (keys.includes("wiki_category_documents")) refetchAll();
  });

  return {
    documentsBySlug,
    isLoading,
    hasError,
    refetchAll,
  };
}
