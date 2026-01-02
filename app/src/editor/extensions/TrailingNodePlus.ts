import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const TrailingNodePlus = Extension.create<{}>({
  name: "trailingNodePlus",

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey("trailingNodePlus"),
        props: {
          decorations(state) {
            const { doc, selection } = state;
            const decorations: Decoration[] = [];

            // Check if the document ends with an empty paragraph
            const lastNode = doc.lastChild;
            const lastNodePos = doc.content.size - (lastNode?.nodeSize || 0);

            // Only show button if:
            // 1. Last node is a paragraph
            // 2. It's empty
            // 3. Selection is not in the last node
            if (
              lastNode &&
              lastNode.type.name === "paragraph" &&
              lastNode.content.size === 0
            ) {
              const isLastNodeFocused =
                selection.from >= lastNodePos && selection.to <= doc.content.size;

              if (!isLastNodeFocused) {
                const widget = document.createElement("button");
                widget.type = "button";
                widget.className = "trailing-node-plus-button";
                widget.contentEditable = "false";
                widget.innerHTML = `
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span>Add content</span>
                `;

                widget.addEventListener("click", (e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  const editor = extension.editor;
                  if (editor) {
                    // Focus the empty paragraph and insert slash command
                    editor.chain().focus(lastNodePos + 1).insertContent("/").run();
                  }
                });

                decorations.push(
                  Decoration.widget(lastNodePos + 1, widget, {
                    side: 0,
                    key: "trailing-plus-button",
                  })
                );
              }
            }

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },

  // Ensure there's always a trailing empty paragraph
  onCreate() {
    this.editor.commands.command(({ tr, state }) => {
      const { doc } = state;
      const lastNode = doc.lastChild;

      if (!lastNode || lastNode.type.name !== "paragraph" || lastNode.content.size > 0) {
        tr.insert(doc.content.size, state.schema.nodes.paragraph.create());
        return true;
      }

      return false;
    });
  },

  onUpdate() {
    this.editor.commands.command(({ tr, state }) => {
      const { doc } = state;
      const lastNode = doc.lastChild;

      if (!lastNode || lastNode.type.name !== "paragraph" || lastNode.content.size > 0) {
        tr.insert(doc.content.size, state.schema.nodes.paragraph.create());
        return true;
      }

      return false;
    });
  },
});
