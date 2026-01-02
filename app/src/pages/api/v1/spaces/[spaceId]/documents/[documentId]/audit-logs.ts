import type { APIRoute } from "astro";
import {
  jsonResponse,
  requireParam,
  requireUser,
  verifyDocumentAccess,
  verifyFeatureAccess,
} from "../../../../../../../db/api.ts";
import { Feature } from "../../../../../../../db/acl.ts";
import {
  getAuditLogsForDocument,
  parseAuditDetails,
} from "../../../../../../../db/auditLogs.ts";
import { getSpaceDb } from "../../../../../../../db/db.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const documentId = requireParam(context.params, "documentId");

    await verifyDocumentAccess(spaceId, documentId, user.id);
    
    // Verify user has audit log viewing feature access
    await verifyFeatureAccess(spaceId, Feature.VIEW_AUDIT, user.id);

    const limitParam = context.url.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;

    const db = getSpaceDb(spaceId);
    const logs = await getAuditLogsForDocument(db, documentId, limit);

    const logsWithDetails = logs.map((log) => ({
      ...log,
      details: parseAuditDetails(log),
    }));

    return jsonResponse({ auditLogs: logsWithDetails });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};
