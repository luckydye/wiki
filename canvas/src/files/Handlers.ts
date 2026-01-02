import ImageFile from "./ImageFile.ts";
import CDRFile from "./CDRFile.ts";
import AIFile from "./AIFile.ts";

const types = new Set([ImageFile, CDRFile, AIFile]);

const SUPPORTED_HOSTS = ["www.instagram.com"];

class ImageURL {
  getImageUrl() {
    return this.url;
  }

  constructor(url) {
    this.url = url;
    url = new URL(url);

    if (SUPPORTED_HOSTS.indexOf(url.host) !== -1) {
    }
  }
}

export class DataHandler {
  static enableDragAndDrop(root) {
    let entered = false;

    root.addEventListener("drop", (e) => {
      e.preventDefault();
      DataHandler.handleFiles(e.dataTransfer.files, e);
      DataHandler.handleItems([e.dataTransfer.items[0]]);
    });

    root.addEventListener("dragenter", (_e) => {
      entered = true;
    });

    root.addEventListener("dragover", (e) => {
      if (entered) e.preventDefault();
    });
  }

  static handledTypes() {
    return types;
  }

  static resolveFileType(file) {
    for (const type of types) {
      if (type.fileType && file.type.match(type.fileType)) {
        return type;
      } else {
        for (const fileEnding of type.fileEndings) {
          if (file.name.match(fileEnding)) {
            return type;
          }
        }
      }
    }
    return null;
  }

  static importFiles(files) {
    for (const file of files) {
      DataHandler.handleFiles([file], files);
    }
  }

  static async handleFiles(files) {
    for (const file of files) {
      const FileType = DataHandler.resolveFileType(file);
      if (FileType) {
        const read = await FileType.read(file);
        if (read) {
          const canvas = document.querySelector("canvas-element");
          const uri = await read.getImage();
          const node = canvas.canvas.createNode(uri);
          const element = canvas.canvas.getNodeBlob(node);
          element.originalName = file.name;
          canvas.canvas.mutateNode(node, (data) => ({
            ...data,
            position: [canvas.pointer.canvasX, canvas.pointer.canvasY],
          }));
        }
        // handle all files
        // break;
      } else {
        console.error("File type not handled");
      }
    }
  }

  static handleItems(items) {
    for (const item of items) {
      item.getAsString((url) => {
        DataHandler.handleUrl(url);
      });
    }
  }

  static handleUrl(uri) {
    try {
      const url = new ImageURL(uri);
      const canvas = document.querySelector("canvas-element");
      const node = canvas.canvas.createNode(url.getImageUrl());
      canvas.canvas.mutateNode(node, (data) => ({
        ...data,
        position: [canvas.pointer.canvasX, canvas.pointer.canvasY],
      }));
    } catch (err) {
      console.error(err);
      throw new Error(err);
    }
  }
}
