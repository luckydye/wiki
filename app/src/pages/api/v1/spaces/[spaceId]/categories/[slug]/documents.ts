import type { APIRoute } from "astro";
import {
  jsonResponse,
  notFoundResponse,
  requireParam,
  requireUser,
  verifySpaceRole,
} from "../../../../../../../db/api.ts";
import { getCategoryBySlug } from "../../../../../../../db/categories.ts";
import { listAllDocuments } from "../../../../../../../db/documents.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    // TODO: should be id, not slug
    const slug = requireParam(context.params, "slug");
    await verifySpaceRole(spaceId, user.id, "viewer");

    const category = await getCategoryBySlug(spaceId, slug);
    if (!category) {
      throw notFoundResponse("Category");
    }

    const documents = await listAllDocuments(spaceId, slug, user.email);
    return jsonResponse({ documents, category });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
