import "./components/CanvasElement.ts";
import { Canvas } from "./Canvas.ts";
import { FileSystem } from "./Storage.ts";
import { downloadCanvas, resizeCanvas } from "./utils.ts";
import type CanvasElement from "./components/CanvasElement.ts";
import { WebsocketProvider } from "y-websocket";

let canvas: CanvasElement;
let file_ref;

window.openFileRef = async (fileRef) => {
  const string = await (await fileRef.getFile()).text();
  const json = JSON.parse(string);
  const loadedCanvas = new Canvas(json);
  canvas.setCanvas(loadedCanvas);
  file_ref = fileRef;
};

async function openFile() {
  file_ref = await FileSystem.openFileChooser({
    multiple: false,
    types: [
      { description: "Whiteboards", accept: { "application/json": [".whiteboard"] } },
    ],
    suggestedStartLocation: "whtieboards",
  });
  if (!file_ref) return;

  window.openFileRef(file_ref);
}

async function saveCurrentFile() {
  if (file_ref) {
    const write_file_ref = await file_ref.createWritable();
    const save = canvas.canvas.toString();
    await write_file_ref.write(save);
    await write_file_ref.close();

    let preview = canvas.drawPreview();
    preview = resizeCanvas(preview, 480);
    const bitmap = await createImageBitmap(preview);
    FileSystem.saveFilePreview(file_ref.name, bitmap);
  }
}

async function saveFile() {
  if (!canvas.canvas.canvas.title) {
    canvas.canvas.canvas.title = prompt("Title");
  }

  if (file_ref) {
    await saveCurrentFile();
  } else {
    await saveAs();
  }
}

async function saveAs() {
  const dir_ref = await self.showDirectoryPicker();
  if (!dir_ref) {
    return;
  }

  const fileName = canvas.canvas.canvas.title.replace(" ", "-");
  const new_file = await dir_ref.getFileHandle(`${fileName}.whiteboard`, {
    create: true,
  });

  file_ref = new_file;

  const new_file_writer = await new_file.createWritable();
  const save = canvas.canvas.toString();
  await new_file_writer.write(save);
  await new_file_writer.close();
}

window.openFile = openFile;
window.saveFile = saveFile;

window.pasteImage = async () => {
  const data = await navigator.clipboard.read();
  const clipboardItem = data[0];

  const items = [];
  for (const type of clipboardItem.types) {
    const blob = await clipboardItem.getType(type);
    items.push(blob);
  }

  canvas.handleDataItems(items);
};

window.importImage = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.onchange = (_e) => {
    canvas.handleDataItems(input.files);
  };
  input.click();
};

window.saveSnapshot = () => {
  const img = canvas.drawPreview();
  const fileName = canvas.canvas.canvas.title.replace(" ", "-");
  downloadCanvas(img, fileName);
};

window.addEventListener("blur", (_e) => {
  saveCurrentFile();
});

window.newCanvas = async () => {
  if (file_ref || canvas.canvas.nodes.length > 0) {
    if (confirm("Save work?")) {
      await window.saveFile();
    }
  }
  file_ref = null;
  const loadedCanvas = new Canvas();
  canvas.setCanvas(loadedCanvas);
};

window.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });

async function init() {
  FileSystem.connectToDatabase();
  canvas = document.querySelector<CanvasElement>("canvas-element");

  new WebsocketProvider(
    `ws://${window.location.hostname}:1234`,
    "luckydye_2",
    canvas.canvas.doc,
  );
}

window.addEventListener("DOMContentLoaded", init);

window.addEventListener("keydown", async (e) => {
  if (e.key === "Backspace") {
    canvas.deleteSelection();
  }
  if (e.metaKey && e.key === "z") {
    e.preventDefault();
    if (e.shiftKey) {
      canvas.redo();
    } else {
      canvas.undo();
    }
  }
});
