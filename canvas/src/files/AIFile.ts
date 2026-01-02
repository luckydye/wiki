import PDFFile from "./PDFFile.ts";

export default class AIFile extends PDFFile {
  static get fileEndings() {
    return [".ai"];
  }
}
