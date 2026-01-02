import type { APIRoute } from "astro";
import {
  badRequestResponse,
  createdResponse,
  jsonResponse,
  requireParam,
  requireUser,
  verifySpaceRole,
} from "../../../../../../db/api.js";
import { createCategory, listCategories, reorderCategories } from "../../../../../../db/categories.js";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    await verifySpaceRole(spaceId, user.id, "viewer");

    const categories = await listCategories(spaceId);

    return jsonResponse({ categories });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    await verifySpaceRole(spaceId, user.id, "editor");

    const body = await context.request.json();
    const { name, slug, description, color, icon } = body;

    if (!name || !slug) {
      throw badRequestResponse("Name and slug are required");
    }

    const categoryData = await createCategory(
      spaceId,
      name,
      slug,
      description,
      color,
      icon,
    );
    return createdResponse({ category: categoryData });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    await verifySpaceRole(spaceId, user.id, "editor");

    const body = await context.request.json();
    const { categoryIds } = body;

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw badRequestResponse("categoryIds array is required");
    }

    await reorderCategories(spaceId, categoryIds);
    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
};
