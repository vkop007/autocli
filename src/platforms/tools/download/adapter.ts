import { access, constants } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

import { AutoCliError, isAutoCliError } from "../../../errors.js";
import { CookieManager } from "../../../utils/cookie-manager.js";
import { getPlatformCookieDomain, isPlatform } from "../../config.js";

import type { AdapterActionResult, Platform, PlatformSession } from "../../../types.js";
import type { PlatformName } from "../../config.js";

type DownloadAuthInput = {
  cookiesPath?: string;
  sessionPlatform?: string;
  account?: string;
};

type DownloadInfoInput = DownloadAuthInput & {
  url: string;
};

type DownloadVideoInput = DownloadAuthInput & {
  url: string;
  outputDir?: string;
  filenameTemplate?: string;
  format?: string;
  quality?: string;
};

type DownloadAudioInput = DownloadAuthInput & {
  url: string;
  outputDir?: string;
  filenameTemplate?: string;
  format?: string;
  audioFormat?: string;
};

type YtDlpFormat = {
  format_id?: string;
  ext?: string;
  height?: number;
  width?: number;
  fps?: number;
  tbr?: number;
  abr?: number;
  vcodec?: string;
  acodec?: string;
};

type YtDlpInfo = {
  id?: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  extractor?: string;
  webpage_url?: string;
  original_url?: string;
  formats?: YtDlpFormat[];
};

type PreparedAuth = {
  args: string[];
  cleanup: () => Promise<void>;
  source?: string;
};

export type DownloadFormatSummary = {
  id: string;
  label: string;
  ext?: string;
  height?: number;
  fps?: number;
  hasAudio: boolean;
};

export class DownloadToolsAdapter {
  readonly platform = "download" as Platform;
  readonly displayName = "Download";

  private readonly cookieManager = new CookieManager();

  async info(input: DownloadInfoInput): Promise<AdapterActionResult> {
    const url = normalizeDownloadUrl(input.url);
    await this.requireCommand("yt-dlp", ["--version"], "YTDLP_NOT_FOUND", "yt-dlp is required for tools download info.");
    const auth = await this.prepareAuth(input);

    try {
      const { stdout } = await this.runProcess("yt-dlp", [
        "--no-playlist",
        "--no-warnings",
        "--dump-single-json",
        ...auth.args,
        url,
      ]);
      const info = parseYtDlpInfo(stdout);
      const formats = summarizeDownloadFormats(info.formats ?? []);

      return {
        ok: true,
        platform: this.platform,
        account: auth.source ?? "public",
        action: "info",
        message: `Loaded download info${info.title ? ` for ${info.title}` : ""}.`,
        id: info.id,
        url: info.webpage_url ?? info.original_url ?? url,
        data: {
          title: info.title ?? null,
          thumbnail: info.thumbnail ?? null,
          durationSeconds: info.duration ?? null,
          durationLabel: typeof info.duration === "number" ? formatDuration(info.duration) : null,
          uploader: info.uploader ?? null,
          extractor: info.extractor ?? null,
          formats,
          meta: {
            listKey: "formats",
            count: formats.length,
          },
          auth: auth.source ? { source: auth.source } : undefined,
        },
      };
    } catch (error) {
      if (isAutoCliError(error)) {
        throw error;
      }

      throw new AutoCliError("DOWNLOAD_INFO_FAILED", "Failed to fetch media info with yt-dlp.", {
        cause: error,
        details: { url },
      });
    } finally {
      await auth.cleanup();
    }
  }

