#!/usr/bin/env bun

/**
 * Extension CLI
 *
 * Manage wiki extension packages.
 *
 * Usage:
 *   bun ./cli.ts create <extension-id>
 *   bun ./cli.ts package <extension-id>
 *
 * Commands:
 *   create <id>   Scaffold a new extension package
 *   package <id>  Build and create zip for an existing extension
 *
 * Examples:
 *   bun ./cli.ts create my-cool-extension
 *   bun ./cli.ts package my-cool-extension
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { deflateRawSync } from "node:zlib";

const EXTENSIONS_DIR = "./extensions";

// --- Zip creation utilities ---

interface ZipEntry {
  name: string;
  data: Buffer;
}

function createZipBuffer(entries: ZipEntry[]): Buffer {
  const chunks: Buffer[] = [];
  const centralDirectory: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf-8");
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);

    // Local file header
    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4); // Version needed to extract
    localHeader.writeUInt16LE(0, 6); // General purpose bit flag
    localHeader.writeUInt16LE(8, 8); // Compression method (deflate)
    localHeader.writeUInt16LE(0, 10); // Last mod file time
    localHeader.writeUInt16LE(0, 12); // Last mod file date
    localHeader.writeUInt32LE(crc, 14); // CRC-32
    localHeader.writeUInt32LE(compressed.length, 18); // Compressed size
    localHeader.writeUInt32LE(entry.data.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26); // File name length
    localHeader.writeUInt16LE(0, 28); // Extra field length
    nameBuffer.copy(localHeader, 30);

    chunks.push(localHeader, compressed);

    // Central directory header
    const centralHeader = Buffer.alloc(46 + nameBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed to extract
    centralHeader.writeUInt16LE(0, 8); // General purpose bit flag
    centralHeader.writeUInt16LE(8, 10); // Compression method
    centralHeader.writeUInt16LE(0, 12); // Last mod file time
    centralHeader.writeUInt16LE(0, 14); // Last mod file date
    centralHeader.writeUInt32LE(crc, 16); // CRC-32
    centralHeader.writeUInt32LE(compressed.length, 20); // Compressed size
    centralHeader.writeUInt32LE(entry.data.length, 24); // Uncompressed size
    centralHeader.writeUInt16LE(nameBuffer.length, 28); // File name length
    centralHeader.writeUInt16LE(0, 30); // Extra field length
    centralHeader.writeUInt16LE(0, 32); // File comment length
    centralHeader.writeUInt16LE(0, 34); // Disk number start
    centralHeader.writeUInt16LE(0, 36); // Internal file attributes
    centralHeader.writeUInt32LE(0, 38); // External file attributes
    centralHeader.writeUInt32LE(offset, 42); // Relative offset of local header
    nameBuffer.copy(centralHeader, 46);

    centralDirectory.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirBuffer = Buffer.concat(centralDirectory);
  const centralDirOffset = offset;

  // End of central directory record
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0); // End of central dir signature
  endRecord.writeUInt16LE(0, 4); // Number of this disk
  endRecord.writeUInt16LE(0, 6); // Disk where central directory starts
  endRecord.writeUInt16LE(entries.length, 8); // Number of central directory records on this disk
  endRecord.writeUInt16LE(entries.length, 10); // Total number of central directory records
  endRecord.writeUInt32LE(centralDirBuffer.length, 12); // Size of central directory
  endRecord.writeUInt32LE(centralDirOffset, 16); // Offset of start of central directory
  endRecord.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...chunks, centralDirBuffer, endRecord]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function kebabToTitle(kebab: string): string {
  return kebab
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function validateExtensionId(id: string): void {
  if (!/^[a-z0-9-]+$/.test(id)) {
    console.error("Error: Extension ID must be lowercase alphanumeric with hyphens only");
    console.error("Example: my-cool-extension");
    process.exit(1);
  }

  if (id.startsWith("-") || id.endsWith("-")) {
    console.error("Error: Extension ID cannot start or end with a hyphen");
    process.exit(1);
  }
}

function printUsage(): void {
  console.log(`
Usage:
  bun ./cli.ts <command> [extension-id]

Commands:
  create <id>   Scaffold a new extension package
  package [id]  Build and create zip for an existing extension
                (uses current directory if no id provided)

Examples:
  bun ./cli.ts create my-cool-extension
  bun ./cli.ts package my-cool-extension
  cd extensions/my-cool-extension && bun ../../cli.ts package
`);
}

// Resolves the extension ID and directory path.
// If no ID provided, attempts to use the current working directory.
function resolveExtension(extensionId: string | undefined): { id: string; dir: string } {
  if (extensionId) {
    validateExtensionId(extensionId);
    return { id: extensionId, dir: join(EXTENSIONS_DIR, extensionId) };
  }

  // No ID provided - check if cwd is an extension directory
  const cwd = process.cwd();
  const manifestPath = join(cwd, "manifest.json");

  if (!existsSync(manifestPath)) {
    throw new Error(
      "No extension ID provided and current directory doesn't contain a manifest.json",
    );
  }

  const id = basename(cwd);
  validateExtensionId(id);
  return { id, dir: cwd };
}

// --- File generators for create command ---

function createManifest(id: string, name: string): string {
  return JSON.stringify(
    {
      id,
      name,
      version: "1.0.0",
      description: `${name} extension for Wiki`,
      entries: {
        frontend: "dist/main.js",
        view: "dist/view.js",
      },
      routes: [
        {
          path: id,
          title: name,
          menuItem: {
            title: name,
          },
        },
        {
          path: `${id}-stats`,
          title: `${name} Stats`,
          description: "Statistics from your extension",
          placements: ["home-top"],
        },
      ],
    },
    null,
    2,
  );
}

function createMainTs(id: string, name: string): string {
  return `/**
 * ${name} Extension - Frontend Entry
 *
 * Entry point for actions, suggestions, and command palette contributions.
 * This file is loaded on every page when the extension is activated.
 */

