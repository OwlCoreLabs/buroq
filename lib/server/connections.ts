import "server-only";

import { randomBytes } from "node:crypto";
import { Api, TelegramClient } from "teleproto";
import { CustomFile } from "teleproto/client/uploads";
import { computeCheck } from "teleproto/Password";
import { StringSession } from "teleproto/sessions";
import {
  database,
  decryptSecret,
  encryptSecret,
  type ConnectionKind,
  type StoredConnection,
} from "./database";
import { saveImage } from "./media";
import { saveMessage } from "./messages";
import { getActiveTunnelUrl, getTelegramWebhookSecret } from "./ngrok";

type ConnectionCredentials = Record<string, string | number | boolean>;

type TelegramBotUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    date?: number;
    text?: string;
    caption?: string;

    photo?: Array<{
      file_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;

    document?: {
      file_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };

    chat?: {
      id?: number;
      title?: string;
      username?: string;
      first_name?: string;
    };

    from?: {
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
};

export function isTelegramWebhookEnabled() {
  return Boolean(telegramWebhookConfig("check"));
}

function telegramWebhookConfig(connectionId: string) {
  const activeTunnel = getActiveTunnelUrl();
  const baseUrl = (activeTunnel || process.env.TELEGRAM_WEBHOOK_BASE_URL)?.replace(/\/+$/, "");
  if (!baseUrl) return null;
  if (!/^https:\/\//i.test(baseUrl)) {
    throw new Error("TELEGRAM_WEBHOOK_BASE_URL must use HTTPS.");
  }

  const secret = getTelegramWebhookSecret();
  if (!secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    throw new Error("Set TELEGRAM_WEBHOOK_SECRET when TELEGRAM_WEBHOOK_BASE_URL is configured.");
  }
  return {
    url: `${baseUrl}/api/webhooks/telegram/${connectionId}`,
    secret,
  };
}

export function getConnection(id: string) {
  return database()
    .prepare("SELECT id, kind, label, credentials, status FROM connections WHERE id = ?")
    .get(id) as StoredConnection | undefined;
}

export function readCredentials<T extends ConnectionCredentials>(connection: StoredConnection) {
  return JSON.parse(decryptSecret(connection.credentials)) as T;
}

export function getConnections() {
  return database()
    .prepare("SELECT id, kind, label, status FROM connections ORDER BY created_at")
    .all() as Array<{ id: string; kind: ConnectionKind; label: string; status: string }>;
}

function storeConnection(input: {
  id?: string;
  kind: ConnectionKind;
  label: string;
  credentials: ConnectionCredentials;
  status?: string;
}) {
  const id = input.id ?? randomBytes(16).toString("hex");
  database()
    .prepare(
      `INSERT INTO connections (id, kind, label, credentials, status)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         label = excluded.label,
         credentials = excluded.credentials,
         status = excluded.status`,
    )
    .run(
      id,
      input.kind,
      input.label,
      encryptSecret(JSON.stringify(input.credentials)),
      input.status ?? "connected",
    );
  return id;
}

export async function connectWhatsAppBusiness(phoneNumberId: string, accessToken: string) {
  if (!/^\d{5,30}$/.test(phoneNumberId) || accessToken.length < 20) {
    throw new Error("Enter a valid WhatsApp phone number ID and access token.");
  }
  const version = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";
  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}?fields=id,display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  const result: unknown = await response.json();
  if (!response.ok || typeof result !== "object" || result === null || !("id" in result)) {
    throw new Error(
      typeof result === "object" && result !== null && "error" in result
        ? String((result.error as { message?: string }).message ?? "Meta rejected the credentials.")
        : "Meta rejected the WhatsApp credentials.",
    );
  }

  const data = result as { id: string; display_phone_number?: string; verified_name?: string };
  if (data.id !== phoneNumberId)
    throw new Error("The returned WhatsApp phone number ID did not match.");
  const label = data.display_phone_number ?? data.verified_name ?? "WhatsApp Business";
  return storeConnection({
    kind: "whatsapp-business",
    label,
    credentials: { phoneNumberId, accessToken },
  });
}

export async function telegramBotRequest<T>(
  token: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result: unknown = await response.json();
  if (!response.ok || typeof result !== "object" || result === null || !("ok" in result)) {
    throw new Error("Telegram Bot API request failed.");
  }
  const parsed = result as { ok: boolean; result?: T; description?: string };
  if (!parsed.ok) {
    throw new Error(parsed.description ?? "Telegram rejected the request.");
  }
  return parsed.result as T;
}

