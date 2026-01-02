import type { APIRoute } from "astro";
import {
  errorResponse,
  requireParam,
  requireUser,
  successResponse,
} from "../../../../../../db/api.js";
import { hasPermission, ResourceType } from "../../../../../../db/acl.js";
import { rebuildSearchIndex } from "../../../../../../db/documents.js";

export const POST: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");

    const isOwner = await hasPermission(
      spaceId,
      ResourceType.SPACE,
      spaceId,
      user.id,
      "owner",
    );

    if (!isOwner) {
      throw new Response("Only owners can rebuild search index", {
        status: 403,
      });
    }

    await rebuildSearchIndex(spaceId);

    return successResponse("Search index rebuilt successfully");
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return errorResponse("Failed to rebuild search index", 500);
  }
};
