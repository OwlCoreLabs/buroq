import "server-only";

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  database,
  decryptSecret,
  getSetting,
  setSetting,
  type StoredConnection,
} from "@/lib/server/database";
import { emitInboxUpdate } from "@/lib/socket";
import type { NgrokStatus, TelegramBotWebhookInfo } from "@/lib/inbox";

interface ManagedNgrokState {
  process: ChildProcess | null;
  pid: number | null;
  publicUrl: string | null;
  status: "inactive" | "starting" | "active" | "error";
  port: number;
  startedAt: string | null;
  error: string | null;
  isExternal?: boolean;
}

declare global {
  var __buroqNgrokState: ManagedNgrokState | undefined;
  var __buroqPort: number | undefined;
}

function getInitialState(): ManagedNgrokState {
  return {
    process: null,
    pid: null,
    publicUrl: null,
    status: "inactive",
    port: detectServerPort(),
    startedAt: null,
    error: null,
    isExternal: false,
  };
}

export function detectServerPort(): number {
  if (globalThis.__buroqPort) return globalThis.__buroqPort;
  if (process.env.PORT && !Number.isNaN(Number(process.env.PORT))) {
    return Number(process.env.PORT);
  }
  return 8000;
}

function getNgrokState(): ManagedNgrokState {
  if (!globalThis.__buroqNgrokState) {
    globalThis.__buroqNgrokState = getInitialState();
  }
  return globalThis.__buroqNgrokState;
}

function findNgrokBinary(): string {
  if (process.env.NGROK_BIN) return process.env.NGROK_BIN;
  const candidates = ["ngrok", "/opt/homebrew/bin/ngrok", "/usr/local/bin/ngrok", "/usr/bin/ngrok"];
  for (const bin of candidates) {
    try {
      const res = spawnSync(/*turbopackIgnore: true*/ bin, ["--version"], { stdio: "pipe" });
      if (res.status === 0) return bin;
    } catch {
      // try next candidate
    }
  }
  return "ngrok";
}

export function getTelegramWebhookSecret(): string {
  const envSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (envSecret && /^[A-Za-z0-9_-]{1,256}$/.test(envSecret)) {
    return envSecret;
  }
  const saved = getSetting("telegram_webhook_secret");
  if (saved && /^[A-Za-z0-9_-]{1,256}$/.test(saved)) {
    return saved;
  }
  const generated = randomBytes(24).toString("hex");
  setSetting("telegram_webhook_secret", generated);
  return generated;
}

export function getWhatsAppVerifyToken(): string {
  const envToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (envToken && envToken.trim().length > 0) {
    return envToken.trim();
  }
  const saved = getSetting("whatsapp_verify_token");
  if (saved && saved.trim().length > 0) {
    return saved.trim();
  }
  const generated = randomBytes(16).toString("hex");
  setSetting("whatsapp_verify_token", generated);
  return generated;
}

export function getWhatsAppAppSecret(): string {
  const envSecret = process.env.WHATSAPP_APP_SECRET;
  if (envSecret && envSecret.trim().length > 0) {
    return envSecret.trim();
  }
  const saved = getSetting("whatsapp_app_secret");
  return saved ? saved.trim() : "";
}

export function saveWebhookSettings(updates: {
  whatsappVerifyToken?: string;
  whatsappAppSecret?: string;
  telegramSecret?: string;
}): void {
  if (updates.whatsappVerifyToken !== undefined) {
    const trimmed = updates.whatsappVerifyToken.trim();
    if (trimmed) setSetting("whatsapp_verify_token", trimmed);
  }
  if (updates.whatsappAppSecret !== undefined) {
    const trimmed = updates.whatsappAppSecret.trim();
    if (trimmed) setSetting("whatsapp_app_secret", trimmed);
  }
  if (updates.telegramSecret !== undefined) {
    const trimmed = updates.telegramSecret.trim();
    if (trimmed && /^[A-Za-z0-9_-]{1,256}$/.test(trimmed)) {
      setSetting("telegram_webhook_secret", trimmed);
    }
  }
}

