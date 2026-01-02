<template>
  <div class="space-y-6">
    <!-- General Settings Card -->
    <section class="bg-background border border-neutral-200 rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
        <h3 class="text-sm font-semibold text-neutral-900">General Settings</h3>
      </div>
      <form class="p-4" @submit.prevent="handleSave">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="settings-space-name" class="block text-xs font-medium text-neutral-700 mb-1">
              Space Name
            </label>
            <input id="settings-space-name" v-model="localName" type="text" required
              class="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label for="settings-space-slug" class="block text-xs font-medium text-neutral-700 mb-1">
              Slug
            </label>
            <input id="settings-space-slug" v-model="localSlug" type="text" required pattern="[a-z0-9-]+"
              class="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p class="mt-0.5 text-xs text-neutral-500">lowercase letters, numbers, hyphens only</p>
          </div>
          <div class="md:col-span-2">
            <label for="settings-space-description" class="block text-xs font-medium text-neutral-700 mb-1">
              Description
            </label>
            <input id="settings-space-description" v-model="localDescription" type="text"
              placeholder="e.g., Engineering / Documentation"
              class="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label for="settings-brand-color" class="block text-xs font-medium text-neutral-700 mb-1">
              Brand Color
            </label>
            <div class="flex gap-2 items-center">
              <input id="settings-brand-color" v-model="localBrandColor" type="color"
                class="h-8 w-12 border border-neutral-200 rounded cursor-pointer" />
              <input v-model="localBrandColor" type="text" placeholder="#1e293b" pattern="^#[0-9A-Fa-f]{6}$"
                class="flex-1 px-3 py-1.5 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
          </div>
          <div>
            <label for="settings-logo-svg" class="block text-xs font-medium text-neutral-700 mb-1">
              Logo
            </label>
            <div class="flex items-center gap-2">
              <input id="settings-logo-svg" type="file" accept="image/svg+xml,image/png,image/jpeg"
                @change="handleLogoUpload"
                class="flex-1 text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200" />
              <div v-if="localLogoSvg" class="flex items-center gap-1 px-2 py-1 bg-neutral-100 rounded">
                <div v-if="localLogoSvg.startsWith('<')" v-html="localLogoSvg" class="h-5 flex items-center [&>svg]:h-5 [&>svg]:w-auto"></div>
                <img v-else :src="localLogoSvg" class="h-5" />
                <button type="button" @click="localLogoSvg = ''" class="text-neutral-400 hover:text-red-500">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="error" class="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {{ error }}
        </div>
        <div class="mt-4 flex justify-end">
          <button type="submit" :disabled="isSaving"
            class="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
            {{ isSaving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </section>

    <!-- Members Card -->
    <section class="bg-background border border-neutral-200 rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
        <h3 class="text-sm font-semibold text-neutral-900">Members</h3>
      </div>
      <div class="p-4">
        <SpaceMembers />
      </div>
    </section>

    <!-- Access Tokens Card -->
    <section class="bg-background border border-neutral-200 rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-neutral-900">Access Tokens</h3>
        <span class="text-xs text-neutral-500">Create via CLI: <code class="px-1 py-0.5 bg-neutral-200 rounded font-mono">bun run token</code></span>
      </div>
      <div class="p-4">
        <div v-if="tokenError" class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {{ tokenError }}
        </div>
        <div v-if="isLoadingTokens" class="text-center py-6 text-sm text-neutral-500">Loading tokens...</div>
        <div v-else-if="accessTokens.length === 0" class="text-center py-6 text-sm text-neutral-500">No access tokens created yet</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-neutral-200">
                <th class="text-left py-2 pr-4 text-xs font-medium text-neutral-500 uppercase">Name</th>
                <th class="text-left py-2 pr-4 text-xs font-medium text-neutral-500 uppercase">Status</th>
                <th class="text-left py-2 pr-4 text-xs font-medium text-neutral-500 uppercase">Resources</th>
                <th class="text-left py-2 pr-4 text-xs font-medium text-neutral-500 uppercase">Last Used</th>
                <th class="text-left py-2 pr-4 text-xs font-medium text-neutral-500 uppercase">Expires</th>
                <th class="text-right py-2 text-xs font-medium text-neutral-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
              <tr v-for="token in accessTokens" :key="token.id" class="hover:bg-neutral-50">
                <td class="py-2 pr-4 font-medium text-neutral-900">{{ token.name }}</td>
                <td class="py-2 pr-4">
                  <span v-if="token.revokedAt" class="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700">Revoked</span>
                  <span v-else-if="token.expiresAt && new Date(token.expiresAt) < new Date()" class="px-1.5 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">Expired</span>
                  <span v-else class="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-700">Active</span>
                </td>
                <td class="py-2 pr-4">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="resource in token.resources" :key="`${resource.resourceType}-${resource.resourceId}`"
                      class="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                      {{ resource.resourceType }}: {{ resource.permission }}
                    </span>
                    <span v-if="!token.resources?.length" class="text-xs text-neutral-400 italic">None</span>
                  </div>
                </td>
                <td class="py-2 pr-4 text-neutral-500">{{ token.lastUsedAt ? formatDate(token.lastUsedAt) : '—' }}</td>
                <td class="py-2 pr-4 text-neutral-500">{{ token.expiresAt ? formatDate(token.expiresAt) : '—' }}</td>
                <td class="py-2 text-right space-x-2">
                  <button v-if="!token.revokedAt" @click="handleRevokeToken(token.id)" class="text-xs text-red-600 hover:text-red-800">Revoke</button>
                  <button @click="handleDeleteToken(token.id)" class="text-xs text-neutral-500 hover:text-neutral-700">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Webhooks Card -->
    <section class="bg-background border border-neutral-200 rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-neutral-900">Webhooks</h3>
        <button v-if="!isAddingNewWebhook" @click="handleStartAddWebhook" class="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Webhook</button>
      </div>
      <div class="p-4">
        <div v-if="webhookError" class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {{ webhookError }}
        </div>
        <div v-if="isLoadingWebhooks" class="text-center py-6 text-sm text-neutral-500">Loading webhooks...</div>
        <template v-else>
          <!-- Add Webhook Form -->
          <div v-if="isAddingNewWebhook" class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <form @submit.prevent="handleAddWebhook" class="flex items-center gap-2">
              <input v-model="newWebhookUrl" type="url" required placeholder="https://example.com/webhook"
                class="flex-1 px-3 py-1.5 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" autofocus />
              <button type="submit" :disabled="isAddingWebhook"
                class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                {{ isAddingWebhook ? 'Adding...' : 'Add' }}
              </button>
              <button type="button" @click="handleCancelNewWebhook" class="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-800">Cancel</button>
            </form>
          </div>
          <!-- Webhooks List -->
          <div v-if="webhooks.length === 0 && !isAddingNewWebhook" class="text-center py-6 text-sm text-neutral-500">No webhooks configured</div>
          <div v-else class="space-y-2">
            <div v-for="webhook in webhooks" :key="webhook.id"
              class="border border-neutral-200 rounded-md overflow-hidden">
              <div class="flex items-center gap-3 px-3 py-2 bg-neutral-50">
                <span :class="webhook.enabled ? 'bg-green-500' : 'bg-neutral-300'" class="w-2 h-2 rounded-full shrink-0"></span>
                <span class="flex-1 text-sm font-mono text-neutral-700 truncate">{{ webhook.url }}</span>
                <div class="flex items-center gap-1">
                  <span v-for="event in webhook.events" :key="event" class="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                    {{ formatEventName(event) }}
                  </span>
                </div>
                <span v-if="webhook.documentId" class="text-xs text-neutral-500">{{ getDocumentTitle(webhook.documentId) }}</span>
                <span v-else class="text-xs text-neutral-400">All docs</span>
                <div class="flex items-center gap-1 ml-2">
                  <button @click="handleEditWebhook(webhook)" class="p-1 text-neutral-400 hover:text-neutral-600" title="Edit">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button @click="handleToggleWebhook(webhook)" class="p-1 text-neutral-400 hover:text-neutral-600" :title="webhook.enabled ? 'Disable' : 'Enable'">
                    <svg v-if="webhook.enabled" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </button>
                  <button @click="handleDeleteWebhook(webhook.id)" class="p-1 text-neutral-400 hover:text-red-500" title="Delete">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
              <!-- Edit Panel -->
              <div v-if="editingWebhookId === webhook.id" class="px-3 py-3 border-t border-neutral-200 bg-background">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-medium text-neutral-700 mb-2">Events</label>
                    <div class="space-y-1">
                      <label class="flex items-center text-sm">
                        <input type="checkbox" value="document.published" v-model="editingWebhookEvents" class="mr-2 rounded border-neutral-300 text-blue-600 focus:ring-blue-500" />
                        Published
                      </label>
                      <label class="flex items-center text-sm">
                        <input type="checkbox" value="document.unpublished" v-model="editingWebhookEvents" class="mr-2 rounded border-neutral-300 text-blue-600 focus:ring-blue-500" />
                        Unpublished
                      </label>
                      <label class="flex items-center text-sm">
                        <input type="checkbox" value="document.deleted" v-model="editingWebhookEvents" class="mr-2 rounded border-neutral-300 text-blue-600 focus:ring-blue-500" />
                        Deleted
                      </label>
                      <label class="flex items-center text-sm">
                        <input type="checkbox" value="mention" v-model="editingWebhookEvents" class="mr-2 rounded border-neutral-300 text-blue-600 focus:ring-blue-500" />
                        Mention
                      </label>
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-neutral-700 mb-2">Document Filter</label>
                    <input v-model="editingDocumentSearchQuery" type="text" placeholder="Search documents..."
                      class="w-full px-2 py-1 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1" />
                    <select v-model="editingWebhookDocumentId" size="3"
                      class="w-full px-2 py-1 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option :value="null">All documents</option>
                      <option v-for="doc in getFilteredDocumentsForEdit()" :key="doc.id" :value="doc.id">
                        {{ doc.properties?.title || doc.slug }}
                      </option>
                    </select>
                  </div>
                </div>
                <div class="mt-3 flex justify-end gap-2">
                  <button @click="handleCancelEdit()" class="px-3 py-1 text-sm text-neutral-600 hover:text-neutral-800">Cancel</button>
                  <button @click="handleSaveWebhook(webhook.id)" :disabled="editingWebhookEvents.length === 0"
                    class="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- Extensions Card -->
    <section class="bg-background border border-neutral-200 rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
        <h3 class="text-sm font-semibold text-neutral-900">Extensions</h3>
      </div>
      <div class="p-4">
        <ExtensionSettings />
      </div>
    </section>

    <!-- Danger Zone Card -->
    <section class="bg-background border-2 border-red-200 rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-red-50 border-b border-red-200">
        <h3 class="text-sm font-semibold text-red-700">Danger Zone</h3>
      </div>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-neutral-900">Delete this space</p>
            <p class="text-xs text-neutral-500">All documents and data will be archived. This cannot be undone.</p>
          </div>
          <button type="button" @click="showDeleteConfirm = true"
            class="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500">
            Delete Space
          </button>
        </div>
      </div>
    </section>
  </div>

  <!-- Delete Confirmation Modal -->
  <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showDeleteConfirm = false">
    <div class="bg-background rounded-lg shadow-xl w-full mx-4 p-5">
      <h3 class="text-base font-semibold text-neutral-900 mb-3">Delete Space</h3>
      <p class="text-sm text-neutral-600 mb-3">
        Are you sure you want to delete <strong>{{ currentSpace?.name }}</strong>? This action will archive all documents and data.
      </p>
      <p class="text-sm text-neutral-600 mb-3">
        Type <code class="px-1.5 py-0.5 bg-neutral-100 rounded font-mono text-sm">{{ currentSpace?.slug }}</code> to confirm:
      </p>
      <input v-model="deleteConfirmText" type="text" placeholder="Type space slug"
        class="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 mb-3" />
      <div v-if="deleteError" class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
        {{ deleteError }}
      </div>
      <div class="flex gap-2">
        <button type="button" @click="showDeleteConfirm = false; deleteConfirmText = ''; deleteError = null;"
          class="flex-1 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200">
          Cancel
        </button>
        <button type="button" @click="handleDeleteSpace" :disabled="deleteConfirmText !== currentSpace?.slug || isDeleting"
          class="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {{ isDeleting ? 'Deleting...' : 'Delete Space' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useSpace } from "../composeables/useSpace.ts";
import { api, type WebhookEvent, type Webhook, type AccessToken } from "../api/client.ts";
import SpaceMembers from "./SpaceMembers.vue";
import ExtensionSettings from "./ExtensionSettings.vue";

const emit = defineEmits(["saved"]);

const { currentSpace, updateSpace } = useSpace();

const localName = ref("");
const localSlug = ref("");
const localDescription = ref("");
const localBrandColor = ref("#1e293b");
const localLogoSvg = ref("");
const isSaving = ref(false);
const error = ref<string | null>(null);

// Webhook state
const webhooks = ref<Webhook[]>([]);
const isLoadingWebhooks = ref(false);
const isAddingWebhook = ref(false);
const isAddingNewWebhook = ref(false);
const newWebhookUrl = ref("");
const webhookError = ref<string | null>(null);
interface SpaceDocument { id: string; slug: string; properties?: { title?: string } }
const documents = ref<SpaceDocument[]>([]);
const editingWebhookId = ref<string | null>(null);
const editingWebhookEvents = ref<WebhookEvent[]>([]);
const editingWebhookDocumentId = ref<string | null>(null);
const editingDocumentSearchQuery = ref("");

// Access Tokens state
const accessTokens = ref<AccessToken[]>([]);
const isLoadingTokens = ref(false);
const tokenError = ref<string | null>(null);

// Delete space state
const showDeleteConfirm = ref(false);
const deleteConfirmText = ref("");
const isDeleting = ref(false);
const deleteError = ref<string | null>(null);

watch(
  () => currentSpace.value,
  () => {
    if (currentSpace.value) {
      localName.value = currentSpace.value.name;
      localSlug.value = currentSpace.value.slug;
      localDescription.value = currentSpace.value.preferences?.description || "";
      localBrandColor.value = currentSpace.value.preferences?.brandColor || "#1e293b";
      localLogoSvg.value = currentSpace.value.preferences?.logoSvg || "";
      error.value = null;
    }
  },
  {
    immediate: true
  }
);

async function handleLogoUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg'];
  if (!validTypes.includes(file.type)) {
    error.value = "Only SVG, PNG, and JPG files are supported";
    return;
  }

  try {
    if (file.type === 'image/svg+xml') {
      let text = await file.text();
      text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      text = text.replace(/on\w+="[^"]*"/g, "");
      text = text.replace(/on\w+='[^']*'/g, "");
      localLogoSvg.value = text;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        localLogoSvg.value = e.target?.result as string;
      };
      reader.onerror = () => {
        error.value = "Failed to read image file";
      };
      reader.readAsDataURL(file);
    }
    error.value = null;
  } catch {
    error.value = "Failed to read image file";
  }
}

