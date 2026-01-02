import { BinaryFile } from "./BinaryFile.ts";

export default class PDFFile extends BinaryFile {
  static get fileEndings() {
    return [".pdf"];
  }

  static read(file) {
    return new Promise(async (resolve, _reject) => {
      const buffer = await file.arrayBuffer();
      resolve(await PDFFile.fromDataArray(buffer, file.name));
    });
  }

  static async fromDataArray(arrayBuffer, filename) {
    const ai = new PDFFile();

    ai.filename = filename;

    const data = BinaryFile.unserialize(new DataView(arrayBuffer), 0, {
      type: "char[8]",
    });

    if (data.data.type === "%PDF-1.5") {
      const acsi = BinaryFile.unserializeASCI(new DataView(arrayBuffer));
      const lines = acsi.split(/[\n|\r]+/g);

      let _lastLine = null;
      let logNext = false;
      let currentLine = null;
      for (const line of lines) {
        currentLine = line;
        if (logNext) {
          logNext = false;
          break;
        }
        if (line === "startxref") {
          logNext = true;
        }
        _lastLine = line;
      }

      const xrefByteOffset = +currentLine;

      const xrefview = new DataView(arrayBuffer, xrefByteOffset);
      const xrefAsci = BinaryFile.unserializeASCI(xrefview);
      const xrefLines = xrefAsci.split(/[\n|\r]+/g);

      const xrefInfo = xrefLines[1].split(" ");
      const _xrefOffset = +xrefInfo[0];
      const xrefLength = +xrefInfo[1];

      const parseXrefLine = (line) => {
        if (line) {
          const parts = line.split(" ");

          return {
            byteOffset: +parts[0],
            generation: +parts[1],
            used: parts[2] === "n",
          };
        }
        return null;
      };

      for (let i = 0; i < xrefLength; i++) {
        const xref = parseXrefLine(xrefLines[i + 2]);
        const nextXref = parseXrefLine(xrefLines[i + 3]);

        if (nextXref) {
          const _index = xref.byteOffset;
          const _dict = PDFFile.readXrefDict(arrayBuffer, xref);
        }
      }
    }

    // read rest from the end to start
    // first the "%%EOF" (end of file) command
    // 2. file size in bytes
    // 3. "startxref" tag
    // ... xref table
    // 4. "xref" end
  }

  static readXrefDict(arrayBuffer, xref) {
    if (xref.used) {
      const { data } = BinaryFile.unserialize(
        new DataView(arrayBuffer),
        xref.byteOffset,
        {
          number: "string",
          idk: "string",
          obj: "char[123]",
        },
      );
      return data;
    }
  }

  async getImage() {
    // return this.thumbnail;
  }
}
