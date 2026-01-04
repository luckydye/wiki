#!/usr/bin/env bun

import { ApiClient } from "../app/src/api/ApiClient.ts";

const HOST = process.env.WIKI_HOST;

if (!HOST) {
  throw new Error("WIKI_HOST environment variable is not set");
}

const api = new ApiClient({
  baseUrl: HOST,
  accessToken: process.env.WIKI_ACCESS_TOKEN,
});

const spaceId = process.env.WIKI_SPACEID;
if (!spaceId) {
  throw new Error("WIKI_SPACEID environment variable is not set");
}

const args = process.argv.slice(2);

const commands: Record<string, {
  description: string;
  execute: (args: string[]) => Promise<void>;
}> = {
  cat: {
    description: "Print document content to stdout",
    execute: async ([docId]) => {
      if (!docId) {
        throw new Error("Document ID is required");
      }
      const doc = await api.document.get(spaceId, docId);
      process.stdout.write(doc.content);
    }
  }
};

const command = commands[args[0] || ''];

if (command) {
  command.execute(args.slice(1));
} else {
  console.log(`Command not found "${args[0]}"`);
  console.log("Available commands:");
  for (const [name, cmd] of Object.entries(commands)) {
    console.log(`  ${name}: ${cmd.description}`);
  }
}