export async function connectTelegramBot(token: string) {
  if (token.length < 30 || token.length > 256) throw new Error("Enter a valid Telegram bot token.");
  const bot = await telegramBotRequest<{ id: number; username?: string }>(token, "getMe");
  const webhook = telegramWebhookConfig("pending");
  const hook = await telegramBotRequest<{ url: string }>(token, "getWebhookInfo");
  if (!webhook && hook.url) {
    throw new Error(
      "This bot already has a webhook configured. Remove it in Telegram or configure TELEGRAM_WEBHOOK_BASE_URL.",
    );
  }

  const id = storeConnection({
    kind: "telegram-bot",
    label: bot.username ? `@${bot.username}` : "Telegram bot",
    credentials: { token, botId: bot.id, offset: 0 },
  });
  const configuredWebhook = telegramWebhookConfig(id);
  if (configuredWebhook) {
    try {
      await telegramBotRequest(token, "setWebhook", {
        url: configuredWebhook.url,
        secret_token: configuredWebhook.secret,
        allowed_updates: ["message"],
      });
    } catch (error) {
      database().prepare("DELETE FROM connections WHERE id = ?").run(id);
      throw error;
    }
  }
  return id;
}

export async function ensureTelegramBotWebhook(connection: StoredConnection) {
  if (connection.kind !== "telegram-bot") return;
  const webhook = telegramWebhookConfig(connection.id);
  if (!webhook) return;

  const credentials = readCredentials<{ token: string }>(connection);
  const hook = await telegramBotRequest<{ url?: string }>(credentials.token, "getWebhookInfo");
  if (hook.url === webhook.url) {
    await telegramBotRequest(credentials.token, "setWebhook", {
      url: webhook.url,
      secret_token: webhook.secret,
      allowed_updates: ["message"],
    });
    return;
  }

  await telegramBotRequest(credentials.token, "setWebhook", {
    url: webhook.url,
    secret_token: webhook.secret,
    allowed_updates: ["message"],
  });
}

export async function receiveTelegramBotUpdate(
  connection: StoredConnection,
  update: TelegramBotUpdate,
) {
  const message = update.message;

  if (message?.message_id == null || message.date == null || message.chat?.id == null) {
    return;
  }

  const name =
    message.chat.title ||
    [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") ||
    (message.from?.username ? `@${message.from.username}` : String(message.chat.id));

  let body = message.text || message.caption || "";
  let mediaPath: string | undefined;
  let mediaMimeType: string | undefined;
  let mediaName: string | undefined;

  const credentials = readCredentials<{ token: string }>(connection);

  if (message.photo?.length) {
    const photo = message.photo[message.photo.length - 1];
    try {
      const fileInfo = await telegramBotRequest<{ file_path?: string }>(
        credentials.token,
        "getFile",
        { file_id: photo.file_id },
      );
      if (fileInfo.file_path) {
        const response = await fetch(
          `https://api.telegram.org/file/bot${credentials.token}/${fileInfo.file_path}`,
          { cache: "no-store" },
        );
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const ext = fileInfo.file_path.split(".").pop()?.toLowerCase() ?? "jpg";
          const mime =
            ext === "png"
              ? "image/png"
              : ext === "gif"
                ? "image/gif"
                : ext === "webp"
                  ? "image/webp"
                  : "image/jpeg";
          mediaPath = await saveImage(buffer, mime);
          mediaMimeType = mime;
          mediaName = "photo";
        }
      }
    } catch (err) {
      console.error("Failed to download Telegram bot photo:", err);
    }
    if (!mediaPath) {
      // Fallback: store file_id as text if download failed
      body = `[Telegram photo: ${photo.file_id}]${body ? `\n${body}` : ""}`;
    }
  } else if (message.document) {
    const document = message.document;
    const isImage = document.mime_type?.startsWith("image/");
    if (isImage && document.mime_type) {
      try {
        const fileInfo = await telegramBotRequest<{ file_path?: string }>(
          credentials.token,
          "getFile",
          { file_id: document.file_id },
        );
        if (fileInfo.file_path) {
          const response = await fetch(
            `https://api.telegram.org/file/bot${credentials.token}/${fileInfo.file_path}`,
            { cache: "no-store" },
          );
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            mediaPath = await saveImage(buffer, document.mime_type);
            mediaMimeType = document.mime_type;
            mediaName = document.file_name ?? "image";
          }
        }
      } catch (err) {
        console.error("Failed to download Telegram bot document image:", err);
      }
    }
    if (!mediaPath) {
      body = `[Telegram ${isImage ? "image" : "document"}: ${document.file_id}]${
        body ? `\n${body}` : ""
      }`;
    }
  }

  if (!body && !mediaPath) return;

  saveMessage({
    connectionId: connection.id,
    providerChatId: String(message.chat.id),
    title: name,
    handle: message.from?.username ? `@${message.from.username}` : "",
    providerMessageId: String(message.message_id),
    body: body || (mediaPath ? "" : ""),
    direction: "inbound",
    createdAt: message.date * 1000,
    mediaUrl: mediaPath,
    mediaMimeType,
    mediaName,
  });
}

