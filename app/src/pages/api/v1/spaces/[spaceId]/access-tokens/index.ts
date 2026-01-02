import type { APIRoute } from "astro";
import {
  badRequestResponse,
  createdResponse,
  jsonResponse,
  requireParam,
  requireUser,
  verifySpaceRole,
} from "../../../../../../db/api.ts";
import {
  createAccessToken,
  grantTokenAccess,
  listAccessTokens,
  listTokenResources,
} from "../../../../../../db/accessTokens.ts";
import { ResourceType } from "../../../../../../db/acl.ts";

/**
 * GET /api/v1/spaces/:spaceId/access-tokens
 * List all access tokens and their permissions in this space
 */
export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");

    await verifySpaceRole(spaceId, user.id, "editor");

    // Get all tokens for this space
    const tokens = await listAccessTokens(spaceId);

    // For each token, get its resources
    const tokensWithResources = await Promise.all(
      tokens.map(async (token) => {
        const resources = await listTokenResources(token.id, spaceId);
        return {
          ...token,
          resources,
        };
      }),
    );

    return jsonResponse({ tokens: tokensWithResources });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};

/**
 * POST /api/v1/spaces/:spaceId/access-tokens
 * Create a new access token and assign it to a resource
 * Body:
 *   - name: Token name/description
 *   - resourceType: "space" | "document" | "category"
 *   - resourceId: ID of the resource (use spaceId for space-level access)
 *   - permission: "viewer" | "editor" | "owner"
 *   - expiresInDays: Optional expiration in days
 */
export const POST: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");

    await verifySpaceRole(spaceId, user.id, "editor");

    const body = await context.request.json();
    const { name, resourceType, resourceId, permission, expiresInDays } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw badRequestResponse("Token name is required");
    }

    if (!resourceType || !Object.values(ResourceType).includes(resourceType)) {
      throw badRequestResponse(
        `Resource type must be one of: ${Object.values(ResourceType).join(", ")}`,
      );
    }

    if (!resourceId || typeof resourceId !== "string") {
      throw badRequestResponse("Resource ID is required");
    }

    if (!permission || typeof permission !== "string") {
      throw badRequestResponse("Permission is required");
    }

    const validPermissions = ["viewer", "editor"];
    if (!validPermissions.includes(permission)) {
      throw badRequestResponse(
        `Permission must be one of: ${validPermissions.join(", ")}`,
      );
    }

    let expiresAt: Date | undefined;
    if (expiresInDays !== undefined) {
      if (typeof expiresInDays !== "number" || expiresInDays <= 0) {
        throw badRequestResponse("expiresInDays must be a positive number");
      }
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    }

    // Create the token
    const result = await createAccessToken({
      spaceId,
      name: name.trim(),
      expiresAt,
      createdBy: user.id,
    });

    // Grant access to the specified resource
    await grantTokenAccess({
      tokenId: result.id,
      spaceId,
      resourceType,
      resourceId,
      permission,
    });

    // Get the resources to return
    const resources = await listTokenResources(result.id, spaceId);

    return createdResponse({
      id: result.id,
      token: result.token,
      resources,
      message:
        "Token created successfully. Make sure to save it - you won't be able to see it again!",
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};