import "server-only";

import Database from "better-sqlite3";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

declare global {
  var buroqDatabase: Database.Database | undefined;
  var buroqEncryptionKey: Buffer | undefined;
}

const dataDirectory = path.join(process.cwd(), "data");

function getDatabase() {
  if (globalThis.buroqDatabase) return globalThis.buroqDatabase;

  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const database = new Database(path.join(dataDirectory, "buroq.sqlite"));
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("secure_delete = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      username TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      recovery_code_hash TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN (
        'whatsapp-business',
        'telegram-bot',
        'telegram-personal'
      )),
      label TEXT NOT NULL,
      credentials TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'connected',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      provider_chat_id TEXT NOT NULL,
      title TEXT NOT NULL,
      handle TEXT NOT NULL DEFAULT '',
      last_message TEXT NOT NULL DEFAULT '',
      last_message_at INTEGER NOT NULL DEFAULT 0,
      unread_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(connection_id, provider_chat_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      provider_message_id TEXT NOT NULL,
      body TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
      created_at INTEGER NOT NULL,
      media_url TEXT,
      media_mime_type TEXT,
      media_name TEXT,
      UNIQUE(conversation_id, provider_message_id)
    );
  `);
  const userColumns = database.pragma("table_info(users)") as { name: string }[];
  if (!userColumns.some((column) => column.name === "recovery_code_hash")) {
    database.exec("ALTER TABLE users ADD COLUMN recovery_code_hash TEXT");
  }
  const messageColumns = database.pragma("table_info(messages)") as { name: string }[];
  if (!messageColumns.some((column) => column.name === "media_url")) {
    database.exec("ALTER TABLE messages ADD COLUMN media_url TEXT");
  }
  if (!messageColumns.some((column) => column.name === "media_mime_type")) {
    database.exec("ALTER TABLE messages ADD COLUMN media_mime_type TEXT");
  }
  if (!messageColumns.some((column) => column.name === "media_name")) {
    database.exec("ALTER TABLE messages ADD COLUMN media_name TEXT");
  }
  chmodSync(path.join(dataDirectory, "buroq.sqlite"), 0o600);
  globalThis.buroqDatabase = database;
  return database;
}

function getEncryptionKey() {
  if (globalThis.buroqEncryptionKey) return globalThis.buroqEncryptionKey;

  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const keyPath = path.join(dataDirectory, ".encryption-key");
  try {
    const descriptor = openSync(keyPath, "wx", 0o600);
    const key = randomBytes(32);
    try {
      writeFileSync(descriptor, key);
    } finally {
      closeSync(descriptor);
    }
    globalThis.buroqEncryptionKey = key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    globalThis.buroqEncryptionKey = readFileSync(keyPath);
    if (globalThis.buroqEncryptionKey.length !== 32) {
      throw new Error(`Invalid local encryption key at ${keyPath}`);
    }
    chmodSync(keyPath, 0o600);
  }

  return globalThis.buroqEncryptionKey;
}

export function database() {
  return getDatabase();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptSecret(value: string) {
  const payload = Buffer.from(value, "base64");
  if (payload.length < 29) throw new Error("Invalid encrypted credential.");

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}

export type ConnectionKind = "whatsapp-business" | "telegram-bot" | "telegram-personal";

export type StoredConnection = {
  id: string;
  kind: ConnectionKind;
  label: string;
  credentials: string;
  status: string;
};
