import type { APIRoute } from "astro";
import {
  badRequestResponse,
  jsonResponse,
  forbiddenResponse,
  notFoundResponse,
  requireParam,
  requireUser,
  successResponse,
  verifyDocumentAccess,
  verifyDocumentRole,
  authenticateRequest,
  verifyTokenPermission,
} from "../../../../../../../db/api.ts";
import { ResourceType } from "../../../../../../../db/acl.ts";
import { getTokenUserId } from "../../../../../../../db/accessTokens.ts";
import {
  archiveDocument,
  deleteDocument,
  getDocument,
  restoreDocument,
  setDocumentParent,
  updateDocument,
} from "../../../../../../../db/documents.ts";
import { triggerWebhooks } from "../../../../../../../db/webhooks.ts";
import { stripScriptTags } from "../../../../../../../utils/utils.ts";
import {
  getPublishedContent,
  getRevisionContent,
  getRevisionMetadata,
} from "../../../../../../../db/revisions.ts";
import { createRevision } from "../../../../../../../db/revisions.ts";
import { getUniqueMentionedEmails } from "../../../../../../../db/mentions.ts";
import { sendSyncEvent } from "~/src/db/ws.ts";

export const GET: APIRoute = async (context) => {
  try {
    const spaceId = requireParam(context.params, "spaceId");
    const id = requireParam(context.params, "documentId");
    const revParam = context.url.searchParams.get("rev");

    // Authenticate with either user session or access token
    const auth = await authenticateRequest(context, spaceId);

    // Handle token-based authentication
    if (auth.type === "token") {
      await verifyTokenPermission(auth.token, spaceId, ResourceType.DOCUMENT, id, "viewer");
    } else {
      // Handle user-based authentication
      await verifyDocumentRole(spaceId, id, auth.user.id, "viewer");
    }

    if (revParam) {
      const rev = Number.parseInt(revParam, 10);
      if (Number.isNaN(rev) || rev < 1) {
        throw badRequestResponse("Revision number must be a positive integer");
      }

      const metadata = await getRevisionMetadata(spaceId, id, rev);
      if (!metadata) {
        throw notFoundResponse("Revision");
      }

      const content = await getRevisionContent(spaceId, id, rev);
      if (!content) {
        throw notFoundResponse("Revision");
      }

      return jsonResponse({
        revision: {
          ...metadata,
          content,
        },
      });
    }

    let document = await getDocument(spaceId, id);
    if (!document) {
      throw notFoundResponse("Document");
    }

    if (document.publishedRev !== null) {
      const publishedContent = await getPublishedContent(spaceId, id);
      if (publishedContent) {
        document = {
          ...document,
          content: publishedContent,
        };
      }
    }

    return jsonResponse({ document });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    const spaceId = requireParam(context.params, "spaceId");
    const id = requireParam(context.params, "documentId");

    // Authenticate with either user session or access token
    const auth = await authenticateRequest(context, spaceId);

    const existingDoc = await getDocument(spaceId, id);
    if (!existingDoc) {
      throw notFoundResponse("Document");
    }

    if (existingDoc.readonly) {
      throw forbiddenResponse("Cannot update readonly document");
    }

    // Handle token-based authentication
    if (auth.type === "token") {
      await verifyTokenPermission(auth.token, spaceId, ResourceType.DOCUMENT, id, "editor");
    } else {
      // Handle user-based authentication
      await verifyDocumentRole(spaceId, id, auth.user.id, "editor");
    }

    const body = await context.request.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      throw badRequestResponse("Content is required and must be a string");
    }

    // TODO: propper sanitization needed, parse html doc and only use allowed elements and attributes.
    const contentSanitized = stripScriptTags(content);

    // Use token user ID for token-based updates, or actual user ID for user-based
    const userId = auth.type === "token" ? getTokenUserId(auth.token.tokenId) : auth.user.id;
    const document = await updateDocument(spaceId, id, contentSanitized, userId);
    return jsonResponse({ document });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};

