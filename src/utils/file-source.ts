import { readUploadAsset } from "./upload-pipeline.js";

export interface UploadFileSource {
  path: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
  size: number;
}

export async function readUploadFile(path: string): Promise<UploadFileSource> {
  return readUploadAsset(path);
}
