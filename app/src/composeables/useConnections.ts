import { computed } from "vue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { useSpace } from "./useSpace.js";
import { api } from "../api/client.js";

export interface Connection {
  id: string;
  label: string;
  url?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export function useConnections() {
  const { currentSpaceId: spaceId } = useSpace();
  const queryClient = useQueryClient();

  const {
    data: connections,
    isPending: isLoading,
    error,
    refetch: refresh,
  } = useQuery({
    queryKey: computed(() => ["connections", spaceId.value]),
    queryFn: async () => {
      if (!spaceId.value) {
        return [];
      }

      return await api.connections.get(spaceId.value);
    },
    enabled: computed(() => !!spaceId.value),
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (params: { label: string; url?: string; icon?: string }) => {
      if (!spaceId.value) {
        throw new Error("No space selected");
      }

      return await api.connections.post(spaceId.value, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections", spaceId.value] });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      if (!spaceId.value) {
        throw new Error("No space selected");
      }

      await api.connections.delete(spaceId.value, connectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections", spaceId.value] });
    },
  });

  return {
    connections,
    isLoading,
    error,
    refresh,
    createConnection: createConnectionMutation.mutateAsync,
    isCreating: createConnectionMutation.isPending,
    deleteConnection: deleteConnectionMutation.mutateAsync,
    isDeleting: deleteConnectionMutation.isPending,
  };
}
