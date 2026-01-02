import type { APIRoute } from "astro";
import {
  jsonResponse,
  notFoundResponse,
  requireParam,
  requireUser,
  verifyDocumentAccess,
} from "../../../../../../../db/api.ts";
import { getDocument, getDocumentChildren } from "../../../../../../../db/documents.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const id = requireParam(context.params, "documentId");
    await verifyDocumentAccess(spaceId, id, user.id);

    const document = await getDocument(spaceId, id);
    if (!document) {
      throw notFoundResponse("Document");
    }

    const children = await getDocumentChildren(spaceId, id);
    return jsonResponse({ children });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