export const PATCH: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const id = requireParam(context.params, "documentId");

    const body = await context.request.json();
    const { parentId, publishedRev, readonly, restore } = body;

    await verifyDocumentRole(spaceId, id, user.id, "editor");

    if (restore) {
      await restoreDocument(spaceId, id, user.id);

      sendSyncEvent("wiki_category_documents");

      return jsonResponse({ success: true });
    }

    if (parentId !== undefined) {
      if (parentId !== null && typeof parentId !== "string") {
        throw badRequestResponse("Parent ID must be a string or null");
      }

      if (parentId) {
        await verifyDocumentAccess(spaceId, parentId, user.id);
      }

      await setDocumentParent(spaceId, id, parentId);
    }

    if (publishedRev !== undefined) {
      // Validate publishedRev is either null or a positive integer
      if (publishedRev !== null) {
        if (typeof publishedRev !== "number" || !Number.isInteger(publishedRev) || publishedRev < 1) {
          throw badRequestResponse("Published revision must be null or a positive integer");
        }
      }

      const { getSpaceDb } = await import("../../../../../../../db/db.ts");
      const { document } = await import("../../../../../../../db/schema/space.ts");
      const { eq } = await import("drizzle-orm");
      const { createAuditLog } = await import("../../../../../../../db/auditLogs.ts");

      const db = getSpaceDb(spaceId);
      await db
        .update(document)
        .set({ publishedRev: publishedRev })
        .where(eq(document.id, id));

      await createAuditLog(db, {
        docId: id,
        revisionId: publishedRev || undefined,
        userId: user.id,
        event: publishedRev === null ? "unpublish" : "publish",
        details: {
          message:
            publishedRev === null
              ? "Document unpublished"
              : `Published revision ${publishedRev}`,
        },
      });

      await triggerWebhooks(db, {
        event: publishedRev === null ? "document.unpublished" : "document.published",
        spaceId,
        documentId: id,
        revisionId: publishedRev || undefined,
        timestamp: new Date().toISOString(),
      });

      const revisionContent = await getRevisionContent(spaceId, id, publishedRev);
      if (revisionContent) {
        const mentionedEmails = getUniqueMentionedEmails(revisionContent);
        if (mentionedEmails.length > 0) {
          for (const email of mentionedEmails) {
            await triggerWebhooks(db, {
              event: "mention",
              spaceId,
              documentId: id,
              revisionId: publishedRev,
              timestamp: new Date().toISOString(),
              data: {
                mentionedUser: email,
                mentionedBy: user.id,
              },
            });
          }
        }
      }
    }

    if (readonly !== undefined) {
      if (typeof readonly !== "boolean") {
        throw badRequestResponse("Readonly must be a boolean");
      }

      const { getSpaceDb } = await import("../../../../../../../db/db.ts");
      const { document } = await import("../../../../../../../db/schema/space.ts");
      const { eq } = await import("drizzle-orm");
      const { createAuditLog } = await import("../../../../../../../db/auditLogs.ts");

      const db = getSpaceDb(spaceId);
      await db
        .update(document)
        .set({ readonly: readonly })
        .where(eq(document.id, id));

      await createAuditLog(db, {
        docId: id,
        userId: user.id,
        event: readonly ? "lock" : "unlock",
        details: {
          message: readonly ? "Document set to readonly" : "Document readonly removed",
        },
      });
    }

    sendSyncEvent("wiki_category_documents");

    return jsonResponse({ success: true });
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
    const id = requireParam(context.params, "documentId");
    const permanent = context.url.searchParams.get("permanent") === "true";

    await verifyDocumentRole(spaceId, id, user.id, "owner");

    if (permanent) {
      await deleteDocument(spaceId, id, user.id);
    } else {
      await archiveDocument(spaceId, id, user.id);
    }

    return successResponse();
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

    await verifyDocumentAccess(spaceId, documentId, user.id);

    const document = await getDocument(spaceId, documentId);
    if (!document) {
      throw badRequestResponse("Document not found");
    }

    if (document.readonly) {
      throw forbiddenResponse("Cannot save readonly document");
    }

    const body = await context.request.json();
    const { html, message } = body;

    if (!html || typeof html !== "string") {
      throw badRequestResponse("HTML content is required and must be a string");
    }

    const revision = await createRevision(spaceId, documentId, html, user.id, message);

    return jsonResponse({
      revision: {
        id: revision.id,
        documentId: revision.documentId,
        rev: revision.rev,
        checksum: revision.checksum,
        parentRev: revision.parentRev,
        message: revision.message,
        createdAt: revision.createdAt,
        createdBy: revision.createdBy,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
