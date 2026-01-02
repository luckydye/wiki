import type { APIRoute } from "astro";
import {
    authenticateRequest,
  badRequestResponse,
  createdResponse,
  jsonResponse,
  requireParam,
  requireUser,
  verifyDocumentRole,
  verifySpaceRole,
  verifyTokenPermission,
} from "../../../../../../db/api.ts";
import {
  createDocument,
  listDocuments,
} from "../../../../../../db/documents.ts";
import { ResourceType } from "~/src/db/acl.ts";

export const GET: APIRoute = async (context) => {
  try {
    const spaceId = requireParam(context.params, "spaceId");

    // Authenticate with either user session or access token
    const auth = await authenticateRequest(context, spaceId);

    // Handle token-based authentication
    if (auth.type === "token") {
      await verifyTokenPermission(auth.token, spaceId, ResourceType.SPACE, spaceId, "viewer");
    } else {
      // Handle user-based authentication
      await verifySpaceRole(spaceId, auth.user.id, "viewer");
    }

    const url = new URL(context.request.url);
    const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);
    const offset = Number.parseInt(url.searchParams.get("offset") || "0", 10);

    if (limit < 1 || limit > 1000) {
      throw new Response("Limit must be between 1 and 1000", { status: 400 });
    }

    if (offset < 0) {
      throw new Response("Offset must be non-negative", { status: 400 });
    }

    // Always return documents without content (content fetched separately when viewing)
    const { documents, total } = await listDocuments(spaceId, limit, offset);
    return jsonResponse({ documents, total, limit, offset });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    await verifySpaceRole(spaceId, user.id, "editor");

    const body = await context.request.json();
    const { content, properties, parentId, type } = body;

    if (!content || typeof content !== "string") {
      throw badRequestResponse("Content is required and must be a string");
    }

    const title = properties?.title || "untitled";

    // createDocument now handles slug uniqueness internally
    const document = await createDocument(
      spaceId,
      user.id,
      title,
      content,
      properties,
      parentId,
      type,
    );
    return createdResponse({ document });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
