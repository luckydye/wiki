import type { APIRoute } from "astro";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, extname, basename, dirname, relative } from "node:path";
import { randomBytes } from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  badRequestResponse,
  jsonResponse,
  requireParam,
  requireUser,
  verifySpaceRole,
} from "../../../../../db/api.ts";
import { createDocument } from "../../../../../db/documents.ts";
import { getSpaceDb } from "../../../../../db/db.ts";
import { document } from "../../../../../db/schema/space.ts";
import { stripScriptTags } from "~/src/utils/utils.ts";

const execAsync = promisify(exec);

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB
const TEMP_DIR = join(process.cwd(), "data", "temp");

interface ImportResult {
  totalFiles: number;
  imported: number;
  skipped: number;
  failed: number;
  documents: Array<{ slug: string; title: string; id: string }>;
  errors: Array<{ file: string; error: string }>;
}

interface ParsedDocument {
  title: string;
  content: string;
  slug: string;
  metadata: Record<string, string>;
  relativePath: string;
  directoryPath: string;
  createdAt?: Date;
  updatedAt?: Date;
}

async function ensureTempDir(): Promise<void> {
  await mkdir(TEMP_DIR, { recursive: true });
}

async function extractZipFile(zipPath: string, extractDir: string): Promise<void> {
  await mkdir(extractDir, { recursive: true });
  await execAsync(`unzip -o -q "${zipPath}" -d "${extractDir}"`);
}

function generateSlug(title: string, existingSlugs: Set<string>): string {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);

  if (!baseSlug) {
    baseSlug = "document";
  }

  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  existingSlugs.add(slug);
  return slug;
}

async function parseMarkdownFile(filePath: string, relativePath: string): Promise<ParsedDocument | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const metadata: Record<string, string> = {};
    let contentStart = 0;
    let title = basename(filePath, extname(filePath));
    let slug = basename(filePath, extname(filePath));
    let skipFirstH1 = false;
    let createdAt: Date | undefined;
    let updatedAt: Date | undefined;

    if (lines[0] === "---") {
      let i = 1;
      while (i < lines.length && lines[i] !== "---") {
        const line = lines[i].trim();
        if (line) {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, "");
            metadata[key] = value;
            if (key === "title") {
              title = value;
            }
            // Extract creation date from frontmatter
            if (key === "created" || key === "createdAt") {
              const parsedDate = new Date(value);
              if (!isNaN(parsedDate.getTime())) {
                createdAt = parsedDate;
              }
            }
            // Extract updated date from frontmatter
            if (key === "updated" || key === "updatedAt" || key === "modified" || key === "lastModified") {
              const parsedDate = new Date(value);
              if (!isNaN(parsedDate.getTime())) {
                updatedAt = parsedDate;
              }
            }
          }
        }
        i++;
      }
      contentStart = i + 1;
    }

    // Check for first H1 in content
    const firstHeadingIndex = lines.findIndex((line, idx) => idx >= contentStart && line.startsWith("# "));

    // If no title in frontmatter, use first H1 as title
    if (!metadata.title && firstHeadingIndex !== -1) {
      title = lines[firstHeadingIndex].replace(/^#\s+/, "");
    }

    // Always remove first H1 from content (if it exists)
    let markdownContent: string;
    if (firstHeadingIndex !== -1) {
      const contentLines = [...lines.slice(contentStart, firstHeadingIndex), ...lines.slice(firstHeadingIndex + 1)];
      markdownContent = contentLines.join("\n").trim();
    } else {
      markdownContent = lines.slice(contentStart).join("\n").trim();
    }

    // Convert markdown to HTML
    const { marked } = await import("marked");
    const htmlContent = await marked(markdownContent);

    return {
      title,
      content: htmlContent,
      slug,
      metadata,
      relativePath,
      directoryPath: dirname(relativePath),
      createdAt,
      updatedAt,
    };
  } catch (error) {
    console.error(`Failed to parse markdown file ${filePath}:`, error);
    return null;
  }
}

