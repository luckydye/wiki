import { type Easing, type InputState, Track, type Trait } from "@sv/elements/track";
import "../editor/editor.ts";
import "../editor/elements/textarea.ts";
import "../editor/elements/expression.ts";
import "../editor/elements/document.ts";
import "@sv/elements/scroll";
import { render, html } from "lit-html";
import * as ICON from "../assets/icons.ts";

customElements.define(
  "wiki-scroll",
  class ScrollElement extends HTMLElement {
    /** The unique name of the scroll container. Fallback is className + className of the parent element. */
    public name?: string;

    private fallbackName() {
      return `${this.className}-${this.parentElement?.className}`.replace(" ", ".");
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
      if (name === "name") {
        this.name = newValue || this.fallbackName();
      }
    }

    constructor() {
      super();

      this.name = this.name || this.fallbackName();

      // stops scrolling the body if this container can't scroll
      this.addEventListener("wheel", (e) => {
        if (
          this.scrollTop + e.deltaY > 0 &&
          this.scrollTop + e.deltaY < this.scrollHeight - this.offsetHeight
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
      });

      setTimeout(() => {
        this.loadSavedScrollPosition();
      }, 250);

      window.addEventListener('astro:page-load', () => {
        this.loadSavedScrollPosition();
      });

      setInterval(() => {
        const storage = sessionStorage;
        if(this.name)
          storage.setItem(this.name, this.scrollTop.toString());
      }, 1000);
    }

    connectedCallback() {
      this.name = this.name || this.fallbackName();

      this.loadSavedScrollPosition();
    }

    loadSavedScrollPosition() {
      const storage = sessionStorage;

      if (storage && this.name) {
        const top = storage.getItem(this.name);
        if (top !== null) {
          this.scrollTop = Number.parseInt(top, 10);
        }

        window.addEventListener("beforeunload", () => {
          if(this.name)
            storage.setItem(this.name, this.scrollTop.toString());
        });
      }
    }
  },
);

/**
 * page-target
 *
 * A custom element that enables drag and drop functionality for document tree items.
 * Each element can be dragged and also acts as a drop target for other elements.
 *
 * Usage:
 * ```html
 * <page-target
 *   data-document-id="doc-123"
 *   class="block [&[data-drag-over]]:bg-blue-100 [&[data-dragging]]:opacity-50"
 * >
 *   <div class="document-item">Your document content</div>
 * </page-target>
 * ```
 *
 * Attributes:
 * - data-document-id: Required. The unique ID of the document
 * - data-dragging: Automatically added when this element is being dragged
 * - data-drag-over: Automatically added when another element is dragged over this one
 *
 * Events:
 * - document-parent-change: Fired when a document is dropped onto this element
 *   detail: { documentId: string, newParentId: string }
 *
 * Example event handling:
 * ```javascript
 * window.addEventListener('document-parent-change', (e) => {
 *   const { documentId, newParentId } = e.detail;
 *   // Update document parent in your database
 * });
 * ```
 */
customElements.define(
  "page-target",
  class extends HTMLElement {
    dragCounter = 0;

    connectedCallback() {
      this.setAttribute("draggable", "true");

      this.addEventListener("dragstart", this.handleDragStart.bind(this));
      this.addEventListener("dragend", this.handleDragEnd.bind(this));
      this.addEventListener("dragenter", this.handleDragEnter.bind(this));
      this.addEventListener("dragleave", this.handleDragLeave.bind(this));
      this.addEventListener("dragover", this.handleDragOver.bind(this));
      this.addEventListener("drop", this.handleDrop.bind(this));
    }

    disconnectedCallback() {
      this.removeEventListener("dragstart", this.handleDragStart.bind(this));
      this.removeEventListener("dragend", this.handleDragEnd.bind(this));
      this.removeEventListener("dragenter", this.handleDragEnter.bind(this));
      this.removeEventListener("dragleave", this.handleDragLeave.bind(this));
      this.removeEventListener("dragover", this.handleDragOver.bind(this));
      this.removeEventListener("drop", this.handleDrop.bind(this));
    }

    handleDragStart(e: DragEvent) {
      const documentId = this.getAttribute("data-document-id");
      if (!documentId) {
        throw new Error("Missing data-document-id attribute");
      }

      if (!e.dataTransfer) return;

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", documentId);
      this.setAttribute("data-dragging", "true");

      e.stopPropagation();
    }

    handleDragEnd(_e: DragEvent) {
      this.removeAttribute("data-dragging");
      this.removeAttribute("data-drag-over");
      this.dragCounter = 0;
    }

    handleDragEnter(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();

      this.dragCounter++;

      const isDraggingSelf = this.hasAttribute("data-dragging");
      if (isDraggingSelf) return;

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

      const isDraggingSelf = this.hasAttribute("data-dragging");
      if (isDraggingSelf) {
        e.dataTransfer.dropEffect = "none";
        return;
      }

      e.dataTransfer.dropEffect = "move";
    }

    handleDrop(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();

      this.removeAttribute("data-drag-over");
      this.dragCounter = 0;

      const isDraggingSelf = this.hasAttribute("data-dragging");
      if (isDraggingSelf) return;

      if (!e.dataTransfer) return;

      const draggedDocumentId = e.dataTransfer.getData("text/plain");
      const targetDocumentId = this.getAttribute("data-document-id");

      if (!draggedDocumentId || !targetDocumentId) {
        throw new Error("Missing document IDs");
      }

      if (draggedDocumentId === targetDocumentId) return;

      this.dispatchEvent(
        new CustomEvent("document-parent-change", {
          bubbles: true,
          composed: true,
          detail: {
            documentId: draggedDocumentId,
            newParentId: targetDocumentId,
          },
        }),
      );
    }
  },
);

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

export class DrawerTrack extends Track {
  public override traits: Trait[] = [
    {
      id: "drawer",
      input(track: DrawerTrack, inputState: InputState) {
        const openThresholdFixed = window.innerHeight / 2;
        const openThreshold = window.innerHeight - openThresholdFixed;

        if (track.position.y > openThreshold && !track.isOpen) {
          track.setOpen(true);
        }
        if (track.position.y < openThreshold && track.isOpen) {
          track.setOpen(false);
        }

        try {
          const scale = 1 - ((track.position.y / window.innerHeight) * 0.075);
          const root = document.querySelector<HTMLDivElement>("#root");
          if (root) {
            if (scale > 0.999) {
              root.style.transform = ``;
            } else {
              root.style.transform = `scale(${scale})`;
            }
          }
        } catch (err) {
          console.error(err);
        }

        if (track.grabbing || track.interacting || track.target) return;
        if (track.deltaVelocity.y >= 0) return;
        if (track.isStatic) return;

        const vel = Math.round(track.velocity[track.currentAxis] * 10) / 10;
        const power = Math.round(vel / 15);

        if (power < 0) {
          track.minimize();
          track.dispatchEvent(new Event("minimize", { bubbles: true }));
        } else if (power > 0) {
          track.open();
          track.dispatchEvent(new Event("open", { bubbles: true }));
        } else {
          if (track.position.y > 400) {
            track.open();
            track.dispatchEvent(new Event("open", { bubbles: true }));
          } else if (track.position.y > 40) {
            track.minimize();
            track.dispatchEvent(new Event("minimize", { bubbles: true }));
          } else {
            track.collapse();
            track.dispatchEvent(new Event("collapse", { bubbles: true }));
          }
        }
      },
    },
  ];

  override transitionTime = 350;
  override drag = 0.98;
  isOpen = false;
  scrollContainer?: HTMLElement | null;
  clickTarget: HTMLElement | null = null;
  enabledDirection: 0 | 1 | null = null; // 1 for y 0 for x

  declare contentheight?: number;

  get isStatic() {
    return !!this.contentheight;
  }

  override onPointerUpOrCancel = (pointerEvent: PointerEvent) => {
    if (pointerEvent.type === "pointercancel") {
      return;
    }

    this.enabledDirection = null;
    this.clickTarget = null;

    // from original implementation
    this.mouseDown = false;
    this.mousePos.mul(0);

    if (this.grabbing) {
      this.grabbing = false;
      this.inputState.release.value = true;

      pointerEvent.preventDefault();
      pointerEvent.stopPropagation();
    }
  };

  constructor() {
    super();

    this.addEventListener("pointerdown", (e) => {
      if (this.isOpen) {
        this.clickTarget = e.target as HTMLElement;
      }
    });
    this.addEventListener("touchstart", (e) => {
      if (this.isOpen) {
        this.clickTarget = e.target as HTMLElement;
      }
    });

    this.addEventListener("click", (e) => {
      if (!this.isOpen) {
        this.open();
      }
    });

    this.vertical = true;
    this.overflow = "ignore";

    // ignore wheel interactions with the track
    // @ts-expect-error
    this.removeEventListener("wheel", this.onWheel, { passive: false });

    this.addEventListener("move", ((e: CustomEvent) => {
      const grabbing = this.grabbing; // the first move call is a check before grabbing is true, so false for the first event
      const dir = e.detail.delta;

      const directionThreshold = 0.1;

      // prevent scrolling on wrong direction, until touchend,
      /// This may be implemented in a-track, for nested tracks in general
      if (this.enabledDirection === null) {
        const direction = Math.abs(dir.x) - Math.abs(dir.y);
        if (direction > directionThreshold) {
          this.enabledDirection = 0;
        } else if (direction < directionThreshold) {
          this.enabledDirection = 1;
        }
      }

      // draw should not work if we scroll in a slider horizontally
      if (this.enabledDirection === 0) {
        e.preventDefault();
      }

      const scrollContainer = this.clickTarget?.closest("[data-scroll-container]");

      if (this.isOpen && !grabbing && scrollContainer) {
        if (scrollContainer?.scrollTop !== 0) {
          e.preventDefault();
        }
        if (scrollContainer?.scrollTop === 0 && dir.y < 0) {
          e.preventDefault();
        }
      }
    }) as EventListener);
  }

  static override get properties() {
    return {
      ...Track.properties,
      contentheight: { type: Number, reflect: true },
    };
  }

  setOpen(value: boolean) {
    this.isOpen = value;

    // dely event to prevent jank
    if (value === true) {
      this.dispatchEvent(new Event("open", { bubbles: true }));
    } else {
      this.dispatchEvent(new Event("minimize", { bubbles: true }));
    }
  }

  open(ease: Easing = "linear") {
    this.scrollContainer = this.querySelector("[data-scroll-container]");
    this.acceleration.mul(0.25);
    this.inputForce.mul(0.125);
    this.setTarget(this.getToItemPosition(1), ease);
  }

  minimize(ease: Easing = "linear") {
    let height = 200;
    if (this.isStatic) {
      const value = this.getAttribute("contentheight");
      const valueInt = value ? +value : Number.NaN;
      const openedPosition = this.getToItemPosition(1);
      height = valueInt > openedPosition.y ? openedPosition.y : valueInt;
    }

    this.acceleration.mul(0.25);
    this.inputForce.mul(0.125);
    this.setTarget([0, height], ease);
  }

  collapse(ease: Easing = "linear") {
    this.acceleration.mul(0.25);
    this.inputForce.mul(0.125);
    this.setTarget([0, 10], ease);
  }
}

customElements.define("drawer-track", DrawerTrack);

const OS = navigator.platform;

customElements.define(
  "a-shortcut",
  class ShortcutElement extends HTMLElement {
    get shortcut() {
      return this.dataset.shortcut || "";
    }

    static get observedAttributes() {
      return ["data-shortcut"];
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
      this.ariaLabel = "Shortcut: " + this.shortcut;
      render(this.render(), this.shadowRoot);
    }

    connectedCallback() {
      render(this.render(), this.shadowRoot);
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }

    render() {
      const combinations = this.shortcut?.split(",").map((c) => c.trim());

      const prefferedCombination =
        combinations?.find((c) => OS === "MacIntel" && c.includes("cmd")) ||
        combinations?.[0];

      const keys = prefferedCombination?.split("-").map(
        (key) => {
          const icon = document.createElement("span");
          icon.className = "key";
          icon.innerHTML = ICON[key.toLowerCase() + 'Icon'] || key.toUpperCase();
          return icon;
        },
      );

      return html`
        <style>
        :host {
          vertical-align: text-bottom;
          font-family: monospace;
          font-size: 1em;
          color: white;
          line-height: 100%;
          vertical-align: text-top;
          padding: 0.125em 0.33em;
          display: inline-flex;
          align-items: center;

          --background-color: #eee;
          --seperator: "";
        }
        .key {
            background-color: var(--background-color);
            line-height: 1.5em;
        }
        .spacer::after {
          content: var(--seperator);
          padding: 2px;
        }
        svg {
          width: 1.125em;
          height: 1.125em;
          vertical-align: text-bottom;
        }
        </style>

        ${keys?.map((key, index) =>
            index > 0 ? html`<span class="spacer"></span>${key}` : key,
        )}
      `;
    }
  },
);
