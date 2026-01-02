import type { APIRoute } from "astro";
import { inArray } from "drizzle-orm";
import {
  badRequestResponse,
  jsonResponse,
  requireParam,
  requireUser,
  verifyDocumentAccess,
  verifyFeatureAccess,
} from "../../../../../../../db/api.ts";
import { createComment, listComments, getComment, archiveComment } from "../../../../../../../db/comments.ts";
import { ResourceType, Feature } from "../../../../../../../db/acl.ts";
import { getAuthDb } from "../../../../../../../db/db.ts";
import { user as userTable } from "../../../../../../../db/schema/auth.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = context.locals.user;
    const spaceId = requireParam(context.params, "spaceId");
    const documentId = requireParam(context.params, "documentId");

    // Allow viewing comments if user has access to document (including public docs)
    await verifyDocumentAccess(spaceId, documentId, user?.id || null);

    const comments = await listComments(spaceId, ResourceType.DOCUMENT, documentId);

    // Fetch user data for comment creators
    const authDb = getAuthDb();
    const userIds = [...new Set(comments.map(c => c.createdBy))];
    const users = await authDb
      .select()
      .from(userTable)
      .where(inArray(userTable.id, userIds))
      .all();

    const userMap = new Map(users.map(u => [u.id, u]));

    // Enrich comments with user data
    const enrichedComments = comments.map(comment => {
      const commentUser = userMap.get(comment.createdBy);
      return {
        ...comment,
        createdByUser: commentUser ? {
          id: commentUser.id,
          name: commentUser.name,
          email: commentUser.email,
          image: commentUser.image,
        } : null,
      };
    });

    return jsonResponse({ comments: enrichedComments });
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
    const documentId = requireParam(context.params, "documentId");

    // Ensure user has access to document
    await verifyDocumentAccess(spaceId, documentId, user.id);

    // Verify user has commenting feature access
    await verifyFeatureAccess(spaceId, Feature.COMMENT, user.id);

    const body = await context.request.json();
    const { content, parentId, type, reference } = body;

    if (!content || typeof content !== "string") {
      throw badRequestResponse("Content is required");
    }

    if (parentId && typeof parentId !== "string") {
      throw badRequestResponse("Parent ID must be a string");
    }

    const comment = await createComment(
      spaceId,
      ResourceType.DOCUMENT,
      documentId,
      content,
      user.id,
      parentId || null,
      type,
      reference
    );

    return jsonResponse({ comment });
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
    const documentId = requireParam(context.params, "documentId");

    const body = await context.request.json();
    const { commentId } = body;

    if (!commentId || typeof commentId !== "string") {
      throw badRequestResponse("Comment ID is required");
    }

    // Verify user has access to document
    await verifyDocumentAccess(spaceId, documentId, user.id);

    // Get the comment and verify user is the creator
    const comment = await getComment(spaceId, commentId);
    if (!comment) {
      throw badRequestResponse("Comment not found");
    }

    if (comment.createdBy !== user.id) {
      return new Response(JSON.stringify({ error: "You can only delete your own comments" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await archiveComment(spaceId, commentId);
    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