async function queryNgrokTunnelsApi(): Promise<{ publicUrl: string; proto: string } | null> {
  try {
    const res = await fetch("http://127.0.0.1:4040/api/tunnels", {
      cache: "no-store",
      signal: AbortSignal.timeout(1200),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tunnels?: Array<{ public_url?: string; proto?: string }>;
    };
    if (!data.tunnels || !Array.isArray(data.tunnels) || data.tunnels.length === 0) {
      return null;
    }
    const httpsTunnel = data.tunnels.find((t) => t.proto === "https") || data.tunnels[0];
    if (httpsTunnel?.public_url) {
      return {
        publicUrl: httpsTunnel.public_url.replace(/\/+$/, ""),
        proto: httpsTunnel.proto || "https",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function getActiveTunnelUrl(): string | null {
  const state = getNgrokState();
  if (state.status === "active" && state.publicUrl) {
    return state.publicUrl;
  }
  return null;
}

async function callTelegramApi<T>(token: string, method: string, body?: unknown): Promise<T> {
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

function getTelegramBots(): StoredConnection[] {
  return database()
    .prepare(
      "SELECT id, kind, label, credentials, status FROM connections WHERE kind = 'telegram-bot' AND status = 'connected'",
    )
    .all() as StoredConnection[];
}

export async function syncAllTelegramBotWebhooks(
  publicUrl: string,
): Promise<TelegramBotWebhookInfo[]> {
  const bots = getTelegramBots();
  const secret = getTelegramWebhookSecret();
  const results: TelegramBotWebhookInfo[] = [];

  for (const bot of bots) {
    try {
      const credentials = JSON.parse(decryptSecret(bot.credentials)) as { token: string };
      const webhookUrl = `${publicUrl}/api/webhooks/telegram/${bot.id}`;
      await callTelegramApi(credentials.token, "setWebhook", {
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ["message"],
      });
      results.push({
        id: bot.id,
        label: bot.label,
        webhookUrl,
        synced: true,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Webhook registration failed";
      results.push({
        id: bot.id,
        label: bot.label,
        webhookUrl: null,
        synced: false,
        lastError: errorMsg,
      });
    }
  }
  return results;
}

export async function cleanupTelegramBotWebhooks(): Promise<void> {
  const bots = getTelegramBots();
  for (const bot of bots) {
    try {
      const credentials = JSON.parse(decryptSecret(bot.credentials)) as { token: string };
      await callTelegramApi(credentials.token, "deleteWebhook");
    } catch (err) {
      console.warn(`Failed to delete webhook for Telegram bot ${bot.label}:`, err);
    }
  }
}

async function getTelegramBotsStatus(
  expectedPublicUrl: string | null,
): Promise<TelegramBotWebhookInfo[]> {
  const bots = getTelegramBots();
  const results: TelegramBotWebhookInfo[] = [];

  for (const bot of bots) {
    try {
      const credentials = JSON.parse(decryptSecret(bot.credentials)) as { token: string };
      const expectedUrl = expectedPublicUrl
        ? `${expectedPublicUrl}/api/webhooks/telegram/${bot.id}`
        : null;
      const info = await callTelegramApi<{
        url?: string;
        pending_update_count?: number;
        last_error_message?: string;
      }>(credentials.token, "getWebhookInfo");

      const isSynced = Boolean(expectedUrl && info.url && info.url === expectedUrl);
      results.push({
        id: bot.id,
        label: bot.label,
        webhookUrl: info.url || null,
        synced: isSynced,
        pendingUpdateCount: info.pending_update_count ?? 0,
        lastError: info.last_error_message || undefined,
      });
    } catch (err) {
      results.push({
        id: bot.id,
        label: bot.label,
        webhookUrl: null,
        synced: false,
        lastError: err instanceof Error ? err.message : "Could not query Telegram bot webhook info",
      });
    }
  }
  return results;
}

export async function getNgrokStatus(): Promise<NgrokStatus> {
  const state = getNgrokState();
  const activeTunnel = await queryNgrokTunnelsApi();

  if (activeTunnel?.publicUrl) {
    state.publicUrl = activeTunnel.publicUrl;
    state.status = "active";
    state.error = null;
    if (!state.process) {
      state.isExternal = true;
    }
  } else {
    if (state.process && state.process.exitCode === null) {
      // Process was spawned but tunnel not ready yet or shutting down
    } else {
      state.status = "inactive";
      state.publicUrl = null;
      state.process = null;
      state.pid = null;
      state.isExternal = false;
    }
  }

  const verifyToken = getWhatsAppVerifyToken();
  const appSecret = getWhatsAppAppSecret();
  const telegramSecret = getTelegramWebhookSecret();
  const bots = await getTelegramBotsStatus(state.publicUrl);

  return {
    active: state.status === "active",
    status: state.status,
    publicUrl: state.publicUrl,
    port: state.port,
    startedAt: state.startedAt,
    error: state.error,
    isExternal: state.isExternal,
    whatsapp: {
      url: state.publicUrl ? `${state.publicUrl}/api/webhooks/whatsapp` : null,
      verifyToken,
      appSecretConfigured: Boolean(appSecret),
      verifyTokenConfigured: Boolean(verifyToken),
    },
    telegram: {
      urlTemplate: state.publicUrl
        ? `${state.publicUrl}/api/webhooks/telegram/<connectionId>`
        : null,
      secretConfigured: Boolean(telegramSecret),
      secret: telegramSecret,
      botsCount: bots.length,
      bots,
    },
  };
}

export async function startNgrok(options?: {
  port?: number;
  domain?: string;
}): Promise<NgrokStatus> {
  const state = getNgrokState();
  const targetPort = options?.port || state.port || detectServerPort();
  state.port = targetPort;

  // Check if ngrok is already active via 4040 API
  const existing = await queryNgrokTunnelsApi();
  if (existing?.publicUrl) {
    state.publicUrl = existing.publicUrl;
    state.status = "active";
    state.startedAt = state.startedAt || new Date().toISOString();
    state.error = null;
    await syncAllTelegramBotWebhooks(existing.publicUrl);
    emitInboxUpdate();
    return getNgrokStatus();
  }

  state.status = "starting";
  state.error = null;
  state.startedAt = new Date().toISOString();

  const binary = findNgrokBinary();
  const args = ["http", String(targetPort), "--log=stdout", "--log-format=json"];
  if (options?.domain) {
    args.push("--domain", options.domain);
  }

  let errorOutput = "";
  const child = spawn(/*turbopackIgnore: true*/ binary, args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  state.process = child;
  state.pid = child.pid ?? null;
  state.isExternal = false;

  child.stderr?.on("data", (chunk: Buffer) => {
    errorOutput += chunk.toString("utf8");
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    // Some versions of ngrok write errors to stdout as json
    if (text.includes('"lvl":"err"') || text.includes('"lvl":"crit"')) {
      errorOutput += " " + text;
    }
  });

  child.on("exit", (code) => {
    if (state.process === child) {
      state.process = null;
      state.pid = null;
      if (code !== 0 && code !== null) {
        state.status = "error";
        state.error = errorOutput.trim() || `ngrok process exited with code ${code}`;
        state.publicUrl = null;
        emitInboxUpdate();
      } else {
        state.status = "inactive";
        state.publicUrl = null;
        emitInboxUpdate();
      }
    }
  });

  // Poll 4040 API for tunnel creation (up to 10 seconds)
  const startTime = Date.now();
  while (Date.now() - startTime < 10_000) {
    if (child.exitCode !== null) {
      state.status = "error";
      state.error = errorOutput.trim() || `ngrok process exited with code ${child.exitCode}`;
      throw new Error(state.error);
    }

    const tunnel = await queryNgrokTunnelsApi();
    if (tunnel?.publicUrl) {
      state.publicUrl = tunnel.publicUrl;
      state.status = "active";
      state.error = null;
      await syncAllTelegramBotWebhooks(tunnel.publicUrl);
      emitInboxUpdate();
      return getNgrokStatus();
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // Timeout reached
  child.kill("SIGTERM");
  state.status = "error";
  state.error = "Timeout: ngrok did not return a public tunnel URL within 10 seconds.";
  throw new Error(state.error);
}

export async function stopNgrok(): Promise<NgrokStatus> {
  const state = getNgrokState();

  if (state.process) {
    try {
      state.process.kill("SIGTERM");
    } catch (e) {
      console.warn("Failed to kill ngrok process:", e);
    }
    state.process = null;
    state.pid = null;
  }

  // Cleanup Telegram bot webhooks so Telegram doesn't bounce requests to a dead tunnel
  try {
    await cleanupTelegramBotWebhooks();
  } catch (e) {
    console.warn("Failed to cleanup Telegram bot webhooks on stop:", e);
  }

  state.status = "inactive";
  state.publicUrl = null;
  state.error = null;
  state.isExternal = false;

  emitInboxUpdate();
  return getNgrokStatus();
}

export async function testWhatsAppWebhookVerification(): Promise<{ ok: boolean; message: string }> {
  const verifyToken = getWhatsAppVerifyToken();
  const port = detectServerPort();
  const challenge = `test_${randomBytes(6).toString("hex")}`;
  const testUrl = `http://127.0.0.1:${port}/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=${encodeURIComponent(
    challenge,
  )}&hub.verify_token=${encodeURIComponent(verifyToken)}`;

  try {
    const res = await fetch(testUrl, { cache: "no-store" });
    const text = await res.text();
    if (res.ok && text === challenge) {
      return {
        ok: true,
        message: "Verification successful! Endpoint properly returned challenge.",
      };
    }
    return {
      ok: false,
      message: `Endpoint returned HTTP ${res.status}: ${text || "Verification rejected"}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Failed to reach local webhook: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
