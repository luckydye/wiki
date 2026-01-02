import { authClient } from "~/src/composeables/auth-client";
import { detectAppType, stripScriptTags } from "~/src/utils/utils";
import docStyles from "../../styles/document.css?inline";
import "./textarea.ts";
import "./expression.ts";
import "./file-attachment.ts";

customElements.define("document-view", class extends HTMLElement {
  connectedCallback() {
    let attached = false;
    this.addEventListener("pointerover", () => {
      if(!attached) {
        this.attachListeners();
      }
      attached = true;
    })

    this.attachListeners();

    this.initTemplate();
  }

  initTemplate() {
    const template = this.querySelector("template");
    if (template && !template.shadowRootMode) {
      const clone = template.content.cloneNode(true);
      const shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>${docStyles}</style>
      `;
      shadow.append(clone);
    }
  }

  attachListeners() {
    // make link previews work
    this.shadowRoot?.addEventListener("pointerover", (e) => {
      document.dispatchEvent(new CustomEvent("hover", {
        detail: {
          target: e.target
        }
      }));
    }, {
      capture: true
    });
    this.shadowRoot?.addEventListener("pointerout", (e) => {
      document.dispatchEvent(new CustomEvent("mouseout"));
    }, {
      capture: true
    });

    // Handle clicks on internal document links - open in overlay
    // Hold Shift to navigate normally instead
    this.shadowRoot?.addEventListener("click", ((e: MouseEvent) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) return;

      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Check if this is an internal document link
      const docSlug = this.parseDocumentSlug(href);
      if (!docSlug) return;

      // Prevent default navigation
      e.preventDefault();
      e.stopPropagation();

      // Get spaceId from body dataset and dispatch event for overlay
      const spaceId = document.body.dataset.spaceId;
      if (!spaceId) return;

      window.dispatchEvent(new CustomEvent("view-document-by-slug", {
        detail: { spaceId, docSlug }
      }));
    }) as EventListener, { capture: true });
  }

  // Extract document slug from URL like /space-slug/doc/document-slug
  parseDocumentSlug(url: string): string | null {
    try {
      const urlObj = new URL(url, window.location.origin);
      if (urlObj.origin !== window.location.origin) return null;

      const parts = urlObj.pathname.split("/").filter(Boolean);
      // Expected: [spaceSlug, "doc", ...docSlugParts]
      if (parts.length >= 3 && parts[1] === "doc") {
        return parts.slice(2).join("/");
      }
      return null;
    } catch {
      return null;
    }
  }
});

function createFigmaEmbedUrl(figmaUrl: string): string {
  return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(figmaUrl)}`;
}

customElements.define("figma-embed", class extends HTMLElement {
  connectedCallback() {
    const figmaUrl = this.dataset.figmaUrl;
    if (!figmaUrl) return;

    const height = this.getAttribute("height") || "450px";

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          border: 1px solid #e5e7eb;
          border-radius: var(--radius-xl);
          overflow: hidden;
        }
      </style>
    `;

    const iframe = document.createElement("iframe");
    iframe.src = createFigmaEmbedUrl(figmaUrl);
    iframe.style.cssText = "width: 100%; height: 100%; display: block; border: none;";
    if (height) {
      iframe.style.height = `${height}px`;
    }
    iframe.setAttribute("allowfullscreen", "true");

    shadow.appendChild(iframe);
  }
})


customElements.define(
  "html-block",
  class extends HTMLElement {
    shadow: ShadowRoot | null = null;
    editmode: boolean = false;

    connectedCallback() {
      this.shadow = this.attachShadow({ mode: "open" });
      this.updateContent();
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
      if (name === "data-html" && oldValue !== newValue) {
        this.updateContent();
      }
      if (name === "contenteditable") {
        this.editmode = this.hasAttribute("contenteditable");
        this.updateContent();
      }
    }

    static get observedAttributes() {
      return ["data-html", "contenteditable"];
    }

    private updateContent() {
      if (!this.shadow) return;

      const htmlString = this.getAttribute("data-html");

      const container = document.createElement("div");
      container.innerHTML = stripScriptTags(htmlString || "");
      container.contentEditable = this.closest(".tiptap") ? "true" : "false";
      container.addEventListener("input", () => {
        const html = container.innerHTML;
        this.dispatchEvent(new CustomEvent("change", { detail: html }));
      });

      this.shadow.appendChild(container);
    }
  },
);

function getTicketUrlTemplate(
  appType: "jira" | "youtrack" | "linear" | "github" | "gitlab",
  baseUrl: string,
): string {
  if (!baseUrl) {
    return "";
  }

  const cleanUrl = baseUrl.replace(/\/$/, "");

  switch (appType) {
    case "jira":
      return `${cleanUrl}/browse/{ticketId}`;
    case "youtrack":
      return `${cleanUrl}/issue/{ticketId}`;
    case "linear":
      return `${cleanUrl}/issue/{ticketId}`;
    case "github":
      return `${cleanUrl}/issues/{ticketId}`;
    case "gitlab":
      return `${cleanUrl}/-/issues/{ticketId}`;
    default:
      return `${cleanUrl}/{ticketId}`;
  }
}

customElements.define(
  "ticket-link",
  class extends HTMLElement {
    constructor() {
      super();

      this.addEventListener("click", this.click);
      this.addEventListener("auxclick", this.click);
    }

    click() {
      const connectionLabel = this.getAttribute("data-connection-label");
      if (!connectionLabel) {
        throw new Error("No connection label");
      }

      const appType = detectAppType(connectionLabel);
      if (!appType) {
        throw new Error("Missing valid appType");
      }

      const ticketId = this.getAttribute("data-ticket-id");
      if (!ticketId) {
        throw new Error("Missing ticketId");
      }

      const connectionUrl = this.getAttribute("data-connection-url");
      if (!connectionUrl) {
        throw new Error("Missing connectionUrl");
      }

      const baseUrl = new URL(connectionUrl).origin;
      const urlTemplate = getTicketUrlTemplate(appType, baseUrl);
      const ticketUrl = urlTemplate.replace("{ticketId}", ticketId);
      window.open(ticketUrl, "_blank");
    }
  },
);

// Custom element for user mentions in the editor
// Renders @mentions with click handling and tooltip support
//
// Usage in HTML:
//   <user-mention email="user@example.com">@John Doe</user-mention>
//
// Event handling:
//   editor.view.dom.addEventListener('mention-click', (e) => {
//     console.log('Mentioned user:', e.detail.email);
//     // Navigate to user profile, show tooltip, etc.
//   });
customElements.define("user-mention", class UserMentionElement extends HTMLElement {
  connectedCallback() {
    this.setAttribute("role", "button");
    this.setAttribute("tabindex", "0");

    this.addEventListener("click", this.handleClick);
    this.addEventListener("keydown", this.handleKeyDown);

    // Check if this mention is for the current user
    this.checkSelfMention();
  }

  async checkSelfMention() {
    const mentionEmail = this.getAttribute("email");
    if (!mentionEmail) return;

    try {
      const { data: session } = await authClient.getSession();
      if (session?.user?.email === mentionEmail) {
        this.setAttribute("data-self-mention", "true");
      }
    } catch {
      // Silently fail if we can't check
    }
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.handleClick);
    this.removeEventListener("keydown", this.handleKeyDown);
  }

  handleClick = (event: Event) => {
    event.preventDefault();
    const email = this.getAttribute("email");

    if (email) {
      this.dispatchEvent(
        new CustomEvent("mention-click", {
          detail: { email },
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.handleClick(event);
    }
  };

  get email(): string | null {
    return this.getAttribute("email");
  }

  set email(value: string | null) {
    if (value) {
      this.setAttribute("email", value);
    } else {
      this.removeAttribute("email");
    }
  }
});
