import Tool from "./Tool.ts";

function pointInCircle(p1, p2, r) {
  return Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2) <= r;
}

export default class Pen extends Tool {
  static currentLine;

  static onMouseDown(cnvs, _data) {
    // mbtn 0 mousedown
    // draw line with pen
    // PEN TOOL
    cnvs.canvas.lines.unshift([]);

    Pen.currentLine = cnvs.canvas.createLine();
  }

  static onMouseUp(cnvs, data) {
    // nothing
    Pen.onMouseUse(cnvs, data);
  }

  static onMouseDrag(cnvs, data) {
    Pen.onMouseUse(cnvs, data);
  }

  static onMouseUse(cnvs, data) {
    // mbtn 0 mouseup or dragging
    // draw with pen
    // PEN TOOL
    if (data.shiftKey) {
      for (const line of cnvs.canvas.lines) {
        for (const point of [...line]) {
          if (
            pointInCircle(
              point,
              [cnvs.pointer.canvasX, cnvs.pointer.canvasY],
              cnvs.pointer.brushSize / cnvs.currentScale,
            )
          ) {
            line.splice(line.indexOf(point), 1);
          }
        }
      }
    } else {
      Pen.currentLine?.insert(Pen.currentLine.length, [
        cnvs.viewToCanvas(data.x, data.y),
      ]);
    }
  }
}
