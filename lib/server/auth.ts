import "server-only";

import { cookies } from "next/headers";
import { promisify } from "node:util";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { database } from "./database";

const scrypt = promisify(scryptCallback);
const cookieName = "buroq_session";
const sessionDurationSeconds = 60 * 60 * 24 * 30;

type UserRecord = {
  username: string;
  password_salt: string;
  password_hash: string;
  recovery_code_hash: string | null;
};

function sessionHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashRecoveryCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function validatePassword(password: string) {
  if (password.length < 1 || password.length > 256) {
    throw new Error("Password must be between 1 and 256 characters.");
  }
}

async function passwordMatches(user: UserRecord, password: string) {
  const expectedHash = Buffer.from(user.password_hash, "hex");
  const candidateHash = (await scrypt(
    password,
    Buffer.from(user.password_salt, "hex"),
    64,
  )) as Buffer;
  return (
    expectedHash.length === candidateHash.length && timingSafeEqual(expectedHash, candidateHash)
  );
}

function createRecoveryCode() {
  return randomBytes(24).toString("hex");
}

async function issueSession() {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationSeconds;
  database()
    .prepare("INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)")
    .run(sessionHash(token), expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionDurationSeconds,
  });
}

export function isAccountConfigured() {
  return Boolean(database().prepare("SELECT 1 FROM users WHERE id = 1").get());
}

export async function createLocalAccount(username: string, password: string) {
  const normalizedUsername = username.trim();
  if (normalizedUsername.length < 3 || normalizedUsername.length > 64) {
    throw new Error("Username must be between 3 and 64 characters.");
  }
  validatePassword(password);

  const passwordSalt = randomBytes(16);
  const passwordHash = (await scrypt(password, passwordSalt, 64)) as Buffer;
  const recoveryCode = createRecoveryCode();
  const result = database()
    .prepare(
      `INSERT OR IGNORE INTO users
        (id, username, password_salt, password_hash, recovery_code_hash)
       VALUES (1, ?, ?, ?, ?)`,
    )
    .run(
      normalizedUsername,
      passwordSalt.toString("hex"),
      passwordHash.toString("hex"),
      hashRecoveryCode(recoveryCode),
    );
  if (result.changes !== 1) {
    throw new Error("The local account has already been created. Please sign in.");
  }
  return recoveryCode;
}

export async function loginLocalAccount(username: string, password: string) {
  const user = database()
    .prepare(
      "SELECT username, password_salt, password_hash, recovery_code_hash FROM users WHERE id = 1",
    )
    .get() as UserRecord | undefined;

  if (!user) throw new Error("The local account has not been set up yet.");
  if (!(await passwordMatches(user, password))) throw new Error("Incorrect username or password.");
  if (user.username !== username.trim()) throw new Error("Incorrect username or password.");

  await issueSession();
  if (user.recovery_code_hash) return null;

  const recoveryCode = createRecoveryCode();
  database()
    .prepare("UPDATE users SET recovery_code_hash = ? WHERE id = 1 AND recovery_code_hash IS NULL")
    .run(hashRecoveryCode(recoveryCode));
  return recoveryCode;
}

export async function resetLocalPassword(
  username: string,
  recoveryCode: string,
  newPassword: string,
) {
  validatePassword(newPassword);
  const user = database()
    .prepare(
      "SELECT username, password_salt, password_hash, recovery_code_hash FROM users WHERE id = 1",
    )
    .get() as UserRecord | undefined;
  if (!user || user.username !== username.trim() || !user.recovery_code_hash) {
    throw new Error("Username or recovery code is incorrect.");
  }

  const expected = Buffer.from(user.recovery_code_hash, "hex");
  const candidate = Buffer.from(hashRecoveryCode(recoveryCode.trim()), "hex");
  if (expected.length !== candidate.length || !timingSafeEqual(expected, candidate)) {
    throw new Error("Username or recovery code is incorrect.");
  }

  const passwordSalt = randomBytes(16);
  const passwordHash = (await scrypt(newPassword, passwordSalt, 64)) as Buffer;
  const databaseHandle = database();
  const reset = databaseHandle.transaction(() => {
    databaseHandle
      .prepare("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = 1")
      .run(passwordSalt.toString("hex"), passwordHash.toString("hex"));
    databaseHandle.prepare("DELETE FROM sessions").run();
  });
  reset();
}

export async function deleteLocalAccount(password: string) {
  const user = database()
    .prepare(
      "SELECT username, password_salt, password_hash, recovery_code_hash FROM users WHERE id = 1",
    )
    .get() as UserRecord | undefined;
  if (!user || !(await passwordMatches(user, password))) {
    throw new Error("Incorrect password. The account was not deleted.");
  }

  const databaseHandle = database();
  const removeAccount = databaseHandle.transaction(() => {
    databaseHandle.prepare("DELETE FROM connections").run();
    databaseHandle.prepare("DELETE FROM sessions").run();
    databaseHandle.prepare("DELETE FROM users WHERE id = 1").run();
  });
  removeAccount();
  databaseHandle.pragma("wal_checkpoint(TRUNCATE)");

  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (!token) return null;

  const hash = sessionHash(token);
  const session = database()
    .prepare("SELECT expires_at FROM sessions WHERE token_hash = ?")
    .get(hash) as { expires_at: number } | undefined;
  if (!session) return null;

  if (session.expires_at <= Math.floor(Date.now() / 1000)) {
    database().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash);
    return null;
  }

  return database().prepare("SELECT username FROM users WHERE id = 1").get() as
    { username: string } | undefined;
}

export async function requireLocalUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function logoutLocalAccount() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (token) {
    database().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sessionHash(token));
  }
  cookieStore.delete(cookieName);
}