async function parseTextFile(filePath: string, relativePath: string): Promise<ParsedDocument | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const title = basename(filePath, extname(filePath));

    // Convert text to HTML wrapped in code block
    const { marked } = await import("marked");
    const markdown = `# ${title}\n\n\`\`\`\n${content}\n\`\`\``;
    const htmlContent = await marked(markdown);

    return {
      title,
      content: htmlContent,
      slug: "",
      metadata: { type: "text" },
      relativePath,
      directoryPath: dirname(relativePath),
    };
  } catch (error) {
    console.error(`Failed to parse text file ${filePath}:`, error);
    return null;
  }
}

async function parseHtmlFile(filePath: string, relativePath: string): Promise<ParsedDocument | null> {
  try {
    const html = await readFile(filePath, "utf-8");

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch?.[1] || h1Match?.[1] || basename(filePath, extname(filePath));

    // Strip script tags for security
    const sanitizedHtml = stripScriptTags(html);

    return {
      title,
      content: sanitizedHtml,
      slug: "",
      metadata: { type: "html", originalFormat: "html" },
      relativePath,
      directoryPath: dirname(relativePath),
    };
  } catch (error) {
    console.error(`Failed to parse HTML file ${filePath}:`, error);
    return null;
  }
}

async function parseJsonFile(filePath: string, relativePath: string): Promise<ParsedDocument | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    const title = basename(filePath, extname(filePath));
    const jsonContent = JSON.stringify(data, null, 2);

    // Convert JSON markdown to HTML
    const { marked } = await import("marked");
    const markdown = `# ${title}\n\n\`\`\`json\n${jsonContent}\n\`\`\``;
    const htmlContent = await marked(markdown);

    return {
      title,
      content: htmlContent,
      slug: "",
      metadata: { type: "json" },
      relativePath,
      directoryPath: dirname(relativePath),
    };
  } catch (error) {
    console.error(`Failed to parse JSON file ${filePath}:`, error);
    return null;
  }
}

