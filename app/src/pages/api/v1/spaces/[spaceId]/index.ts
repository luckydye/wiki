import type { APIRoute } from "astro";
import {
  badRequestResponse,
  jsonResponse,
  requireParam,
  requireUser,
  successResponse,
  verifySpaceOwnership,
  verifySpaceRole,
} from "../../../../../db/api.ts";
import { deleteSpace, getSpace, updateSpace } from "../../../../../db/spaces.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    await verifySpaceRole(spaceId, user.id, "viewer");
    const space = await getSpace(spaceId);
    return jsonResponse(space);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    await verifySpaceRole(spaceId, user.id, "owner");

    const body = await context.request.json();
    const { name, slug, preferences } = body;

    if (!name || !slug) {
      throw badRequestResponse("Name and slug are required");
    }

    const space = await updateSpace(spaceId, name, slug, preferences);
    return jsonResponse(space);
  } catch (error) {
    if (error instanceof Response) return error;

    // Handle duplicate slug error
    if (error instanceof Error && error.message.includes("already exists")) {
      return badRequestResponse(error.message);
    }

    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    await verifySpaceRole(spaceId, user.id, "owner");
    await deleteSpace(spaceId);
    return successResponse();
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