  async video(input: DownloadVideoInput): Promise<AdapterActionResult> {
    const url = normalizeDownloadUrl(input.url);
    const outputDir = resolve(input.outputDir ?? join(process.cwd(), "downloads", "download"));
    const filenameTemplate = (input.filenameTemplate?.trim() || "%(title)s [%(id)s].%(ext)s");
    const format = buildVideoFormatSelector(input);

    await this.requireCommand("yt-dlp", ["--version"], "YTDLP_NOT_FOUND", "yt-dlp is required for tools download video.");
    await this.requireCommand("ffmpeg", ["-version"], "FFMPEG_NOT_FOUND", "ffmpeg is required for tools download video.");
    await mkdir(outputDir, { recursive: true });

    const auth = await this.prepareAuth(input);

    try {
      const { stdout, stderr } = await this.runProcess("yt-dlp", [
        "--no-playlist",
        "--no-simulate",
        "--no-progress",
        "--no-warnings",
        "--print",
        "after_move:filepath",
        "--output",
        join(outputDir, filenameTemplate),
        "--format",
        format,
        "--merge-output-format",
        "mp4",
        ...auth.args,
        url,
      ]);
      const outputPath = extractDownloadedPath(stdout);

      return {
        ok: true,
        platform: this.platform,
        account: auth.source ?? "public",
        action: "video",
        message: "Media download completed.",
        url,
        data: {
          outputPath,
          outputDir,
          format,
          quality: normalizeQualityLabel(input.quality),
          stderr: stderr || undefined,
          auth: auth.source ? { source: auth.source } : undefined,
        },
      };
    } catch (error) {
      if (isAutoCliError(error)) {
        throw error;
      }

      throw new AutoCliError("DOWNLOAD_VIDEO_FAILED", "Failed to download video with yt-dlp.", {
        cause: error,
        details: { url, format },
      });
    } finally {
      await auth.cleanup();
    }
  }

  async audio(input: DownloadAudioInput): Promise<AdapterActionResult> {
    const url = normalizeDownloadUrl(input.url);
    const outputDir = resolve(input.outputDir ?? join(process.cwd(), "downloads", "download"));
    const filenameTemplate = (input.filenameTemplate?.trim() || "%(title)s [%(id)s].%(ext)s");
    const format = input.format?.trim() || "bestaudio/best";
    const audioFormat = (input.audioFormat?.trim() || "mp3").toLowerCase();

    await this.requireCommand("yt-dlp", ["--version"], "YTDLP_NOT_FOUND", "yt-dlp is required for tools download audio.");
    await this.requireCommand("ffmpeg", ["-version"], "FFMPEG_NOT_FOUND", "ffmpeg is required for tools download audio.");
    await mkdir(outputDir, { recursive: true });

    const auth = await this.prepareAuth(input);

    try {
      const { stdout, stderr } = await this.runProcess("yt-dlp", [
        "--no-playlist",
        "--no-simulate",
        "--no-progress",
        "--no-warnings",
        "--print",
        "after_move:filepath",
        "--output",
        join(outputDir, filenameTemplate),
        "--format",
        format,
        "--extract-audio",
        "--audio-format",
        audioFormat,
        ...auth.args,
        url,
      ]);
      const outputPath = extractDownloadedPath(stdout);

      return {
        ok: true,
        platform: this.platform,
        account: auth.source ?? "public",
        action: "audio",
        message: "Audio download completed.",
        url,
        data: {
          outputPath,
          outputDir,
          format,
          audioFormat,
          stderr: stderr || undefined,
          auth: auth.source ? { source: auth.source } : undefined,
        },
      };
    } catch (error) {
      if (isAutoCliError(error)) {
        throw error;
      }

      throw new AutoCliError("DOWNLOAD_AUDIO_FAILED", "Failed to download audio with yt-dlp.", {
        cause: error,
        details: { url, format, audioFormat },
      });
    } finally {
      await auth.cleanup();
    }
  }

