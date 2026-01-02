import type { APIRoute } from "astro";
import {
  jsonResponse,
  requireParam,
  requireUser,
  badRequestResponse,
  verifySpaceRole,
} from "../../../../../db/api.ts";
import { listConnections, createConnection } from "../../../../../db/connections.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");

    await verifySpaceRole(spaceId, user.id, "viewer");

    // List all connections for this space
    const connections = await listConnections(spaceId);
    return jsonResponse(connections);
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
    const { label, url, icon } = body;

    if (!label || !url) {
      throw badRequestResponse("Label and URL are required");
    }

    const connection = await createConnection(spaceId, label, url, icon);
    return jsonResponse(connection, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
