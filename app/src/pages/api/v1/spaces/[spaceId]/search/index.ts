import type { APIRoute } from "astro";
import {
  errorResponse,
  jsonResponse,
  requireParam,
  requireUser,
} from "../../../../../../db/api.js";
import { getPermission, ResourceType } from "../../../../../../db/acl.js";
import { searchDocuments, type PropertyFilter } from "../../../../../../db/documents.js";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");

    const permission = await getPermission(spaceId, ResourceType.SPACE, spaceId, user.id);
    if (!permission) {
      throw new Response("Not a member of this space", { status: 403 });
    }

    const url = new URL(context.request.url);
    const query = url.searchParams.get("q") || "";
    const limit = Number.parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = Number.parseInt(url.searchParams.get("offset") || "0", 10);
    const filtersParam = url.searchParams.get("filters");

    // Parse property filters from JSON string
    let filters: PropertyFilter[] = [];
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam);
        if (!Array.isArray(parsed)) {
          throw new Error("Filters must be an array");
        }
        for (const filter of parsed) {
          if (typeof filter.key !== "string" || !filter.key.trim()) {
            throw new Error("Each filter must have a non-empty 'key' string");
          }
          if (filter.value !== null && typeof filter.value !== "string") {
            throw new Error("Filter 'value' must be a string or null");
          }
        }
        filters = parsed;
      } catch (e) {
        throw new Response(
          `Invalid filters parameter: ${e instanceof Error ? e.message : "Parse error"}`,
          { status: 400 }
        );
      }
    }

    // Allow empty query only when filters are provided
    if (!query.trim() && filters.length === 0) {
      return jsonResponse({ results: [], total: 0, query: "", filters: [] });
    }

    if (limit < 1 || limit > 100) {
      throw new Response("Limit must be between 1 and 100", { status: 400 });
    }

    if (offset < 0) {
      throw new Response("Offset must be non-negative", { status: 400 });
    }

    const { results, total } = await searchDocuments(spaceId, user.id, query, limit, offset, filters);

    return jsonResponse({
      results,
      total,
      query,
      limit,
      offset,
      filters,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error(error);
    return errorResponse("Failed to search documents", 500);
  }
};