async function parsePandocFile(filePath: string, relativePath: string, fileType: string): Promise<ParsedDocument | null> {
  try {
    const title = basename(filePath, extname(filePath));

    // Extract media to a temporary directory adjacent to the file
    const mediaDir = join(dirname(filePath), `${basename(filePath, extname(filePath))}_media`);
    await mkdir(mediaDir, { recursive: true });

    const { stdout, stderr } = await execAsync(
      `pandoc --to commonmark --extract-media="${mediaDir}" "${filePath}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    if (stderr?.trim()) {
      console.warn(`Pandoc warning for ${filePath}:`, stderr);
    }

    const markdown = stdout.trim();

    // Clean up media directory if empty
    try {
      const mediaFiles = await readdir(mediaDir);
      if (mediaFiles.length === 0) {
        await rm(mediaDir, { recursive: true });
      }
    } catch {
      // Media dir doesn't exist or couldn't be read, no worries
    }

    // Convert pandoc markdown output to HTML
    const { marked } = await import("marked");
    const htmlContent = await marked(markdown);

    return {
      title,
      content: htmlContent,
      slug: "",
      metadata: { type: fileType, originalFormat: fileType },
      relativePath,
      directoryPath: dirname(relativePath),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("pandoc") && errorMessage.includes("not found")) {
      console.error(`Pandoc is not installed. Install it with: sudo apt-get install pandoc`);
      throw new Error(`Pandoc is required to import ${fileType.toUpperCase()} files but is not installed`);
    }
    console.error(`Failed to parse ${fileType.toUpperCase()} file ${filePath}:`, error);
    return null;
  }
}

async function parseFile(filePath: string, relativePath: string): Promise<ParsedDocument | null> {
  const ext = extname(filePath).toLowerCase();

  switch (ext) {
    case ".md":
    case ".markdown":
      return parseMarkdownFile(filePath, relativePath);
    case ".html":
    case ".htm":
      return parseHtmlFile(filePath, relativePath);
    case ".json":
      return parseJsonFile(filePath, relativePath);
    case ".txt":
    case ".log":
      return parseTextFile(filePath, relativePath);
    case ".odt":
      return parsePandocFile(filePath, relativePath, "odt");
    case ".docx":
      return parsePandocFile(filePath, relativePath, "docx");
    case ".rst":
      return parsePandocFile(filePath, relativePath, "rst");
    case ".org":
      return parsePandocFile(filePath, relativePath, "org");
    case ".epub":
      return parsePandocFile(filePath, relativePath, "epub");
    case ".docbook":
      return parsePandocFile(filePath, relativePath, "docbook");
    default:
      return null;
  }
}

async function scanDirectory(dirPath: string, baseDir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await scanDirectory(fullPath, baseDir);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function createDocumentsRecursively(
  spaceId: string,
  userId: string,
  parsedDocs: ParsedDocument[],
  existingSlugs: Set<string>,
  baseDir: string,
): Promise<{
  imported: number;
  failed: number;
  documents: Array<{ slug: string; title: string; id: string }>;
  errors: Array<{ file: string; error: string }>;
}> {
  const result = {
    imported: 0,
    failed: 0,
    documents: [] as Array<{ slug: string; title: string; id: string }>,
    errors: [] as Array<{ file: string; error: string }>,
  };

  const documentIdMap = new Map<string, string>();
  const dirDocumentMap = new Map<string, string>();

  // Create a map of directory paths to their index.md documents
  const dirIndexMap = new Map<string, ParsedDocument>();
  for (const doc of parsedDocs) {
    const fileName = basename(doc.relativePath);
    if (fileName === 'index.md') {
      dirIndexMap.set(doc.directoryPath, doc);
    }
  }

  const sortedDocs = parsedDocs.sort((a, b) => {
    const aDepth = a.directoryPath.split("/").filter(Boolean).length;
    const bDepth = b.directoryPath.split("/").filter(Boolean).length;
    return aDepth - bDepth;
  });

  for (const parsed of sortedDocs) {
    try {
      const normalizedDir = parsed.directoryPath.replace(/\\/g, "/");
      const dirParts = normalizedDir.split("/").filter(part => part && part !== ".");

      if (baseDir) {
        const baseDirName = basename(baseDir);
        if (dirParts[0] === baseDirName) {
          dirParts.shift();
        }
      }

      let parentId: string | null = null;

      // Create all parent directory documents if they don't exist
      for (let i = 0; i < dirParts.length; i++) {
        const currentDirPath = dirParts.slice(0, i + 1).join("/");
        const currentDirName = dirParts[i];

        if (!dirDocumentMap.has(currentDirPath)) {
          // Get parent document ID (from the previous directory level)
          const parentDirPath = i > 0 ? dirParts.slice(0, i).join("/") : null;
          const parentDirId = parentDirPath ? dirDocumentMap.get(parentDirPath) || null : null;

          // Check if this directory has an index.md file
          const indexDoc = dirIndexMap.get(currentDirPath);

          let dirSlug: string;
          let dirHtml: string;
          let dirTitle: string;
          let dirProperties: Record<string, any>;

          if (indexDoc) {
            // Use index.md content for this directory
            dirSlug = generateSlug(indexDoc.slug || currentDirName, existingSlugs);
            dirHtml = indexDoc.content;
            dirTitle = indexDoc.title;
            dirProperties = { ...indexDoc.metadata, type: "directory" };
          } else {
            // Create default directory page
            dirSlug = generateSlug(currentDirName, existingSlugs);
            const { marked } = await import("marked");
            const dirMarkdown = `# ${currentDirName}\n\nThis page represents the ${currentDirName} directory.`;
            dirHtml = await marked(dirMarkdown);
            dirTitle = currentDirName;
            dirProperties = { title: currentDirName, type: "directory" };
          }

          const dirDoc = await createDocument(
            spaceId,
            userId,
            dirSlug,
            dirHtml,
            dirProperties,
            parentDirId,
            undefined,
            indexDoc?.createdAt,
            indexDoc?.updatedAt,
          );

          dirDocumentMap.set(currentDirPath, dirDoc.id);
          result.imported++;
          result.documents.push({
            slug: dirDoc.slug,
            title: dirTitle,
            id: dirDoc.id,
          });
        }
      }

      // Set parent to the deepest directory
      if (dirParts.length > 0) {
        const fullDirPath = dirParts.join("/");
        parentId = dirDocumentMap.get(fullDirPath) || null;
      }

      // Skip index.md files as they've already been used for directory documents
      const fileName = basename(parsed.relativePath);
      if (fileName === 'index.md') {
        continue;
      }

      // Use the slug from parsing (filename-based) or generate from title as fallback
      parsed.slug = generateSlug(parsed.slug || parsed.title, existingSlugs);

      const properties = {
        title: parsed.title,
        ...parsed.metadata,
      };

      const doc = await createDocument(
        spaceId,
        userId,
        parsed.slug,
        parsed.content,
        properties,
        parentId,
        undefined,
        parsed.createdAt,
        parsed.updatedAt,
      );

      documentIdMap.set(parsed.relativePath, doc.id);
      result.imported++;
      result.documents.push({
        slug: doc.slug,
        title: parsed.title,
        id: doc.id,
      });
    } catch (error) {
      result.failed++;
      result.errors.push({
        file: parsed.relativePath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return result;
}

export const POST: APIRoute = async (context) => {
  let tempDir: string | null = null;

  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    await verifySpaceRole(spaceId, user.id, "editor");

    const formData = await context.request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw badRequestResponse("No file provided");
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      throw badRequestResponse(
        `File size exceeds maximum allowed size of ${MAX_UPLOAD_SIZE / 1024 / 1024}MB`,
      );
    }

    await ensureTempDir();
    tempDir = join(TEMP_DIR, `import-${randomBytes(16).toString("hex")}`);
    await mkdir(tempDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempFilePath = join(tempDir, file.name);
    await writeFile(tempFilePath, buffer);

    const result: ImportResult = {
      totalFiles: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      documents: [],
      errors: [],
    };

    // Get all document slugs in the space to avoid collisions
    const db = getSpaceDb(spaceId);
    const allDocs = await db.select({ slug: document.slug }).from(document).all();
    const existingSlugs = new Set(allDocs.map((d) => d.slug));

    let filesToProcess: string[] = [];
    const ext = extname(file.name).toLowerCase();

    if (ext === ".zip") {
      const extractDir = join(tempDir, "extracted");
      await extractZipFile(tempFilePath, extractDir);
      filesToProcess = await scanDirectory(extractDir, extractDir);
    } else {
      filesToProcess = [tempFilePath];
    }

    result.totalFiles = filesToProcess.length;

    const parsedDocs: ParsedDocument[] = [];
    const baseDir = ext === ".zip" ? join(tempDir, "extracted") : tempDir;

    for (const filePath of filesToProcess) {
      try {
        const relativePath = relative(baseDir, filePath);
        const parsed = await parseFile(filePath, relativePath);

        if (!parsed) {
          result.skipped++;
          continue;
        }

        parsedDocs.push(parsed);
      } catch (error) {
        result.failed++;
        result.errors.push({
          file: relative(tempDir, filePath),
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const recursiveResult = await createDocumentsRecursively(
      spaceId,
      user.id,
      parsedDocs,
      existingSlugs,
      baseDir,
    );

    result.imported += recursiveResult.imported;
    result.failed += recursiveResult.failed;
    result.documents.push(...recursiveResult.documents);
    result.errors.push(...recursiveResult.errors);

    return jsonResponse(result, 200);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Import error:", error);
    return jsonResponse({ error: "Failed to import files" }, 500);
  } finally {
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Failed to cleanup temp directory:", cleanupError);
      }
    }
  }
};
