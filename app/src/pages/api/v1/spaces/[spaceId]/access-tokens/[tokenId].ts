import type { APIRoute } from "astro";
import {
  jsonResponse,
  notFoundResponse,
  requireParam,
  requireUser,
  successResponse,
  verifySpaceRole,
} from "../../../../../../db/api.ts";
import {
  revokeAccessToken,
  deleteAccessToken,
  revokeTokenAccess,
  listTokenResources,
  grantTokenAccess,
  getAccessToken,
  getTokenUserId,
} from "../../../../../../db/accessTokens.ts";
import { ResourceType } from "../../../../../../db/acl.ts";

/**
 * GET /api/v1/spaces/:spaceId/access-tokens/:tokenId
 * Get token details and its resources in this space
 */
export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const tokenId = requireParam(context.params, "tokenId");

    await verifySpaceRole(spaceId, user.id, "editor");

    const token = await getAccessToken(spaceId, tokenId);
    if (!token) {
      throw notFoundResponse("Access token");
    }

    const resources = await listTokenResources(tokenId, spaceId);

    return jsonResponse({ token: { ...token, resources } });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};

/**
 * POST /api/v1/spaces/:spaceId/access-tokens/:tokenId/grant
 * Grant token access to a resource in this space
 * Body:
 *   - resourceType: "space" | "document" | "category"
 *   - resourceId: ID of the resource
 *   - permission: "viewer" | "editor" | "owner"
 */
export const POST: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const tokenId = requireParam(context.params, "tokenId");

    await verifySpaceRole(spaceId, user.id, "editor");

    const body = await context.request.json();
    const { resourceType, resourceId, permission } = body;

    if (!resourceType || !Object.values(ResourceType).includes(resourceType)) {
      throw jsonResponse(
        { error: `Resource type must be one of: ${Object.values(ResourceType).join(", ")}` },
        400,
      );
    }

    if (!resourceId || typeof resourceId !== "string") {
      throw jsonResponse({ error: "Resource ID is required" }, 400);
    }

    if (!permission || typeof permission !== "string") {
      throw jsonResponse({ error: "Permission is required" }, 400);
    }

    const validPermissions = ["viewer", "editor"];
    if (!validPermissions.includes(permission)) {
      throw jsonResponse(
        { error: `Permission must be one of: ${validPermissions.join(", ")}` },
        400,
      );
    }

    await grantTokenAccess({
      tokenId,
      spaceId,
      resourceType,
      resourceId,
      permission,
    });

    const resources = await listTokenResources(tokenId, spaceId);

    return jsonResponse({ resources, message: "Access granted successfully" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};

/**
 * PATCH /api/v1/spaces/:spaceId/access-tokens/:tokenId
 * Revoke token access to a specific resource
 * Body:
 *   - resourceType: "space" | "document" | "category"
 *   - resourceId: ID of the resource
 */
export const PATCH: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const tokenId = requireParam(context.params, "tokenId");

    await verifySpaceRole(spaceId, user.id, "editor");

    const body = await context.request.json();
    const { resourceType, resourceId } = body;

    if (resourceType && resourceId) {
      // Revoke access to specific resource
      await revokeTokenAccess(tokenId, spaceId, resourceType, resourceId);
      return successResponse({ message: "Resource access revoked successfully" });
    } else {
      // Revoke the token entirely
      const success = await revokeAccessToken(spaceId, tokenId);
      if (!success) {
        throw notFoundResponse("Access token");
      }
      return successResponse({ message: "Token revoked successfully" });
    }
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};

/**
 * DELETE /api/v1/spaces/:spaceId/access-tokens/:tokenId
 * Permanently delete an access token
 */
export const DELETE: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const tokenId = requireParam(context.params, "tokenId");

    await verifySpaceRole(spaceId, user.id, "editor");

    const success = await deleteAccessToken(spaceId, tokenId);
    if (!success) {
      throw notFoundResponse("Access token");
    }

    return successResponse({ message: "Token deleted successfully" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};