import type { ExtensionContext } from "../../../app/src/utils/extensions.ts";

/**
 * Called when the extension is activated.
 * Register your actions and suggestions here.
 *
 * Available on ctx:
 *   - ctx.extensionId: string - The extension's ID
 *   - ctx.spaceId: string - The current space ID
 *   - ctx.api: ApiClient - The wiki API client
 *   - ctx.actions: { register, unregister } - Action registration
 *   - ctx.suggestions: { register, unregister } - Editor suggestion registration
 *   - ctx.getActiveEditor: () => Editor | null - Get the active Tiptap editor
 */
export function activate(ctx: ExtensionContext): void {
  // Register an example action that uses the API
  ctx.actions.register("hello", {
    title: "${name}: Say G'day",
    description: "A friendly greeting from ${name}",
    group: "extensions",
    run: async () => {
      // Example: fetch documents using the API client
      const docs = await ctx.api.documents.get(ctx.spaceId);
      alert(\`G'day from ${name}! You have \${docs.length} documents.\`);
    },
  });

  // Register custom editor suggestions (triggered by typing "!")
  ctx.suggestions.register("commands", {
    char: "!",
    items: async (query) => {
      // Filter items based on query
      const allItems = [
        { id: "hello", label: "Hello", description: "Insert a greeting" },
        { id: "date", label: "Date", description: "Insert current date" },
      ];
      return allItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      );
    },
    onSelect: (item, editor) => {
      // Insert content when a suggestion is selected
      if (item.id === "hello") {
        editor.chain().focus().insertContent("G'day mate! ").run();
      } else if (item.id === "date") {
        editor.chain().focus().insertContent(new Date().toLocaleDateString()).run();
      }
    },
  });

  console.log("${name} extension activated");
}

/**
 * Called when the extension is deactivated.
 * Clean up any resources here. Actions and suggestions registered via ctx
 * are automatically cleaned up, but you may have other cleanup to do.
 */
export function deactivate(ctx: ExtensionContext): void {
  console.log("${name} extension deactivated");
}
`;
}

function createViewTs(id: string, name: string): string {
  return `/**
 * ${name} Extension - View Entry
 *
 * Entry point for custom views/pages.
 * This file is loaded only when navigating to extension routes.
 */

import type { ExtensionContext } from "../../../app/src/utils/extensions.ts";

/**
 * Called when the view module is loaded.
 * Register your view renderers here.
 *
 * Available on ctx:
 *   - ctx.extensionId: string - The extension's ID
 *   - ctx.spaceId: string - The current space ID
 *   - ctx.route: string | null - Current route path if rendering a view
 *   - ctx.api: ApiClient - The wiki API client
 *   - ctx.views: { register, unregister } - View registration
 *
 * Views can be placed on:
 *   - Custom pages (default) - accessible via /:spaceSlug/x/:path
 *   - Home page - use placements: ["home-top"], ["home-bottom"], or ["home-sidebar"] in manifest
 */
export function activate(ctx: ExtensionContext): void {
  // Register a view for the "${id}" route
  ctx.views.register("${id}", async (container) => {
    // Fetch some data
    const docs = await ctx.api.documents.get(ctx.spaceId);

    // Render the view
    container.innerHTML = \`
      <div class="p-6">
        <h1 class="text-3xl font-bold mb-4">${name}</h1>
        <p class="text-neutral-600 mb-6">G'day! This is your custom extension view.</p>

        <div class="bg-background border border-neutral-200 rounded-lg p-4">
          <h2 class="text-lg font-semibold mb-2">Space Stats</h2>
          <p class="text-2xl font-bold text-primary-600">\${docs.length}</p>
          <p class="text-sm text-neutral-500">documents in this space</p>
        </div>
      </div>
    \`;

    // Return a cleanup function (optional)
    return () => {
      console.log("${name} view unmounted");
    };
  });

  // Register a view that appears on the space home page
  // This is placed at "home-top" as defined in the manifest
  ctx.views.register("${id}-stats", async (container) => {
    // Fetch some data
    const docs = await ctx.api.documents.get(ctx.spaceId);

    // Render the view
    container.innerHTML = \`
      <div class="grid grid-cols-3 gap-4">
        <div class="text-center">
          <p class="text-3xl font-bold text-primary-600">\${docs.length}</p>
          <p class="text-sm text-neutral-600">Documents</p>
        </div>
        <div class="text-center">
          <p class="text-3xl font-bold text-primary-600">\${docs.filter(d => d.type === 'document').length}</p>
          <p class="text-sm text-neutral-600">Pages</p>
        </div>
        <div class="text-center">
          <p class="text-3xl font-bold text-primary-600">\${docs.filter(d => d.type === 'board').length}</p>
          <p class="text-sm text-neutral-600">Boards</p>
        </div>
      </div>
    \`;

    // Return a cleanup function (optional)
    return () => {
      console.log("${name} stats view unmounted");
    };
  });

  console.log("${name} view module activated");
}

/**
 * Called when the view module is deactivated.
 */
export function deactivate(ctx: ExtensionContext): void {
  ctx.views.unregister("${id}");
  console.log("${name} view module deactivated");
}
`;
}

function createPackageJson(id: string): string {
  return JSON.stringify(
    {
      name: `@wiki-ext/${id}`,
      version: "1.0.0",
      type: "module",
      scripts: {
        build: "bun build src/main.ts src/view.ts --outdir dist --format esm --target browser",
      },
    },
    null,
    2,
  );
}

function createReadme(id: string, name: string): string {
  return `# ${name}

A Wiki extension with a custom view.

## Development

\`\`\`bash
# Install dependencies (from repo root)
bun install

# Build and package the extension
task extension:package -- ${id}
\`\`\`

## Installation

1. Package the extension: \`task extension:package -- ${id}\`
2. Go to your Wiki space settings
3. Upload \`extensions/${id}/${id}.zip\` in the Extensions section

## Files

- \`src/main.ts\` - Frontend entry for actions (loaded on every page)
- \`src/view.ts\` - View entry for custom pages (loaded on demand)

## Extension API

The extension context (\`ctx\`) provides:

- \`ctx.extensionId\` - The extension's ID
- \`ctx.spaceId\` - The current space ID
- \`ctx.route\` - Current route path (in view entry)
- \`ctx.api\` - The wiki API client
- \`ctx.actions\` - Action registration (frontend entry)
- \`ctx.views\` - View registration (view entry)

### Actions (src/main.ts)

\`\`\`typescript
// Register an action (appears in command palette)
ctx.actions.register("my-action", {
  title: "My Action",
  description: "Does something cool",
  group: "extensions",
  run: async () => {
    // Your code here
  },
});
\`\`\`

### Suggestions (src/main.ts)

\`\`\`typescript
// Register editor suggestions (triggered by a character like "/" or "!")
ctx.suggestions.register("my-commands", {
  char: "/",
  items: async (query) => [
    { id: "heading", label: "Heading", description: "Insert a heading" },
    { id: "list", label: "Bullet List", description: "Insert a list" },
  ].filter(item => item.label.toLowerCase().includes(query.toLowerCase())),
  onSelect: (item, editor) => {
    if (item.id === "heading") {
      editor.chain().focus().setHeading({ level: 1 }).run();
    }
  },
});
\`\`\`

### Views (src/view.ts)

\`\`\`typescript
// Register a view for a route defined in manifest.json
ctx.views.register("${id}", (container) => {
  container.innerHTML = \`<h1>My View</h1>\`;

  // Optional cleanup function
  return () => console.log("View unmounted");
});
\`\`\`

### API Client

\`\`\`typescript
// Fetch documents
const docs = await ctx.api.documents.get(ctx.spaceId);

// Get a specific document
const doc = await ctx.api.document.get(ctx.spaceId, documentId);

// Search
const results = await ctx.api.search.get(ctx.spaceId, { query: "search term" });
\`\`\`
`;
}

// --- Commands ---

function commandCreate(extensionId: string): void {
  validateExtensionId(extensionId);

  const extensionName = kebabToTitle(extensionId);
  const extensionDir = join(EXTENSIONS_DIR, extensionId);

  if (existsSync(extensionDir)) {
    console.error(`Error: Extension '${extensionId}' already exists at ${extensionDir}`);
    process.exit(1);
  }

  console.log(`Creating extension: ${extensionName} (${extensionId})`);

  // Create directory structure
  mkdirSync(extensionDir, { recursive: true });
  mkdirSync(join(extensionDir, "src"), { recursive: true });

  // Create files
  writeFileSync(join(extensionDir, "manifest.json"), createManifest(extensionId, extensionName));
  writeFileSync(join(extensionDir, "src", "main.ts"), createMainTs(extensionId, extensionName));
  writeFileSync(join(extensionDir, "src", "view.ts"), createViewTs(extensionId, extensionName));
  writeFileSync(join(extensionDir, "package.json"), createPackageJson(extensionId));
  writeFileSync(join(extensionDir, "README.md"), createReadme(extensionId, extensionName));

  console.log(`
Extension created at: ${extensionDir}

Next steps:
  1. Edit src/main.ts for actions, src/view.ts for custom views
  2. task extension:package -- ${extensionId}
  3. Upload the zip in Space Settings > Extensions
  4. Access your view at /:spaceSlug/x/${extensionId}
`);
}

async function commandPackage(extensionId: string | undefined): Promise<void> {
  const { id, dir: extensionDir } = resolveExtension(extensionId);

  if (!existsSync(extensionDir)) {
    console.error(`Error: Extension '${id}' not found at ${extensionDir}`);
    console.error(`Run 'task extension:create -- ${id}' first`);
    process.exit(1);
  }

  const manifestPath = join(extensionDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`Error: manifest.json not found in ${extensionDir}`);
    process.exit(1);
  }

  // Bump patch version
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const [major, minor, patch] = manifest.version.split(".").map(Number);
  manifest.version = `${major}.${minor}.${patch + 1}`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Version bumped to ${manifest.version}`);

  const mainSrcPath = join(extensionDir, "src", "main.ts");
  const viewSrcPath = join(extensionDir, "src", "view.ts");

  const hasMain = existsSync(mainSrcPath);
  const hasView = existsSync(viewSrcPath);

  if (!hasMain && !hasView) {
    console.error(`Error: At least one of src/main.ts or src/view.ts must exist in ${extensionDir}`);
    process.exit(1);
  }

  console.log(`Building extension: ${id}`);

  // Clean dist folder
  const distDir = join(extensionDir, "dist");
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true });
  }

  // Run the build script
  const buildResult = Bun.spawnSync(["bun", "run", "build"], {
    cwd: extensionDir,
    stdio: ["inherit", "inherit", "inherit"],
  });

  if (buildResult.exitCode !== 0) {
    console.error("Build failed");
    process.exit(1);
  }

  console.log("Build complete");

  // Create zip
  const zipPath = join(extensionDir, `${id}.zip`);
  const zipEntries: ZipEntry[] = [
    { name: "manifest.json", data: readFileSync(manifestPath) },
  ];

  if (hasMain) {
    zipEntries.push({ name: "dist/main.js", data: readFileSync(join(distDir, "main.js")) });
  }

  if (hasView) {
    zipEntries.push({ name: "dist/view.js", data: readFileSync(join(distDir, "view.js")) });
  }

  const zipContent = createZipBuffer(zipEntries);

  await Bun.write(zipPath, zipContent);
  console.log(`Package created: ${zipPath}`);
}

// --- Main ---

async function main(): Promise<void> {
  const [command, extensionId] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exit(1);
  }

  switch (command) {
    case "create":
      commandCreate(extensionId);
      break;

    case "package":
      await commandPackage(extensionId);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
