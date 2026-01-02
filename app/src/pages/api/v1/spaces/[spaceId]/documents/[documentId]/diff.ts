import { createPatch } from 'diff';
import type { APIRoute } from "astro";
import {
  badRequestResponse,
  notFoundResponse,
  requireParam,
  verifyDocumentRole,
  authenticateRequest,
  verifyTokenPermission,
} from "../../../../../../../db/api.ts";
import { ResourceType } from "../../../../../../../db/acl.ts";
import {
  getDocument,
} from "../../../../../../../db/documents.ts";
import {
  getPublishedContent,
  getRevisionContent,
  getRevisionMetadata,
} from "../../../../../../../db/revisions.ts";

async function getRevision(revParam: string, spaceId: string, id: string) {
  const rev = Number.parseInt(revParam, 10);
  if (Number.isNaN(rev) || rev < 1) {
    throw badRequestResponse("Revision number must be a positive integer");
  }

  const metadata = await getRevisionMetadata(spaceId, id, rev);
  if (!metadata) {
    throw notFoundResponse("Revision");
  }

  const content = await getRevisionContent(spaceId, id, rev);
  if (!content) {
    throw notFoundResponse("Revision");
  }

  return content;
}

/**
 * Returns a patch from publsihed content to given revision
 */
export const GET: APIRoute = async (context) => {
  try {
    const spaceId = requireParam(context.params, "spaceId");
    const id = requireParam(context.params, "documentId");
    const revParam = context.url.searchParams.get("rev");

    // Authenticate with either user session or access token
    const auth = await authenticateRequest(context, spaceId);

    // Handle token-based authentication
    if (auth.type === "token") {
      await verifyTokenPermission(auth.token, spaceId, ResourceType.DOCUMENT, id, "viewer");
    } else {
      // Handle user-based authentication
      await verifyDocumentRole(spaceId, id, auth.user.id, "viewer");
    }

    const revisionContent = revParam ? await getRevision(revParam, spaceId, id) : undefined;

    let document = await getDocument(spaceId, id);
    if (!document) {
      throw notFoundResponse("Document");
    }

    const publishedContent = await getPublishedContent(spaceId, id);

    if (!revisionContent || !publishedContent) {
      throw new Error("Missing content");
    }

    return new Response(createPatch(id, revisionContent, publishedContent));
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
