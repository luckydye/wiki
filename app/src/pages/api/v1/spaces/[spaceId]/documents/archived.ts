import type { APIRoute } from "astro";
import {
  jsonResponse,
  requireParam,
  requireUser,
  verifySpaceAccess,
} from "../../../../../../db/api.ts";
import { listArchivedDocuments } from "../../../../../../db/documents.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    await verifySpaceAccess(spaceId, user.id);
    const documents = await listArchivedDocuments(spaceId, user.id);
    return jsonResponse({ documents });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
