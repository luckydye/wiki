import type { APIRoute } from "astro";
import {
  jsonResponse,
  requireParam,
  requireUser,
  successResponse,
  verifySpaceRole,
} from "../../../../../../db/api.ts";
import { deleteConnection, getConnection } from "../../../../../../db/connections.ts";

export const DELETE: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const connectionId = requireParam(context.params, "connectionId");

    await verifySpaceRole(spaceId, user.id, "editor");

    // Verify connection exists
    const connection = await getConnection(spaceId, connectionId);
    if (!connection) {
      return jsonResponse({ error: "Connection not found" }, 404);
    }

    await deleteConnection(spaceId, connectionId);
    return successResponse();
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
