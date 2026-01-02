<template>
  <div class="space-y-1">
    <!-- Header with Edit Button -->
    <div class="flex items-center justify-between gap-3xs px-3xs mb-2">
      <h3 class="text-xs font-medium text-neutral-900 uppercase tracking-wider opacity-50">
        Connections
      </h3>
      <button @click="toggleEditMode" class="p-1 text-neutral-900 hover:text-neutral rounded transition-colors"
        :title="isEditMode ? 'Done editing' : 'Edit connections'">
        <svg v-if="!isEditMode" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>

    <div v-if="!isEditMode && connections.length === 0" class="px-3 py-4 text-center">
      <p class="text-sm text-neutral-500">No connections yet</p>
    </div>

    <!-- Connections List -->
    <div class="relative">
      <a v-for="connection in connections" :key="connection.id" :href="connection.url" target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-3 px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors duration-200 group"
        :class="{ 'pr-10': isEditMode }">
        <!-- Icon -->
        <div v-if="connection.icon" v-html="connection.icon" class="w-4 h-4 text-green-600 shrink-0" />
        <svg v-else class="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>

        <!-- Label -->
        <span class="flex-1 truncate">{{ connection.label }}</span>

        <!-- External link icon (hidden in edit mode) -->
        <svg v-if="!isEditMode" class="w-3 h-3 text-neutral-900 group-hover:text-neutral shrink-0" fill="none"
          stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>

        <!-- Delete button (shown in edit mode) -->
        <button v-if="isEditMode" @click.prevent="deleteConnection(connection.id)"
          class="absolute right-3 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
          :disabled="deletingIds.has(connection.id)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </a>

      <!-- Add Connection Button -->
      <div class="relative">
        <button v-if="isEditMode" @click="showAddForm = true"
          class="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-900 hover:text-neutral hover:bg-neutral-100 rounded-md transition-colors duration-200"
          :disabled="isCreating">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add connection</span>
        </button>

        <!-- Add Connection Popover -->
        <div v-if="showAddForm"
          class="fixed left-70 -mt-12 w-72 bg-background rounded-lg shadow-lg border border-neutral-200 z-50 p-4" @click.stop>
          <h4 class="text-sm font-medium text-neutral-900 mb-3">Add Connection</h4>

          <form @submit.prevent="addConnection" class="space-y-3">
            <div>
              <label for="connection-label" class="block text-xs font-medium text-neutral-900 mb-1">
                Label
              </label>
              <input id="connection-label" v-model="newConnection.label" type="text" required
                placeholder="e.g., Jira, GitHub"
                class="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            <div>
              <label for="connection-url" class="block text-xs font-medium text-neutral-900 mb-1">
                URL
              </label>
              <input id="connection-url" v-model="newConnection.url" type="url" required
                placeholder="https://example.com"
                class="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            <div class="flex gap-2 pt-2">
              <button type="submit" :disabled="isCreating"
                class="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {{ isCreating ? 'Adding...' : 'Add' }}
              </button>
              <button type="button" @click="cancelAdd" :disabled="isCreating"
                class="px-3 py-2 text-sm font-medium text-neutral-900 neutral hover:bg-neutral-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Cancel
              </button>
            </div>

            <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
          </form>
        </div>
      </div>
    </div>

    <!-- Backdrop for popover -->
    <div v-if="showAddForm" class="fixed inset-0 z-40" @click="cancelAdd"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useConnections } from "../composeables/useConnections";

const {
  connections: connectionsData,
  isLoading: loading,
  createConnection,
  isCreating,
  deleteConnection: deleteConnectionMutation,
} = useConnections();

const connections = computed(() => connectionsData.value || []);
const isEditMode = ref(false);
const showAddForm = ref(false);
const deletingIds = ref(new Set<string>());
const error = ref("");

const newConnection = ref({
  label: "",
  url: "",
});

function toggleEditMode() {
  isEditMode.value = !isEditMode.value;
  if (!isEditMode.value) {
    // Close add form when exiting edit mode
    showAddForm.value = false;
  }
}

function cancelAdd() {
  showAddForm.value = false;
  newConnection.value = { label: "", url: "" };
  error.value = "";
}

async function addConnection() {
  error.value = "";

  try {
    await createConnection({
      label: newConnection.value.label,
      url: newConnection.value.url,
    });

    cancelAdd();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to add connection";
  }
}

async function deleteConnection(connectionId: string) {
  if (!confirm("Are you sure you want to delete this connection?")) return;

  deletingIds.value.add(connectionId);

  try {
    await deleteConnectionMutation(connectionId);
  } catch (err) {
    alert(err instanceof Error ? err.message : "Failed to delete connection");
  } finally {
    deletingIds.value.delete(connectionId);
  }
}
</script>
