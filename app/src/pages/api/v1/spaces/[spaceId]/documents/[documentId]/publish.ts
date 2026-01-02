import type { APIRoute } from "astro";
import {
  badRequestResponse,
  jsonResponse,
  requireParam,
  requireUser,
  verifyDocumentRole,
} from "../../../../../../../db/api.ts";
import { restoreRevision } from "../../../../../../../db/revisions.ts";

export const POST: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const documentId = requireParam(context.params, "documentId");
    const revParam = context.url.searchParams.get("rev");

    if (!revParam) {
      throw new Error('Revision query parameter missing');
    }

    await verifyDocumentRole(spaceId, documentId, user.id, "editor");

    const rev = Number.parseInt(revParam, 10);
    if (Number.isNaN(rev) || rev < 1) {
      throw badRequestResponse("Revision number must be a positive integer");
    }

    const body = await context.request.json().catch(() => ({}));
    const { message } = body;

    const revision = await restoreRevision(spaceId, documentId, rev, user.id, message);

    return jsonResponse({
      revision: {
        id: revision.id,
        documentId: revision.documentId,
        rev: revision.rev,
        checksum: revision.checksum,
        parentRev: revision.parentRev,
        message: revision.message,
        createdAt: revision.createdAt,
        createdBy: revision.createdBy,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
