import type { APIRoute } from "astro";
import {
  badRequestResponse,
  jsonResponse,
  notFoundResponse,
  requireParam,
  requireUser,
  successResponse,
  verifySpaceOwnership,
  verifySpaceRole,
} from "../../../../../../db/api.ts";
import {
  deleteCategory,
  getCategory,
  updateCategory,
} from "../../../../../../db/categories.ts";
import { getSpace } from "../../../../../../db/spaces.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const id = requireParam(context.params, "id");
    await verifySpaceRole(spaceId, user.id, "viewer");

    const categoryData = await getCategory(spaceId, id);
    if (!categoryData) {
      throw notFoundResponse("Category");
    }

    return jsonResponse({ category: categoryData });
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
    const id = requireParam(context.params, "id");
    await verifySpaceRole(spaceId, user.id, "editor");

    const body = await context.request.json();
    const { name, slug, description, color, icon } = body;

    if (!name || !slug) {
      throw badRequestResponse("Name and slug are required");
    }

    const categoryData = await updateCategory(
      spaceId,
      id,
      name,
      slug,
      description,
      color,
      icon,
    );

    if (!categoryData) {
      throw notFoundResponse("Category");
    }

    return jsonResponse({ category: categoryData });
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
    const id = requireParam(context.params, "id");
    await verifySpaceRole(spaceId, user.id, "editor");

    await deleteCategory(spaceId, id);
    return successResponse();
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