  private async prepareAuth(input: DownloadAuthInput): Promise<PreparedAuth> {
    const hasCookiesPath = Boolean(input.cookiesPath?.trim());
    const hasSessionPlatform = Boolean(input.sessionPlatform?.trim());

    if (hasCookiesPath && hasSessionPlatform) {
      throw new AutoCliError(
        "DOWNLOAD_AUTH_CONFLICT",
        "Use either --cookies or --platform/--account, not both.",
      );
    }

    if (!hasCookiesPath && input.account?.trim()) {
      throw new AutoCliError(
        "DOWNLOAD_PLATFORM_REQUIRED",
        "Use --platform <provider> with --account when reusing a saved AutoCLI session.",
      );
    }

    if (hasCookiesPath) {
      const cookiesPath = resolve(input.cookiesPath!.trim());
      await this.ensureReadableFile(cookiesPath, "DOWNLOAD_COOKIES_NOT_FOUND", "Cookies file not found or unreadable.");
      return {
        args: ["--cookies", cookiesPath],
        cleanup: async () => undefined,
        source: `cookies:${cookiesPath}`,
      };
    }

    if (hasSessionPlatform) {
      const sessionPlatform = input.sessionPlatform!.trim();
      if (!isPlatform(sessionPlatform) || sessionPlatform === "download") {
        throw new AutoCliError("DOWNLOAD_PLATFORM_INVALID", `Unknown provider "${sessionPlatform}" for --platform.`, {
          details: { platform: sessionPlatform },
        });
      }

      const { session } = await this.cookieManager.loadSession(sessionPlatform, input.account?.trim() || undefined);
      const tempDir = await mkdtemp(join(tmpdir(), "autocli-download-cookies-"));
      const cookiesPath = join(tempDir, "cookies.txt");
      await writeFile(cookiesPath, buildNetscapeCookies(session), "utf8");

      return {
        args: ["--cookies", cookiesPath],
        cleanup: async () => {
          await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
        },
        source: `${sessionPlatform}:${session.account}`,
      };
    }

    return {
      args: [],
      cleanup: async () => undefined,
    };
  }

  private async ensureReadableFile(path: string, code: string, message: string): Promise<void> {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      access(path, constants.R_OK, (error) => {
        if (!error) {
          resolvePromise();
          return;
        }

        rejectPromise(new AutoCliError(code, message, { details: { path } }));
      });
    });
  }

  private async requireCommand(
    command: string,
    args: string[],
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.runProcess(command, args);
    } catch (error) {
      if (
        error instanceof Error &&
        "cause" in error &&
        error.cause &&
        typeof error.cause === "object" &&
        "code" in error.cause &&
        error.cause.code === "ENOENT"
      ) {
        throw new AutoCliError(errorCode, errorMessage, {
          details: { command },
          cause: error,
        });
      }

      throw error;
    }
  }

  private async runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("error", (error) => {
        rejectPromise(new Error(`Failed to start ${command}.`, { cause: error }));
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolvePromise({ stdout, stderr });
          return;
        }

        rejectPromise(
          new AutoCliError("PROCESS_FAILED", `${command} exited with code ${code ?? "unknown"}.`, {
            details: {
              command,
              args,
              code: code ?? undefined,
              stderr: stderr || undefined,
            },
          }),
        );
      });
    });
  }
}

export const downloadToolsAdapter = new DownloadToolsAdapter();

export function normalizeDownloadUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AutoCliError("DOWNLOAD_URL_REQUIRED", "A media URL is required.");
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    throw new AutoCliError("DOWNLOAD_URL_INVALID", `Invalid media URL "${value}".`);
  }
}

export function summarizeDownloadFormats(formats: readonly YtDlpFormat[]): DownloadFormatSummary[] {
  const bestByHeight = new Map<number, YtDlpFormat>();

  for (const format of formats) {
    if (!format.format_id || !format.height || format.vcodec === "none") {
      continue;
    }

    const current = bestByHeight.get(format.height);
    const bitrate = format.tbr ?? 0;
    const currentBitrate = current?.tbr ?? 0;
    if (!current || bitrate > currentBitrate) {
      bestByHeight.set(format.height, format);
    }
  }

  return [...bestByHeight.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([, format]) => ({
      id: format.format_id!,
      label: buildFormatLabel(format),
      ext: format.ext,
      height: format.height,
      fps: format.fps,
      hasAudio: format.acodec !== "none",
    }));
}

