import type { APIRoute } from "astro";
import {
  badRequestResponse,
  jsonResponse,
  notFoundResponse,
  requireParam,
  requireUser,
  verifySpaceRole,
} from "../../../../../../db/api.ts";
import {
  getWebhook,
  updateWebhook,
  deleteWebhook,
  parseWebhookEvents,
  type WebhookEvent,
} from "../../../../../../db/webhooks.ts";
import { getSpaceDb } from "../../../../../../db/db.ts";

export const GET: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const webhookId = requireParam(context.params, "webhookId");

    await verifySpaceRole(spaceId, user.id, "viewer");

    const db = getSpaceDb(spaceId);
    const webhook = await getWebhook(db, webhookId);

    if (!webhook) {
      throw notFoundResponse("Webhook");
    }

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

export const PATCH: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const webhookId = requireParam(context.params, "webhookId");

    await verifySpaceRole(spaceId, user.id, "admin");

    const db = getSpaceDb(spaceId);
    const existingWebhook = await getWebhook(db, webhookId);

    if (!existingWebhook) {
      throw notFoundResponse("Webhook");
    }

    const body = await context.request.json();
    const { url, events, documentId, secret, enabled } = body;

    if (url !== undefined && typeof url !== "string") {
      throw badRequestResponse("URL must be a string");
    }

    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        throw badRequestResponse("Events must be a non-empty array");
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
    }

    if (documentId !== undefined && documentId !== null && typeof documentId !== "string") {
      throw badRequestResponse("Document ID must be a string or null");
    }

    if (secret !== undefined && secret !== null && typeof secret !== "string") {
      throw badRequestResponse("Secret must be a string or null");
    }

    if (enabled !== undefined && typeof enabled !== "boolean") {
      throw badRequestResponse("Enabled must be a boolean");
    }

    const webhook = await updateWebhook(db, webhookId, {
      url,
      events,
      documentId,
      secret,
      enabled,
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

export const DELETE: APIRoute = async (context) => {
  try {
    const user = requireUser(context);
    const spaceId = requireParam(context.params, "spaceId");
    const webhookId = requireParam(context.params, "webhookId");

    await verifySpaceRole(spaceId, user.id, "admin");

    const db = getSpaceDb(spaceId);
    const webhook = await getWebhook(db, webhookId);

    if (!webhook) {
      throw notFoundResponse("Webhook");
    }

    await deleteWebhook(db, webhookId);

    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    throw new Error("Unknown error", { cause: error });
  }
};