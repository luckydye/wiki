export default class Node {
  static get OverlayElement() {
    return null;
  }

  static get NodeUIElement() {
    return null;
  }

  static onFocus(_node) {}

  static onBlur(_node) {}

  static onUiDraw(_node, _canvas) {}

  static onDraw(_node, _ctxt) {}
}
