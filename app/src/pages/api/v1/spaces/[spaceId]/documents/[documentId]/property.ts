import type { APIRoute } from "astro";
import {
  badRequestResponse,
  requireParam,
  requireUser,
  successResponse,
  verifyDocumentRole,
} from "../../../../../../../db/api.ts";
import {
  deleteDocumentProperty,
  updateDocumentProperty,
} from "../../../../../../../db/documents.ts";

export const PUT: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const id = requireParam(context.params, "documentId");
    await verifyDocumentRole(spaceId, id, user.id, "editor");

    const body = await context.request.json();
    const { key, value, type } = body;

    if (!key || typeof key !== "string") {
      throw badRequestResponse("Key is required and must be a string");
    }

    // TODO: slug changes should happen with a document save, not property update
    const changedProperties = await updateDocumentProperty(spaceId, id, key, String(value), type, user.id);

    return successResponse(changedProperties);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const id = requireParam(context.params, "documentId");
    await verifyDocumentRole(spaceId, id, user.id, "editor");

    const body = await context.request.json();
    const { key } = body;

    if (!key || typeof key !== "string") {
      throw badRequestResponse("Key is required and must be a string");
    }

    await deleteDocumentProperty(spaceId, id, key, user.id);

    return successResponse();
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
