import { Editor } from "@tiptap/core";
import { ExtensionSuggestions } from "./extensions/ExtensionSuggestions.ts";
import docStyles from "../styles/document.css?inline";
import * as Y from "yjs";
import { Dropcursor } from "@tiptap/extensions";
import DragHandle from "@tiptap/extension-drag-handle";
import { api, type User } from "../api/client.ts";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Collaboration from "@tiptap/extension-collaboration";
import { getUserColor } from "../composeables/useUserProfile.ts";
import { contentExtensions } from "./extensions.ts";
import { TrailingNodePlus } from "./extensions/TrailingNodePlus.ts";
import { IndexedDBStore } from "../utils/storage.ts";
// import { IndexeddbPersistence } from 'y-indexeddb'
import { createYProvider } from "../utils/sync.ts";
import { MentionSuggestons } from "./extensions/MentionSuggestons.ts";

declare global {
  interface Window {
    __editor?: Editor;
  }
}

type EditorStoreEntry = {
  documentId: string;
  content: string;
  createdAt: number;
};

export class ContentEditor extends HTMLElement {
  element: HTMLElement;
  editor?: Editor;
  store?: IndexedDBStore<EditorStoreEntry>;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open", delegatesFocus: true });
    Object.assign(shadow, {
      createRange: document.createRange.bind(document)
    });

    this.element = document.createElement("div");
    this.element.className = "tiptap";
    shadow.innerHTML = `
      <style>${docStyles}</style>
    `;
    shadow.appendChild(this.element);

    this.addEventListener("keydown", (e) => {
      const action = Actions.getActionForShortcut(e);
      if (action) return;

      e.stopPropagation();
    });
  }

  init(spaceId: string, documentId: string, user: User) {
    this.editor = createEditor(this.element, spaceId, documentId, user);

    const handleUpdate = () => {
      window.dispatchEvent(new Event("editor-update"));
    };

    this.editor.on("selectionUpdate", handleUpdate);
    this.editor.on("update", handleUpdate);

    window.__editor = this.editor;

    return this.editor;
  }
}

customElements.define("editor-content", ContentEditor);

function createEditor(
  editorElement: HTMLElement,
  spaceId: string,
  documentId: string,
  user: User,
) {
  if (!documentId || !spaceId) {
    console.warn("Missing documentId or spaceId");
  }

  const ydoc = new Y.Doc();

  const roomName = `${spaceId}:${documentId || crypto.randomUUID()}`;

  const provider = createYProvider(roomName, ydoc);

  // const _persitance = new IndexeddbPersistence(roomName, ydoc);

  const editor = new Editor({
    element: editorElement,
    onContentError: ({ error, disableCollaboration }) => {
      console.error(error);
      disableCollaboration();
    },
    onCreate: async ({ editor: currentEditor }) => {
      currentEditor.commands.focus();
    },
    onUpdate: () => {
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
        const ev = new CustomEvent("editor-keydown", { detail: event, cancelable: true });
        window.dispatchEvent(ev);

        if (ev.defaultPrevented === true) {
          event.preventDefault();
          return true;
        }

        return false;
      },
    },
    extensions: [
      ...contentExtensions(spaceId, documentId),

      TrailingNodePlus,

      DragHandle.configure({
        render: () => {
          const element = document.createElement("div");
          element.classList.add("custom-drag-handle");
          return element;
        },
      }),
      Dropcursor,
      MentionSuggestons.configure({
        spaceId: spaceId,
      }),

      ExtensionSuggestions,

      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCaret.configure({
        provider: provider,
        user: {
          name: user?.name,
          color: getUserColor(user?.email),
        },
      }),
    ]
  });

  api.connections.get(spaceId).then(connections => {
    editor.storage.ticketLink.connections = connections;
  })

  return editor;
}