async function handleSave() {
  if (!currentSpace.value) return;

  isSaving.value = true;
  error.value = null;

  try {
    await updateSpace(
      currentSpace.value.id,
      localName.value.trim(),
      localSlug.value.trim(),
      {
        description: localDescription.value.trim(),
        brandColor: localBrandColor.value,
        logoSvg: localLogoSvg.value,
      },
    );
    emit("saved");
    window.location.href = `/${localSlug.value.trim()}`;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to update space";
  } finally {
    isSaving.value = false;
  }
}

async function loadWebhooks() {
  if (!currentSpace.value?.id) return;
  isLoadingWebhooks.value = true;
  webhookError.value = null;

  try {
    const response = await api.webhooks.get(currentSpace.value.id);
    webhooks.value = response.webhooks || [];
  } catch (err) {
    webhookError.value = err instanceof Error ? err.message : "Failed to load webhooks";
  } finally {
    isLoadingWebhooks.value = false;
  }
}

function handleStartAddWebhook() {
  isAddingNewWebhook.value = true;
  newWebhookUrl.value = "";
  webhookError.value = null;
}

function handleCancelNewWebhook() {
  isAddingNewWebhook.value = false;
  newWebhookUrl.value = "";
  webhookError.value = null;
}

async function handleAddWebhook() {
  if (!currentSpace.value?.id || !newWebhookUrl.value.trim()) return;

  isAddingWebhook.value = true;
  webhookError.value = null;

  try {
    const response = await api.webhooks.post(currentSpace.value.id, {
      url: newWebhookUrl.value.trim(),
      events: ["document.published"],
      documentId: undefined,
      secret: undefined,
    });
    newWebhookUrl.value = "";
    isAddingNewWebhook.value = false;
    await loadWebhooks();
    if (response.webhook) {
      handleEditWebhook(response.webhook);
    }
  } catch (err) {
    webhookError.value = err instanceof Error ? err.message : "Failed to add webhook";
  } finally {
    isAddingWebhook.value = false;
  }
}

