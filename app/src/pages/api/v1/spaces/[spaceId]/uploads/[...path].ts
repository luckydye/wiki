import type { APIRoute } from "astro";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  requireParam,
  requireUser,
} from "../../../../../../db/api.js";
import { verifySpaceRole } from "../../../../../../db/api.js";

const MIME_TYPES: Record<string, string> = {
  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  // Documents
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  // Text
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  // Archive
  zip: "application/zip",
};

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const path = requireParam(context.params, "path");

    // Verify user has at least viewer access to the space
    await verifySpaceRole(spaceId, user.id, "viewer");

    // Security: Validate path to prevent directory traversal
    if (path.includes("..")) {
      return new Response("Invalid path", { status: 400 });
    }

    // Get file extension from the path
    const extension = path.split(".").pop()?.toLowerCase();
    if (!extension) {
      return new Response("Missing file extension", { status: 400 });
    }

    const mimeType = MIME_TYPES[extension] || "application/octet-stream";

    // Read file from data/uploads/{spaceId}/{path}
    // Path can be "{filename}" or "{documentId}/{filename}"
    const filePath = join(process.cwd(), "data", "uploads", spaceId, path);

    try {
      const fileBuffer = await readFile(filePath);

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return new Response("File not found", { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("File serve error:", error);
    return new Response("Failed to serve file", { status: 500 });
  }
};