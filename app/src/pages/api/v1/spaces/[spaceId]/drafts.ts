import type { APIRoute } from "astro";
import {
  jsonResponse,
  requireParam,
  requireUser,
  verifySpaceRole,
} from "../../../../../db/api.ts";
import { listDraftDocuments } from "../../../../../db/documents.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    await verifySpaceRole(spaceId, user.id, "editor");

    const url = new URL(context.request.url);
    const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);
    const offset = Number.parseInt(url.searchParams.get("offset") || "0", 10);

    if (limit < 1 || limit > 1000) {
      throw new Response("Limit must be between 1 and 1000", { status: 400 });
    }

    if (offset < 0) {
      throw new Response("Offset must be non-negative", { status: 400 });
    }

    const { documents, total } = await listDraftDocuments(spaceId, limit, offset);
    return jsonResponse({ documents, total, limit, offset });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