function telegramCredentials() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  if (!Number.isSafeInteger(apiId) || apiId < 1 || !apiHash) {
    throw new Error(
      "Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env.local to connect a personal Telegram account.",
    );
  }
  return { apiId, apiHash };
}

function telegramClient(session = "") {
  const { apiId, apiHash } = telegramCredentials();
  return new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 3,
  });
}

export async function startTelegramPersonal(phoneNumber: string) {
  const normalizedPhone = phoneNumber.replace(/[^\d+]/g, "");
  if (!/^\+[1-9]\d{6,14}$/.test(normalizedPhone)) {
    throw new Error("Enter a phone number in international format, for example +14155550123.");
  }

  const client = telegramClient();
  await client.connect();
  try {
    const { apiId, apiHash } = telegramCredentials();
    const sentCode = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: normalizedPhone,
        apiId,
        apiHash,
        settings: new Api.CodeSettings({}),
      }),
    );
    if (sentCode.className !== "auth.SentCode") {
      throw new Error("Telegram did not send a login code for this account.");
    }
    const id = storeConnection({
      kind: "telegram-personal",
      label: normalizedPhone,
      status: "pending",
      credentials: {
        session: client.session.save(),
        phoneNumber: normalizedPhone,
        phoneCodeHash: sentCode.phoneCodeHash,
      },
    });
    return { id };
  } finally {
    await client.disconnect();
  }
}

export async function verifyTelegramPersonal(
  connectionId: string,
  code: string,
  password?: string,
) {
  const connection = getConnection(connectionId);
  if (!connection || connection.kind !== "telegram-personal" || connection.status !== "pending") {
    throw new Error("No pending personal Telegram login was found.");
  }

  const credentials = readCredentials<{
    session: string;
    phoneNumber: string;
    phoneCodeHash: string;
    apiHash?: string;
    apiId?: number;
  }>(connection);
  const client = telegramClient(credentials.session);
  await client.connect();
  try {
    let user: Api.User;
    if (password) {
      const passwordInfo = await client.invoke(new Api.account.GetPassword());
      const passwordCheck = await computeCheck(passwordInfo, password);
      const authorization = await client.invoke(
        new Api.auth.CheckPassword({ password: passwordCheck }),
      );
      if (
        authorization.className !== "auth.Authorization" ||
        authorization.user.className !== "User"
      ) {
        throw new Error("Telegram did not authorize this account.");
      }
      user = authorization.user;
    } else {
      try {
        const authorization = await client.invoke(
          new Api.auth.SignIn({
            phoneNumber: credentials.phoneNumber,
            phoneCodeHash: credentials.phoneCodeHash,
            phoneCode: code,
          }),
        );
        if (
          authorization.className !== "auth.Authorization" ||
          authorization.user.className !== "User"
        ) {
          throw new Error(
            "This Telegram account needs to be registered in the Telegram app first.",
          );
        }
        user = authorization.user;
      } catch (error) {
        if (error instanceof Error && error.message.includes("SESSION_PASSWORD_NEEDED")) {
          return { requiresPassword: true };
        }
        throw error;
      }
    }

    database()
      .prepare(
        "UPDATE connections SET label = ?, credentials = ?, status = 'connected' WHERE id = ?",
      )
      .run(
        [user.firstName, user.lastName].filter(Boolean).join(" ") || connection.label,
        encryptSecret(
          JSON.stringify({
            session: client.session.save(),
            telegramUserId: user.id.toString(),
          }),
        ),
        connectionId,
      );
    return { requiresPassword: false };
  } finally {
    await client.disconnect();
  }
}

