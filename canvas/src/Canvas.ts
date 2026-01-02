import { donwloadToDataUri } from "./utils.ts";
import * as Y from "yjs";

export class Canvas {
  static fromString(data: string) {
    const canvas = new Canvas();
    const parsed = JSON.parse(data);

    const ydoc = new Y.Doc();

    const blobs = ydoc.getArray("blobs");
    blobs.insert(0, parsed.blobs || []);

    const nodes = ydoc.getArray("nodes");
    nodes.insert(0, parsed.nodes || []);

    const lines = ydoc.getArray("lines");
    lines.insert(0, parsed.lines || []);

    const state = Y.encodeStateAsUpdate(ydoc);
    Y.applyUpdate(canvas.doc, state);

    return canvas;
  }

  toString() {
    return JSON.stringify({
      blobs: this.blobs,
      nodes: this.nodes,
      lines: this.lines,
      version: this.version,
    });
  }

  history: string[] = [];

  historyPointer = 0;
  historySize = 0;

  version = "1.0";

  doc = new Y.Doc();
  undoManager = new Y.UndoManager(this.doc);

  canvas: {
    title: string;
    view: [number, number];
    scale: number;
  } = {
    title: "",
    view: [0, 0],
    scale: 0.5,
  };

  get lines() {
    const lines = this.doc.getArray("lines");
    return lines.toJSON();
  }

  get nodes() {
    const nodes = this.doc.getArray("nodes");
    return nodes.toJSON();
  }

  get blobs() {
    const blobs = this.doc.getArray("blobs");
    return blobs.toJSON();
  }

  serialize() {
    const state = Y.encodeStateAsUpdate(this.doc);
    return state;
  }

  deserialize(state: Uint8Array) {
    Y.applyUpdate(this.doc, state);
  }

  stepBack() {
    this.undoManager.undo();
  }

  stepForward() {
    this.undoManager.redo();
  }

  /** modifies a node */
  mutateNode(nodeData: any, mutation: (data: any) => any) {
    const nodeArray = this.doc.getArray("nodes").toArray();
    const node = nodeArray.find(
      (n: Y.Map<any>) => n.get("id") === nodeData.id,
    ) as Y.Map<any>;

    if (!node) throw new Error("Node not found");

    const data = mutation(nodeData);

    if (data.element) node.set("element", data.element);
    if (data.position) node.set("position", data.position);
    if (data.size) node.set("size", data.size);
    if (data.scale) node.set("scale", data.scale);
  }

  deleteNode(node) {
    const nodes = this.doc.getArray("nodes");
    nodes.delete(this.nodes.indexOf(node), 1);
  }

  createLine() {
    const lines = this.doc.getArray("lines");
    const line = new Y.Array();
    lines.insert(lines.length, [line]);

    return line;
  }

  createNode(dataUrlOrText: string) {
    const nodes = this.doc.getArray("nodes");
    const blobs = this.doc.getArray("blobs");

    const blobIndex = blobs.length;

    const node = new Y.Map([
      ["id", crypto.randomUUID()],
      ["element", blobIndex],
      ["position", [0, 0]],
      ["size", [0, 0]],
      ["scale", 1],
    ]);

    if (dataUrlOrText.match("http")) {
      const blob = {
        data: dataUrlOrText,
        type: "image/jpg",
      };
      blobs.insert(blobIndex, [blob]);
    } else if (dataUrlOrText.startsWith("data:")) {
      const blob = {
        data: dataUrlOrText,
        type: "image/jpg",
      };
      blobs.insert(blobIndex, [blob]);
    } else {
      // just text
      const blob = {
        data: dataUrlOrText,
        type: "text/plain",
      };
      // node.properties = {
      //   "font-family": "Roboto",
      //   "font-size": "69px",
      //   color: "#eee",
      // };

      blobs.insert(blobIndex, [blob]);
    }

    nodes.insert(nodes.length, [node]);

    return node;
  }

  getNode(nodeData: any) {
    const nodeArray = this.doc.getArray("nodes").toArray();
    const node = nodeArray.find(
      (n: Y.Map<any>) => n.get("id") === nodeData.id,
    ) as Y.Map<any>;
    return node.toJSON();
  }

  getNodeBlob(node) {
    return this.blobs[node.element];
  }

  getNodeBounds(nodes) {
    const globalMinMaxX = [Infinity, -Infinity];
    const globalMinMaxY = [Infinity, -Infinity];

    for (const node of nodes) {
      globalMinMaxX[0] = Math.min(globalMinMaxX[0], node.position[0]);
      globalMinMaxY[0] = Math.min(globalMinMaxY[0], node.position[1]);

      globalMinMaxX[1] = Math.max(globalMinMaxX[1], node.position[0] + node.size[0]);
      globalMinMaxY[1] = Math.max(globalMinMaxY[1], node.position[1] + node.size[1]);
    }

    return {
      minX: globalMinMaxX[0],
      maxX: globalMinMaxX[1],
      minY: globalMinMaxY[0],
      maxY: globalMinMaxY[1],
      width: globalMinMaxX[1] - globalMinMaxX[0],
      height: globalMinMaxY[1] - globalMinMaxY[0],
      originX: (globalMinMaxX[1] + globalMinMaxX[0]) / 2,
      originY: (globalMinMaxY[1] + globalMinMaxY[0]) / 2,
    };
  }
}

export class CanvasRenderer {
  colors = {
    line_color: "#eee",
    grid_1: "#171717",
    grid_2: "#101010",
  };

  images = new Map<string, Image>();

