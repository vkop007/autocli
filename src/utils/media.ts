import { AutoCliError } from "../errors.js";
import { readUploadAsset } from "./upload-pipeline.js";

export interface MediaFile {
  filename: string;
  mimeType: string;
  bytes: Buffer;
}

export async function readMediaFile(path: string): Promise<MediaFile> {
  const file = await readUploadAsset(path, {
    notFoundCode: "MEDIA_NOT_FOUND",
    notFoundMessage: `Media file not found or unreadable: ${path}`,
  });

  if (file.kind !== "image") {
    throw new AutoCliError("UNSUPPORTED_MEDIA_TYPE", `Unsupported media type: ${file.extension || "unknown"}`, {
      details: {
        path,
        supportedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
      },
    });
  }

  return {
    filename: file.filename,
    mimeType: file.mimeType,
    bytes: file.bytes,
  };
}
