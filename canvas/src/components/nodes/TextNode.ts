import { CanvasOverlayElement } from "../CanvasOverlayElement.ts";
import { NodeElement } from "../NodeElement.ts";
import Node from "./Node.ts";

class TextNodeElement extends NodeElement {}

customElements.define("text-node-element", TextNodeElement);

export default class TextNode extends Node {
  static get OverlayElement() {
    return CanvasOverlayElement;
  }

  // static get NodeUIElement() {
  //     return TextNodeElement;
  // }

  static onFocus(_canvas, _node) {}

  static onBlur(_camvas, _node) {}
}