export function buildVideoFormatSelector(input: {
  format?: string;
  quality?: string;
}): string {
  const explicitFormat = input.format?.trim();
  if (explicitFormat) {
    return explicitFormat;
  }

  const height = parseQualityHeight(input.quality);
  if (!height) {
    return "bestvideo*+bestaudio/best";
  }

  return `bestvideo*[height<=${height}]+bestaudio/best`;
}

function parseQualityHeight(value?: string): number | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\d{3,4})(?:p)?$/iu);
  if (!match) {
    throw new AutoCliError(
      "DOWNLOAD_QUALITY_INVALID",
      `Invalid quality "${value}". Use a resolution like 720p or 1080.`,
    );
  }

  const heightToken = match[1];
  if (!heightToken) {
    throw new AutoCliError(
      "DOWNLOAD_QUALITY_INVALID",
      `Invalid quality "${value}". Use a resolution like 720p or 1080.`,
    );
  }

  return Number.parseInt(heightToken, 10);
}

function parseYtDlpInfo(stdout: string): YtDlpInfo {
  try {
    return JSON.parse(stdout) as YtDlpInfo;
  } catch (error) {
    throw new AutoCliError("DOWNLOAD_INFO_PARSE_FAILED", "yt-dlp did not return valid media metadata.", {
      cause: error,
    });
  }
}

function buildFormatLabel(format: YtDlpFormat): string {
  const parts = [`${format.height}p`];
  if (format.fps && format.fps > 0) {
    parts.push(`${Math.round(format.fps)}fps`);
  }
  if (format.ext) {
    parts.push(format.ext);
  }
  if (format.acodec === "none") {
    parts.push("video-only");
  }
  return parts.join(" ");
}

function extractDownloadedPath(stdout: string): string {
  const lines = stdout
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean);

  const outputPath = lines.at(-1);
  if (!outputPath) {
    throw new AutoCliError("DOWNLOAD_OUTPUT_MISSING", "yt-dlp completed but did not report an output file path.");
  }

  return outputPath;
}

function buildNetscapeCookies(session: PlatformSession): string {
  const header = ["# Netscape HTTP Cookie File", "# This file was generated by AutoCLI.", ""];
  const cookies = Array.isArray(session.cookieJar.cookies) ? session.cookieJar.cookies : [];
  const fallbackDomain = getFallbackCookieDomain(session.platform);

  const lines = cookies
    .filter(
      (cookie): cookie is {
        key: string;
        value: string;
        domain?: string;
        path?: string;
        secure?: boolean;
        expires?: string | number | Date;
      } => Boolean(cookie && typeof cookie.key === "string" && typeof cookie.value === "string"),
    )
    .map((cookie) => {
      const domain = cookie.domain ?? fallbackDomain;
      const includeSubdomains = domain.startsWith(".") ? "TRUE" : "FALSE";
      const path = cookie.path ?? "/";
      const secure = cookie.secure ? "TRUE" : "FALSE";
      const expires = toNetscapeExpiry(cookie.expires);
      return [domain, includeSubdomains, path, secure, String(expires), cookie.key, cookie.value].join("\t");
    });

  return [...header, ...lines, ""].join("\n");
}

function getFallbackCookieDomain(platform: PlatformName): string {
  const domain = getPlatformCookieDomain(platform);
  return domain.startsWith(".") ? domain : `.${domain}`;
}

function toNetscapeExpiry(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value / 1_000) : Math.floor(value);
  }

  if (typeof value === "string") {
    if (!value || value === "Infinity") {
      return 0;
    }

    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) {
      return asNumber > 10_000_000_000 ? Math.floor(asNumber / 1_000) : Math.floor(asNumber);
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1_000);
  }

  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1_000);
  }

  return 0;
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function normalizeQualityLabel(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const height = parseQualityHeight(value);
  return `${height}p`;
}
