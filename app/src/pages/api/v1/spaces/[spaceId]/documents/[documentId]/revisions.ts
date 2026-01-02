import type { APIRoute } from "astro";
import {
  jsonResponse,
  requireParam,
  requireUser,
  verifyDocumentAccess,
  verifyFeatureAccess,
} from "../../../../../../../db/api.ts";
import { listRevisionMetadata } from "../../../../../../../db/revisions.ts";
import { Feature } from "../../../../../../../db/acl.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const documentId = requireParam(context.params, "documentId");

    await verifyDocumentAccess(spaceId, documentId, user.id);

    // Verify user has history viewing feature access
    await verifyFeatureAccess(spaceId, Feature.VIEW_HISTORY, user.id);

    const revisions = await listRevisionMetadata(spaceId, documentId);

    return jsonResponse({ revisions });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
