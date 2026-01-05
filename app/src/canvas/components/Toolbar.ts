import { html, render } from "lit-html";

export class ToolbarTool extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.update();
  }

  update() {
    render(this.render(), this.shadowRoot);
  }

  render() {
    return html`
            <style>
                :host {
                    width: 45px;
                    height: 45px;
                    border-radius: 50%;
                    backdrop-filter: blur(4px);
                    font-family: 'Roboto', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    cursor: pointer;
                }
                :host(:hover), :host([active]) {
                    background: var(--color-primary-300, white);
                }
            </style>
            <slot></slot>
        `;
  }
}

export class ToolbarElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this.activeTool = this.children[0].getAttribute("value");
  }

  connectedCallback() {
    this.update();

    for (const child of this.children) {
      child.onclick = () => {
        this.activeTool = child.getAttribute("value");
        this.update();
        this.dispatchEvent(new Event("change"));
      };
    }
  }

  get tool() {
    return this.activeTool;
  }

  set tool(v) {
    this.activeTool = v;
    this.update();
  }

  update() {
    render(this.render(), this.shadowRoot);

    for (const child of this.children) {
      if (child.getAttribute("value") === this.activeTool) {
        child.setAttribute("active", "");
      } else {
        child.removeAttribute("active");
      }
    }
  }

  render() {
    return html`
            <style>
                .tool-list {
                    display: flex;
                    gap: 0.5rem;
                    background: rgb(33 33 33 / 0.75);
                    border: 1px solid #232323;
                    border-radius: 100vw;
                    backdrop-filter: blur(4px);
                    box-shadow: 1px 3px 8px rgb(0 0 0 / 10%);
                }
            </style>
            <div class="tool-list">
                <slot></slot>
            </div>
        `;
  }
}

customElements.define("tolbar-element", ToolbarElement);
customElements.define("tolbar-tool", ToolbarTool);
