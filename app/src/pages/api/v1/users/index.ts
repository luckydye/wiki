import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { errorResponse, jsonResponse, notFoundResponse, requireUser } from "../../../../db/api.ts";
import { getAuthDb } from "../../../../db/db.ts";
import { user } from "../../../../db/schema/auth.ts";

export const GET: APIRoute = async (context) => {
  try {
    requireUser(context);

    const db = getAuthDb();
    const id = context.url.searchParams.get("id");

    if (id) {
      const result = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        })
        .from(user)
        .where(eq(user.id, id))
        .get();

      if (!result) {
        throw notFoundResponse("User");
      }

      return jsonResponse(result);
    }

    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(user);

    return jsonResponse(users);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return errorResponse("Failed to list users", 500);
  }
};