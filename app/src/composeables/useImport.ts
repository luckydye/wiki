import { ref } from "vue";
import { api } from "../api/client.js";

export interface ImportResult {
  totalFiles: number;
  imported: number;
  skipped: number;
  failed: number;
  documents: Array<{ slug: string; title: string; id: string }>;
  errors: Array<{ file: string; error: string }>;
}

export function useImport() {
  const importing = ref(false);
  const progress = ref<ImportResult | null>(null);
  const error = ref<string | null>(null);

  /**
   * Import files, zip archives, or directories into a space
   * 
   * Files in subdirectories (within zip archives) are automatically organized
   * in a hierarchical structure with proper parent-child relationships.
   * Directory documents are created automatically to represent folders.
   * 
   * Supported formats: .md, .markdown, .html, .htm, .json, .txt, .log, .odt, .docx, .rst, .org, .epub, .docbook, .zip
   * Note: ODT, DOCX, RST, ORG, EPUB, and DOCBOOK formats require pandoc to be installed on the server.
   * 
   * @example
   * const { importFiles } = useImport();
   * 
   * // Import a single markdown file
   * const file = fileInput.files[0];
   * const result = await importFiles('space-123', file);
   * 
   * // Import a zip archive with nested folders
   * // Structure: docs/guides/setup.md
   * // Creates: "docs" → "guides" → "setup.md" (with parent-child links)
   * const zipFile = fileInput.files[0];
   * const result = await importFiles('space-123', zipFile);
   * 
   * @param spaceId - The space ID to import into
   * @param file - File to import (single file or zip archive)
   * @returns Import result with statistics and created documents (includes auto-created directory docs)
   */
  async function importFiles(spaceId: string, file: File): Promise<ImportResult> {
    importing.value = true;
    error.value = null;
    progress.value = null;

    try {
      const result = await api.import.post(spaceId, file) as ImportResult;
      progress.value = result;
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      error.value = errorMessage;
      throw err;
    } finally {
      importing.value = false;
    }
  }

  /**
   * Reset the import state
   */
  function resetImport() {
    importing.value = false;
    progress.value = null;
    error.value = null;
  }

  return {
    importing,
    progress,
    error,
    importFiles,
    resetImport,
  };
}