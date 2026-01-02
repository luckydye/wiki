import type { APIRoute } from "astro";
import {
  jsonResponse,
  requireParam,
  requireUser,
  verifySpaceRole,
} from "../../../../../db/api.ts";
import { getAllPropertiesWithValues, type PropertyInfo } from "../../../../../db/documents.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    await verifySpaceRole(spaceId, user.id, "viewer");

    const properties: PropertyInfo[] = await getAllPropertiesWithValues(spaceId);

    return jsonResponse({ properties });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
};