  getImage(canvas, node) {
    const blob = canvas.getNodeBlob(node);
    const blobKey = blob.data;
    if (this.images.has(blobKey)) {
      return this.images.get(blobKey);
    } else {
      const img = new Image();

      img.onload = () => {
        if (node.size[0] === 0) {
          canvas.mutateNode(node, (data) => {
            return {
              ...data,
              size: [img.width, img.height],
            };
          });
        }
      };
      img.onerror = (e) => {
        console.error(e);
      };

      donwloadToDataUri(blobKey).then((uri) => {
        img.src = uri;
      });

      this.images.set(blobKey, img);
      return img;
    }
  }

  render(ctxt, canvasInstance) {
    // draw image nodes
    for (const node of canvasInstance.nodes) {
      const blob = canvasInstance.getNodeBlob(node);

      if (!blob) continue;

      if (blob.type === "text/plain") {
        // draw text nodes
        this.drawText(ctxt, blob.data, node);
      } else {
        const image = this.getImage(canvasInstance, node);
        ctxt.drawImage(
          image,
          0,
          0,
          image.width,
          image.height,
          node.position[0] - 1,
          node.position[1] - 1,
          node.size[0] + 2,
          node.size[1] + 2,
        );
      }
    }

    // draw pen lines
    ctxt.strokeStyle = this.colors.line_color;
    ctxt.lineWidth = 2 / canvasInstance.canvas.scale;
    ctxt.beginPath();
    for (const line of canvasInstance.lines) {
      for (let i = 0; i < line.length; i++) {
        if (i === 0) {
          ctxt.moveTo(line[i][0], line[i][1]);
        } else {
          ctxt.lineTo(line[i][0], line[i][1]);
        }
      }
    }
    ctxt.stroke();
  }

  drawText(ctxt, text, node, snapshot = false, canvasInstance, scaler) {
    const buffer = text.split("\n");
    const properties = node.properties || {
      "font-family": "Roboto",
      "font-size": "69px",
      color: "grey",
    };

    const BORDER_PADDING = [15, 15];
    const FONT_SIZE = +properties["font-size"].replace("px", "");
    const CHAR_HEIGHT = 1 * FONT_SIZE;
    const LINE_PADDING = 3;
    const LINE_WRAPPING = true;
    const CHAR_WIDTH = 40;

    const max_line_px_length =
      node.size[0] / (FONT_SIZE * 0.0125) - BORDER_PADDING[0] * 2;

    let x = node.position[0] + BORDER_PADDING[0];
    let y = node.position[1] + BORDER_PADDING[1];

    if (snapshot) {
      const bounds = canvasInstance.getNodeBounds(canvasInstance.nodes);
      x = (node.position[0] - bounds.minX - 1) / scaler;
      y = (node.position[1] - bounds.minY - 1) / scaler;
    }

    const initY = y;

    ctxt.fillStyle = properties.color;
    ctxt.font = `${properties["font-size"]} ${properties["font-family"]}`;
    ctxt.textAlign = "left";
    ctxt.textBaseline = "top";

    const drawLine = (line) => {
      if (y - initY + CHAR_HEIGHT + LINE_PADDING < node.size[1]) {
        ctxt.fillText(line, x, y);
        y += CHAR_HEIGHT + LINE_PADDING;
      }
    };

    for (const line of buffer) {
      const text = ctxt.measureText(line);
      if (text.width + BORDER_PADDING[0] * 2 > node.size[0] && LINE_WRAPPING) {
        const parts = sliceLine(line, max_line_px_length / CHAR_WIDTH);
        for (const part of parts) {
          drawLine(part);
        }
      } else {
        drawLine(line);
      }
    }
  }

  renderSnapshot(canvasInstance) {
    const MAX_SNAPSHOT_SIZE = 5000;

    const canvas = document.createElement("canvas");
    const ctxt = canvas.getContext("2d");

    const bounds = canvasInstance.getNodeBounds(canvasInstance.nodes);
    canvas.width = bounds.width;
    canvas.height = bounds.height;

    const ar = bounds.width / bounds.height;

    let scaler = bounds.width / MAX_SNAPSHOT_SIZE;
    if (scaler > 1) {
      canvas.width = MAX_SNAPSHOT_SIZE;
      canvas.height = MAX_SNAPSHOT_SIZE / ar;
    } else {
      scaler = 1;
    }

    ctxt.lineWidth = 1 / canvasInstance.canvas.scale;

    for (const node of canvasInstance.nodes) {
      const element = canvasInstance.getNodeBlob(node);
      if (element.image && element.image.width > 0) {
        ctxt.drawImage(
          element.image,
          0,
          0,
          element.image.width,
          element.image.height,
          (node.position[0] - bounds.minX - 1) / scaler,
          (node.position[1] - bounds.minY - 1) / scaler,
          (node.size[0] + 2) / scaler,
          (node.size[1] + 2) / scaler,
        );
      } else if (element.type === "text/plain") {
        // draw text nodes
        this.drawText(ctxt, element.data, node, true, canvasInstance, scaler);
      }
    }

    // draw lines
    ctxt.strokeStyle = this.colors.line_color;
    ctxt.lineWidth = 2 * scaler;
    ctxt.beginPath();
    for (const line of canvasInstance.lines) {
      for (let i = 0; i < line.length; i++) {
        const x = (line[i][0] - bounds.minX - 1) / scaler;
        const y = (line[i][1] - bounds.minY - 1) / scaler;
        if (i === 0) {
          ctxt.moveTo(x, y);
        } else {
          ctxt.lineTo(x, y);
        }
      }
    }
    ctxt.stroke();

    return canvas;
  }
}

function sliceLine(line, maxLength) {
  const parts = [];

  line = line.split("");

  while (line.length > maxLength) {
    const temp = line.splice(0, maxLength);
    parts.push(temp.join(""));
  }
  parts.push(line.join(""));

  return parts;
}
