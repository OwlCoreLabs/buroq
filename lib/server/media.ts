import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const mediaDirectory = path.join(process.cwd(), "data", "media");
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function isSupportedImage(type: string) {
  return allowedImageTypes.has(type.toLowerCase());
}

export function mediaUrl(filePath: string, messageId: number) {
  if (!filePath.startsWith(`${mediaDirectory}${path.sep}`)) throw new Error("Invalid media path.");
  return `/api/media/${messageId}`;
}

export async function saveImage(data: Buffer, mimeType: string) {
  if (!isSupportedImage(mimeType))
    throw new Error("Only JPEG, PNG, GIF, and WebP images are supported.");
  if (data.length > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.");

  await mkdir(mediaDirectory, { recursive: true, mode: 0o700 });
  const extension = mimeType.split("/", 2)[1] === "jpeg" ? "jpg" : mimeType.split("/", 2)[1];
  const filePath = path.join(mediaDirectory, `${randomBytes(16).toString("hex")}.${extension}`);
  await writeFile(filePath, data, { mode: 0o600 });
  return filePath;
}

export async function readImage(filePath: string) {
  if (!filePath.startsWith(`${mediaDirectory}${path.sep}`)) throw new Error("Invalid media path.");
  return readFile(filePath);
}

export async function deleteImage(filePath: string | null | undefined) {
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
