import type { APIRoute } from "astro";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { config } from "../../../../../../config.js";
import {
  badRequestResponse,
  jsonResponse,
  requireParam,
  requireUser,
  verifySpaceRole,
} from "../../../../../../db/api.js";

const ALLOWED_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.ms-excel", // .xls
  "application/msword", // .doc
  "text/markdown", // .md
  "text/plain", // .txt (fallback for .md)
  "text/csv", // .csv
  "application/pdf", // .pdf
  "application/zip", // .zip
  "application/x-zip-compressed", // .zip (alternative)
];

const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp", "svg",
  "docx", "doc", "pdf", "pptx", "ppt",
  "xlsx", "xls", "csv", "zip", "md", "txt",
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for documents

export const POST: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");

    // Verify user has at least editor access to the space
    await verifySpaceRole(spaceId, user.id, "editor");

    // Parse the form data
    const formData = await context.request.formData();
    const file = formData.get("file") as File;
    const documentId = formData.get("documentId") as string | null;

    if (!file) {
      return badRequestResponse("No file provided");
    }

    // Validate file type by extension (more reliable than MIME type)
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const isAllowedExtension = ALLOWED_EXTENSIONS.includes(extension);
    const isAllowedMime = ALLOWED_TYPES.includes(file.type);

    if (!isAllowedExtension && !isAllowedMime) {
      return badRequestResponse(
        `Invalid file type. Allowed extensions: ${ALLOWED_EXTENSIONS.join(", ")}`,
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return badRequestResponse(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const randomName = randomBytes(16).toString("hex");
    const filename = `${randomName}.${fileExtension}`;

    // Build the storage key - includes documentId if provided
    // This structure is S3-compatible: {spaceId}/{documentId}/{filename} or {spaceId}/{filename}
    const key = documentId ? `${documentId}/${filename}` : filename;

    // Create uploads directory (with document subdirectory if applicable)
    const uploadsDir = documentId
      ? join(process.cwd(), "data", "uploads", spaceId, documentId)
      : join(process.cwd(), "data", "uploads", spaceId);
    await mkdir(uploadsDir, { recursive: true });

    // Save file
    const filePath = join(uploadsDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const appConfig = config();

    // Return the URL with the key
    const url = `${appConfig.API_URL}/api/v1/spaces/${spaceId}/uploads/${key}`;

    return jsonResponse({ url, key }, 200);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("File upload error:", error);
    return jsonResponse({ error: "Failed to upload file" }, 500);
  }
};
