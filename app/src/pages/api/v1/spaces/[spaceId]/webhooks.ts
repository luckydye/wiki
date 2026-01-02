import type { APIRoute } from "astro";
import {
  badRequestResponse,
  jsonResponse,
  requireParam,
  requireUser,
  verifySpaceRole,
} from "../../../../../db/api.ts";
import {
  createWebhook,
  listWebhooks,
  parseWebhookEvents,
  type WebhookEvent,
} from "../../../../../db/webhooks.ts";
import { getSpaceDb } from "../../../../../db/db.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");

    await verifySpaceRole(spaceId, user.id, "viewer");

    const db = getSpaceDb(spaceId);
    const webhooks = await listWebhooks(db);

    const webhooksWithParsedEvents = webhooks.map((wh) => ({
      id: wh.id,
      url: wh.url,
      events: parseWebhookEvents(wh),
      documentId: wh.documentId,
      enabled: wh.enabled,
      createdAt: wh.createdAt,
      updatedAt: wh.updatedAt,
      createdBy: wh.createdBy,
    }));

    return jsonResponse({ webhooks: webhooksWithParsedEvents });
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

    await verifySpaceRole(spaceId, user.id, "admin");

    const body = await context.request.json();
    const { url, events, documentId, secret } = body;

    if (!url || typeof url !== "string") {
      throw badRequestResponse("URL is required and must be a string");
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      throw badRequestResponse("Events array is required and must not be empty");
    }

    const validEvents: WebhookEvent[] = [
      "document.published",
      "document.unpublished",
      "document.deleted",
      "mention",
    ];

    for (const event of events) {
      if (!validEvents.includes(event)) {
        throw badRequestResponse(`Invalid event: ${event}`);
      }
    }

    if (documentId !== undefined && typeof documentId !== "string") {
      throw badRequestResponse("Document ID must be a string");
    }

    if (secret !== undefined && typeof secret !== "string") {
      throw badRequestResponse("Secret must be a string");
    }

    const db = getSpaceDb(spaceId);
    const webhook = await createWebhook(db, {
      url,
      events,
      documentId,
      secret,
      createdBy: user.id,
    });

    return jsonResponse({
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: parseWebhookEvents(webhook),
        documentId: webhook.documentId,
        enabled: webhook.enabled,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
        createdBy: webhook.createdBy,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};