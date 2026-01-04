/**
 * category-target
 *
 * A custom element that enables drag and drop functionality for categories.
 * This element acts as a drop target for page-target elements (documents).
 *
 * Usage:
 * ```html
 * <category-target
 *   data-category-id="cat-123"
 *   class="block [&[data-drag-over]]:bg-neutral-100"
 * >
 *   <div class="category-header">Your category content</div>
 * </category-target>
 * ```
 *
 * Attributes:
 * - data-category-id: Required. The unique ID of the category
 * - data-drag-over: Automatically added when a document is dragged over this category
 *
 * Events:
 * - document-category-change: Fired when a document is dropped onto this category
 *   detail: { documentId: string, newCategoryId: string }
 *
 * Example event handling:
 * ```javascript
 * window.addEventListener('document-category-change', (e) => {
 *   const { documentId, newCategoryId } = e.detail;
 *   // Update document category in your database
 * });
 * ```
 */
customElements.define(
  "category-target",
  class extends HTMLElement {
    dragCounter = 0;

    connectedCallback() {
      this.addEventListener("dragenter", this.handleDragEnter.bind(this));
      this.addEventListener("dragleave", this.handleDragLeave.bind(this));
      this.addEventListener("dragover", this.handleDragOver.bind(this));
      this.addEventListener("drop", this.handleDrop.bind(this));
    }

    disconnectedCallback() {
      this.removeEventListener("dragenter", this.handleDragEnter.bind(this));
      this.removeEventListener("dragleave", this.handleDragLeave.bind(this));
      this.removeEventListener("dragover", this.handleDragOver.bind(this));
      this.removeEventListener("drop", this.handleDrop.bind(this));
    }

    handleDragEnter(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();

      this.dragCounter++;
      this.setAttribute("data-drag-over", "true");
    }

    handleDragLeave(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();

      this.dragCounter--;

      if (this.dragCounter === 0) {
        this.removeAttribute("data-drag-over");
      }
    }

    handleDragOver(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (!e.dataTransfer) return;
      e.dataTransfer.dropEffect = "move";
    }

    handleDrop(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();

      this.removeAttribute("data-drag-over");
      this.dragCounter = 0;

      if (!e.dataTransfer) return;

      const draggedDocumentId = e.dataTransfer.getData("text/plain");
      const targetCategoryId = this.getAttribute("data-category-id");

      if (!draggedDocumentId || !targetCategoryId) {
        throw new Error("Missing document or category ID");
      }

      this.dispatchEvent(
        new CustomEvent("document-category-change", {
          bubbles: true,
          composed: true,
          detail: {
            documentId: draggedDocumentId,
            newCategoryId: targetCategoryId,
          },
        }),
      );
    }
  },
);