export async function syncTelegramPersonal(connection: StoredConnection) {
  const credentials = readCredentials<{ session: string }>(connection);
  const client = telegramClient(credentials.session);
  await client.connect();
  try {
    if (!(await client.checkAuthorization())) {
      throw new Error("The personal Telegram session expired. Reconnect this account.");
    }
    const dialogs = await client.getDialogs({ limit: 50 });
    for (const dialog of dialogs) {
      if (!dialog.id || !dialog.inputEntity) continue;
      const providerChatId = dialog.id.toString();
      const saved = database()
        .prepare(
          `SELECT MAX(CAST(m.provider_message_id AS INTEGER)) AS lastMessageId
           FROM messages m
           JOIN conversations c ON c.id = m.conversation_id
           WHERE c.connection_id = ? AND c.provider_chat_id = ?`,
        )
        .get(connection.id, providerChatId) as { lastMessageId: number | null };
      const lastMessageId = saved.lastMessageId ?? 0;
      if (dialog.message?.id && dialog.message.id <= lastMessageId) continue;

      const entity = dialog.entity;
      const handle =
        entity && "username" in entity && typeof entity.username === "string"
          ? `@${entity.username}`
          : entity && "phone" in entity && typeof entity.phone === "string"
            ? entity.phone
            : "";
      for await (const message of client.iterMessages(dialog.inputEntity, {
        minId: lastMessageId,
      })) {
        if (!message.id || message.id <= lastMessageId) continue;
        const media = message.media ? await client.downloadMedia(message, {}) : undefined;
        const mediaBuffer = Buffer.isBuffer(media) ? media : undefined;
        const mediaMimeType = mediaBuffer ? "image/jpeg" : undefined;
        const mediaPath =
          mediaBuffer && mediaMimeType ? await saveImage(mediaBuffer, mediaMimeType) : undefined;
        saveMessage({
          connectionId: connection.id,
          providerChatId,
          title: dialog.title ?? dialog.name ?? "Telegram chat",
          handle,
          providerMessageId: String(message.id),
          body: message.message || (mediaPath ? "Image" : ""),
          direction: message.out ? "outbound" : "inbound",
          createdAt: Number(message.date) * 1000,
          mediaUrl: mediaPath,
          mediaMimeType,
          mediaName: mediaPath ? "image" : undefined,
        });
      }
    }
  } finally {
    await client.disconnect();
  }
}

export async function sendTelegramPersonal(
  connection: StoredConnection,
  providerChatId: string,
  body: string,
  image?: File | null,
  deleteProviderMessageId?: string,
  mediaPath?: string,
  mediaMimeType?: string,
  mediaName?: string,
) {
  const credentials = readCredentials<{ session: string }>(connection);
  const client = telegramClient(credentials.session);
  await client.connect();
  try {
    const dialogs = await client.getDialogs({ limit: 100 });
    const dialog = dialogs.find((item) => item.id?.toString() === providerChatId);
    if (!dialog) throw new Error("Telegram conversation not found in the connected account.");
    if (deleteProviderMessageId) {
      await client.deleteMessages(dialog.inputEntity, [Number(deleteProviderMessageId)], {
        revoke: true,
      });
      return deleteProviderMessageId;
    }

    const sent = image
      ? await client.sendFile(dialog.inputEntity, {
          file: new CustomFile(
            image.name || "image",
            image.size,
            "",
            Buffer.from(await image.arrayBuffer()),
          ),
          caption: body || undefined,
        })
      : await dialog.send(body);
    saveMessage({
      connectionId: connection.id,
      providerChatId,
      title: dialog.title ?? dialog.name ?? "Telegram chat",
      providerMessageId: String(sent.id),
      body: body || (mediaName ?? "Image"),
      direction: "outbound",
      createdAt: Number(sent.date) * 1000,
      mediaUrl: mediaPath,
      mediaMimeType,
      mediaName,
    });
    return String(sent.id);
  } finally {
    await client.disconnect();
  }
}

export async function sendTelegramBot(
  connection: StoredConnection,
  providerChatId: string,
  body: string,
) {
  const credentials = readCredentials<{ token: string }>(connection);
  const result = await telegramBotRequest<{ message_id: number; date: number }>(
    credentials.token,
    "sendMessage",
    { chat_id: providerChatId, text: body },
  );
  return result;
}

export async function sendTelegramBotImage(
  connection: StoredConnection,
  providerChatId: string,
  image: File,
  caption: string,
) {
  const credentials = readCredentials<{ token: string }>(connection);
  const formData = new FormData();
  formData.set("chat_id", providerChatId);
  formData.set("photo", image, image.name || "image");
  if (caption) formData.set("caption", caption);

  const response = await fetch(`https://api.telegram.org/bot${credentials.token}/sendPhoto`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });
  const result = (await response.json()) as {
    ok?: boolean;
    result?: { message_id: number; date: number };
    description?: string;
  };
  if (!response.ok || !result.ok || !result.result) {
    throw new Error(result.description ?? "Telegram rejected the image.");
  }
  return result.result;
}

