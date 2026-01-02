import type { APIRoute } from "astro";
import {
  badRequestResponse,
  createdResponse,
  jsonResponse,
  requireUser,
} from "../../../../db/api.ts";
import { createSpace, listUserSpaces } from "../../../../db/spaces.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaces = await listUserSpaces(user.id);
    return jsonResponse(spaces);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const body = await context.request.json();
    const { name, slug, preferences } = body;

    if (!name || !slug) {
      throw badRequestResponse("Name and slug are required");
    }

    const space = await createSpace(user.id, name, slug, preferences);
    return createdResponse({ space });
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