async function handleToggleWebhook(webhook: Webhook) {
  if (!currentSpace.value?.id) return;
  webhookError.value = null;

  try {
    await api.webhooks.patch(currentSpace.value.id, webhook.id, { enabled: !webhook.enabled });
    await loadWebhooks();
  } catch (err) {
    webhookError.value = err instanceof Error ? err.message : "Failed to toggle webhook";
  }
}

async function handleDeleteWebhook(webhookId: string) {
  if (!currentSpace.value?.id) return;
  if (!confirm("Are you sure you want to delete this webhook?")) return;
  webhookError.value = null;

  try {
    await api.webhooks.delete(currentSpace.value.id, webhookId);
    await loadWebhooks();
  } catch (err) {
    webhookError.value = err instanceof Error ? err.message : "Failed to delete webhook";
  }
}

function formatEventName(event: string): string {
  const names: Record<string, string> = {
    "document.published": "Published",
    "document.unpublished": "Unpublished",
    "document.deleted": "Deleted",
    "mention": "Mention",
  };
  return names[event] || event;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDocumentTitle(documentId: string): string {
  const doc = documents.value.find((d) => d.id === documentId);
  return doc?.properties?.title || doc?.slug || documentId;
}

async function loadDocuments() {
  if (!currentSpace.value?.id) return;
  try {
    const docs = await api.documents.get(currentSpace.value.id);
    documents.value = docs.documents || [];
  } catch {
    // Silent fail for documents list
  }
}

function getFilteredDocumentsForEdit() {
  if (!editingDocumentSearchQuery.value.trim()) {
    return documents.value;
  }
  const query = editingDocumentSearchQuery.value.toLowerCase();
  return documents.value.filter((doc) => {
    const title = (doc.properties?.title || doc.slug || "").toLowerCase();
    return title.includes(query);
  });
}

function handleEditWebhook(webhook: Webhook) {
  editingWebhookId.value = webhook.id;
  editingWebhookEvents.value = [...webhook.events];
  editingWebhookDocumentId.value = webhook.documentId ?? null;
  editingDocumentSearchQuery.value = "";
}

function handleCancelEdit() {
  editingWebhookId.value = null;
  editingWebhookEvents.value = [];
  editingWebhookDocumentId.value = null;
  editingDocumentSearchQuery.value = "";
}

async function handleSaveWebhook(webhookId: string) {
  if (!currentSpace.value?.id || editingWebhookEvents.value.length === 0) return;
  webhookError.value = null;

  try {
    await api.webhooks.patch(currentSpace.value.id, webhookId, {
      events: editingWebhookEvents.value,
      documentId: editingWebhookDocumentId.value || undefined,
    });
    handleCancelEdit();
    await loadWebhooks();
  } catch (err) {
    webhookError.value = err instanceof Error ? err.message : "Failed to update webhook";
  }
}

async function handleDeleteSpace() {
  if (!currentSpace.value?.id || deleteConfirmText.value !== currentSpace.value.slug) return;
  deleteError.value = null;
  isDeleting.value = true;

  try {
    await api.space.delete(currentSpace.value.id);
    window.location.href = "/";
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : "Failed to delete space";
    isDeleting.value = false;
  }
}

async function loadAccessTokens() {
  if (!currentSpace.value?.id) return;
  isLoadingTokens.value = true;
  tokenError.value = null;

  try {
    const response = await api.accessTokens.get(currentSpace.value.id);
    accessTokens.value = response.tokens || [];
  } catch {
    tokenError.value = "Failed to load access tokens";
    accessTokens.value = [];
  } finally {
    isLoadingTokens.value = false;
  }
}

async function handleRevokeToken(tokenId: string) {
  if (!currentSpace.value?.id) return;
  if (!confirm("Are you sure you want to revoke this token?")) return;
  tokenError.value = null;

  try {
    await api.accessTokens.revoke(currentSpace.value.id, tokenId);
    await loadAccessTokens();
  } catch {
    tokenError.value = "Failed to revoke token";
  }
}

async function handleDeleteToken(tokenId: string) {
  if (!currentSpace.value?.id) return;
  if (!confirm("Are you sure you want to delete this token?")) return;
  tokenError.value = null;

  try {
    await api.accessTokens.delete(currentSpace.value.id, tokenId);
    await loadAccessTokens();
  } catch {
    tokenError.value = "Failed to delete token";
  }
}

onMounted(() => {
  loadWebhooks();
  loadDocuments();
  loadAccessTokens();
});

watch(() => currentSpace.value?.id, () => {
  if (currentSpace.value?.id) {
    loadWebhooks();
    loadDocuments();
    loadAccessTokens();
  }
});
</script>