export async function sendWhatsAppBusinessImage(
  connection: StoredConnection,
  recipient: string,
  image: File,
  caption: string,
) {
  const credentials = readCredentials<{ accessToken: string; phoneNumberId: string }>(connection);
  const version = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";
  const mediaForm = new FormData();
  mediaForm.set("messaging_product", "whatsapp");
  mediaForm.set("type", image.type);
  mediaForm.set("file", image, image.name || "image");
  const mediaResponse = await fetch(
    `https://graph.facebook.com/${version}/${credentials.phoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
      body: mediaForm,
      cache: "no-store",
    },
  );
  const mediaResult = (await mediaResponse.json()) as { id?: string; error?: { message?: string } };
  if (!mediaResponse.ok || !mediaResult.id) {
    throw new Error(mediaResult.error?.message ?? "WhatsApp rejected the image upload.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${version}/${credentials.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "image",
        image: { id: mediaResult.id, ...(caption ? { caption } : {}) },
      }),
      cache: "no-store",
    },
  );
  const result = (await response.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!response.ok || !result.messages?.[0]?.id) {
    throw new Error(result.error?.message ?? "WhatsApp rejected the image message.");
  }
  return result.messages[0].id;
}

export async function sendWhatsAppBusiness(
  connection: StoredConnection,
  recipient: string,
  body: string,
) {
  const credentials = readCredentials<{ accessToken: string; phoneNumberId: string }>(connection);
  const version = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";
  const response = await fetch(
    `https://graph.facebook.com/${version}/${credentials.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: { body },
      }),
      cache: "no-store",
    },
  );
  const result: unknown = await response.json();
  if (
    !response.ok ||
    typeof result !== "object" ||
    result === null ||
    !("messages" in result) ||
    !Array.isArray(result.messages) ||
    typeof result.messages[0]?.id !== "string"
  ) {
    const message =
      typeof result === "object" && result !== null && "error" in result
        ? String((result.error as { message?: string }).message ?? "WhatsApp delivery failed.")
        : "WhatsApp delivery failed.";
    throw new Error(message);
  }
  return result.messages[0].id as string;
}

export async function pollTelegramBot(connection: StoredConnection) {
  const credentials = readCredentials<{ token: string; offset: number }>(connection);
  const updates = await telegramBotRequest<
    Array<{
      update_id: number;
      message?: {
        message_id: number;
        date: number;
        text?: string;
        chat: { id: number; title?: string; username?: string; first_name?: string };
        from?: { username?: string; first_name?: string; last_name?: string };
      };
    }>
  >(credentials.token, "getUpdates", {
    offset: credentials.offset,
    timeout: 0,
    allowed_updates: ["message"],
  });

  let nextOffset = credentials.offset;
  for (const update of updates) {
    nextOffset = Math.max(nextOffset, update.update_id + 1);
    const message = update.message;
    if (!message) continue;
    if (!message.text) {
      console.warn(`Ignoring unsupported Telegram bot message ${message.message_id}.`);
      continue;
    }
    const name =
      message.chat.title ||
      [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") ||
      (message.from?.username ? `@${message.from.username}` : String(message.chat.id));
    saveMessage({
      connectionId: connection.id,
      providerChatId: String(message.chat.id),
      title: name,
      handle: message.from?.username ? `@${message.from.username}` : "",
      providerMessageId: String(message.message_id),
      body: message.text,
      direction: "inbound",
      createdAt: message.date * 1000,
    });
  }

  if (nextOffset !== credentials.offset) {
    database()
      .prepare("UPDATE connections SET credentials = ? WHERE id = ?")
      .run(encryptSecret(JSON.stringify({ ...credentials, offset: nextOffset })), connection.id);
  }
}

export async function disconnectConnection(connection: StoredConnection) {
  if (connection.kind === "telegram-bot") {
    const credentials = readCredentials<{ token: string }>(connection);
    await telegramBotRequest(credentials.token, "deleteWebhook");
  }
  if (connection.kind === "telegram-personal" && connection.status === "connected") {
    const credentials = readCredentials<{ session: string }>(connection);
    const client = telegramClient(credentials.session);
    await client.connect();
    try {
      await client.logOut();
    } finally {
      await client.disconnect();
    }
  }
  database().prepare("DELETE FROM connections WHERE id = ?").run(connection.id);
}
