import { randomBytes } from "node:crypto";
import WebSocket, { type RawData } from "ws";

import { AutoCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { formatSpotifyDuration, spotifyUriToUrl } from "./helpers.js";
import {
  SPOTIFY_APP_PLATFORM,
  SPOTIFY_CLIENT_TOKEN_ENDPOINT,
  SPOTIFY_CONNECT_DEVICE_MODEL,
  SPOTIFY_CONNECT_DEVICE_NAME,
  SPOTIFY_CONNECT_STATE_BASE,
  SPOTIFY_CONNECT_VERSION,
  SPOTIFY_DEALER_URL,
  SPOTIFY_TRACK_PLAYBACK_BASE,
  SPOTIFY_USER_AGENT,
} from "./constants.js";

import type { SpotifyRepeatState } from "./options.js";
import type { SpotifyEntityType } from "../../../utils/targets.js";

type JsonRecord = Record<string, unknown>;

type SpotifyConnectAuth = {
  accessToken: string;
  clientId: string;
  clientVersion: string;
  deviceId: string;
};

type SpotifyConnectState = {
  raw: JsonRecord;
  playerState?: JsonRecord;
  devices: Record<string, unknown>;
  activeDeviceId?: string;
  originDeviceId?: string;
};

export type SpotifyConnectDeviceSummary = {
  id: string;
  name?: string;
  type?: string;
  isActive: boolean;
  isPrivateSession: boolean;
  isRestricted: boolean;
  volumePercent?: number;
  supportsVolume?: boolean;
};

export type SpotifyConnectTrackSummary = {
  id?: string;
  title?: string;
  artists?: string;
  album?: string;
  duration?: string;
  uri?: string;
  url?: string;
};

export type SpotifyConnectPlaybackSummary = {
  isPlaying: boolean;
  repeatState?: string;
  shuffleState?: string;
  progress?: string;
  progressMs?: number;
  currentlyPlayingType?: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  contextUri?: string;
  contextUrl?: string;
  title?: string;
  artists?: string;
  album?: string;
  duration?: string;
  trackId?: string;
  trackUrl?: string;
};

export type SpotifyConnectQueueSummary = {
  current?: SpotifyConnectTrackSummary;
  queue: SpotifyConnectTrackSummary[];
};

export class SpotifyConnectClient {
  private clientToken?: string;
  private clientTokenExpiresAt?: number;
  private readonly connectDeviceId = randomHex(32);
  private connectionId?: string;
  private connectionRegisteredAt?: number;

  constructor(
    private readonly client: SessionHttpClient,
    private readonly auth: SpotifyConnectAuth,
  ) {}

  async devices(): Promise<SpotifyConnectDeviceSummary[]> {
    const state = await this.getState();
    return this.mapDevices(state);
  }

  async status(): Promise<SpotifyConnectPlaybackSummary> {
    const state = await this.getState();
    return this.mapPlayback(state);
  }

  async queue(): Promise<SpotifyConnectQueueSummary> {
    const state = await this.getState();
    return this.mapQueue(state);
  }

  async transfer(target: string): Promise<SpotifyConnectDeviceSummary> {
    const state = await this.getState();
    const device = this.resolveDevice(state, target);
    const fromId = state.originDeviceId ?? state.activeDeviceId;
    if (!fromId) {
      throw new AutoCliError(
        "SPOTIFY_CONNECT_TRANSFER_SOURCE_MISSING",
        "Spotify Connect could not determine the current playback source device.",
        {
          details: {
            target,
          },
        },
      );
    }

    await this.sendConnectCommand(
      `${SPOTIFY_CONNECT_STATE_BASE}/connect/transfer/from/${encodeURIComponent(fromId)}/to/${encodeURIComponent(device.id)}`,
      {
        transfer_options: {
          restore_paused: "resume",
        },
        command_id: randomHex(32),
      },
    );

    return device;
  }

  async play(target?: { type: SpotifyEntityType; id: string }): Promise<void> {
    if (!target) {
      await this.sendStateCommand("resume");
      return;
    }

    const uri = `spotify:${target.type}:${target.id}`;
    const command: JsonRecord = {
      endpoint: "play",
      logging_params: {
        command_id: randomHex(32),
      },
      context: {
        uri,
        url: `context://${uri}`,
      },
    };

    if (!isContextUri(uri)) {
      command.options = {
        skip_to: {
          track_uri: uri,
        },
      };
    }

    await this.sendPlayerCommand(await this.getState(), {
      command,
    });
  }

  async pause(): Promise<void> {
    await this.sendStateCommand("pause");
  }

  async next(): Promise<void> {
    await this.sendStateCommand("skip_next");
  }

  async previous(): Promise<void> {
    await this.sendStateCommand("skip_prev");
  }

  async seek(positionMs: number): Promise<void> {
    await this.sendStateCommand("seek_to", {
      command: {
        endpoint: "seek_to",
        value: Math.max(0, positionMs),
        logging_params: {
          command_id: randomHex(32),
        },
      },
    });
  }

  async volume(volumePercent: number): Promise<void> {
    const state = await this.getState();
    const fromId = state.originDeviceId ?? state.activeDeviceId;
    if (!fromId || !state.activeDeviceId) {
      throw new AutoCliError("SPOTIFY_CONNECT_DEVICE_NOT_FOUND", "Spotify Connect could not determine an active device.", {
        details: {
          activeDeviceId: state.activeDeviceId,
          originDeviceId: state.originDeviceId,
        },
      });
    }

    await this.sendConnectCommand(
      `${SPOTIFY_CONNECT_STATE_BASE}/connect/volume/from/${encodeURIComponent(fromId)}/to/${encodeURIComponent(state.activeDeviceId)}`,
      {
        volume: Math.round((clamp(volumePercent, 0, 100) / 100) * 65535),
      },
    );
  }

  async shuffle(enabled: boolean): Promise<void> {
    await this.sendStateCommand("set_shuffling_context", {
      command: {
        endpoint: "set_shuffling_context",
        value: enabled,
        logging_params: {
          command_id: randomHex(32),
        },
      },
    });
  }

  async repeat(mode: SpotifyRepeatState): Promise<void> {
    const command: JsonRecord = {
      endpoint: "set_options",
      logging_params: {
        command_id: randomHex(32),
      },
      repeating_track: mode === "track",
      repeating_context: mode === "context",
    };
    await this.sendStateCommand("set_options", { command });
  }

  async queueAdd(trackId: string): Promise<void> {
    await this.sendStateCommand("add_to_queue", {
      command: {
        endpoint: "add_to_queue",
        track: {
          uri: `spotify:track:${trackId}`,
        },
        logging_params: {
          command_id: randomHex(32),
        },
      },
    });
  }

  private async sendStateCommand(endpoint: string, payload?: JsonRecord): Promise<void> {
    const state = await this.getState();
    const body = payload ?? {
      command: {
        endpoint,
        logging_params: {
          command_id: randomHex(32),
        },
      },
    };
    await this.sendPlayerCommand(state, body);
  }

  private async sendPlayerCommand(state: SpotifyConnectState, payload: JsonRecord): Promise<void> {
    const fromId = state.originDeviceId ?? this.connectDeviceId ?? state.activeDeviceId;
    if (!fromId || !state.activeDeviceId) {
      throw new AutoCliError("SPOTIFY_CONNECT_DEVICE_NOT_FOUND", "Spotify Connect could not determine an active device.", {
        details: {
          activeDeviceId: state.activeDeviceId,
          originDeviceId: state.originDeviceId,
        },
      });
    }

    await this.sendConnectCommand(
      `${SPOTIFY_CONNECT_STATE_BASE}/player/command/from/${encodeURIComponent(fromId)}/to/${encodeURIComponent(state.activeDeviceId)}`,
      payload,
    );
  }

  private async sendConnectCommand(url: string, body: JsonRecord): Promise<void> {
    await this.request(url, {
      method: "POST",
      headers: await this.createConnectHeaders({
        contentType: "application/json",
      }),
      body: JSON.stringify(body),
      expectedStatus: [200, 202, 204],
      responseType: "text",
    });
  }

  private async getState(): Promise<SpotifyConnectState> {
    await this.ensureConnectRegistration();

    const response = await this.request<JsonRecord>(
      `${SPOTIFY_CONNECT_STATE_BASE}/devices/hobs_${encodeURIComponent(this.connectDeviceId)}`,
      {
        method: "PUT",
        headers: await this.createConnectHeaders({
          contentType: "application/json",
          connectionId: this.connectionId,
        }),
        body: JSON.stringify({
          member_type: "CONNECT_STATE",
          device: {
            device_info: {
              capabilities: {
                can_be_player: false,
                hidden: true,
                needs_full_player_state: true,
              },
            },
          },
        }),
        expectedStatus: 200,
      },
    );

    const devices = asRecord(response.devices) ?? {};
    const playerState = asRecord(response.player_state);
    const activeDeviceId = getString(response, "active_device_id") || detectActiveDeviceId(devices);
    const originDeviceId = mapPlayOriginId(playerState);

    return {
      raw: response,
      playerState,
      devices,
      activeDeviceId: activeDeviceId || undefined,
      originDeviceId: originDeviceId || undefined,
    };
  }

  private async ensureConnectRegistration(): Promise<void> {
    const now = Date.now();
    if (this.connectionId && this.connectionRegisteredAt && now - this.connectionRegisteredAt < 9 * 60 * 1000) {
      return;
    }

    const connectionId = await this.getConnectionId();
    await this.registerDevice(connectionId);
    this.connectionId = connectionId;
    this.connectionRegisteredAt = now;
  }

  private async registerDevice(connectionId: string): Promise<void> {
    await this.request(`${SPOTIFY_TRACK_PLAYBACK_BASE}/devices`, {
      method: "POST",
      headers: await this.createConnectHeaders({
        contentType: "application/json",
      }),
      body: JSON.stringify({
        device: {
          device_id: this.connectDeviceId,
          device_type: "computer",
          brand: "spotify",
          model: SPOTIFY_CONNECT_DEVICE_MODEL,
          name: SPOTIFY_CONNECT_DEVICE_NAME,
          is_group: false,
          metadata: {},
          platform_identifier: `web_player ${runtimeOs()};autocli`,
          capabilities: {
            change_volume: true,
            supports_file_media_type: true,
            enable_play_token: true,
            play_token_lost_behavior: "pause",
            disable_connect: false,
            audio_podcasts: true,
            video_playback: true,
            manifest_formats: ["file_ids_mp3", "file_urls_mp3", "file_ids_mp4", "manifest_ids_video"],
          },
        },
        outro_endcontent_snooping: false,
        connection_id: connectionId,
        client_version: SPOTIFY_CONNECT_VERSION,
        volume: 65535,
      }),
      expectedStatus: [200, 201, 202, 204],
      responseType: "text",
    });
  }

  private async getConnectionId(): Promise<string> {
    const url = new URL(SPOTIFY_DEALER_URL);
    url.searchParams.set("access_token", this.auth.accessToken);

    return await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(url.toString(), {
        headers: {
          "user-agent": SPOTIFY_USER_AGENT,
        },
      });

      const timer = setTimeout(() => {
        socket.close();
        reject(
          new AutoCliError("SPOTIFY_CONNECT_DEALER_TIMEOUT", "Spotify Connect dealer handshake timed out.", {
            details: {
              url: url.toString(),
            },
          }),
        );
      }, 10_000);

      socket.once("message", (data: RawData) => {
        clearTimeout(timer);
        try {
          const text = rawDataToText(data);
          const payload = JSON.parse(text) as JsonRecord;
          const headers = asRecord(payload.headers);
          const connectionId = findCaseInsensitiveString(headers, "Spotify-Connection-Id");
          if (!connectionId) {
            reject(
              new AutoCliError("SPOTIFY_CONNECT_DEALER_INVALID", "Spotify Connect dealer response did not include a connection id.", {
                details: {
                  payload,
                },
              }),
            );
            return;
          }

          resolve(connectionId);
        } catch (error) {
          reject(
            new AutoCliError("SPOTIFY_CONNECT_DEALER_INVALID", "Spotify Connect dealer returned an invalid handshake payload.", {
              cause: error,
            }),
          );
        } finally {
          socket.close();
        }
      });

      socket.once("error", (error: Error) => {
        clearTimeout(timer);
        reject(
          new AutoCliError("SPOTIFY_CONNECT_DEALER_FAILED", "Spotify Connect dealer handshake failed.", {
            cause: error,
            details: {
              url: url.toString(),
            },
          }),
        );
      });
    });
  }

  private async ensureClientToken(): Promise<string> {
    if (this.clientToken && this.clientTokenExpiresAt && this.clientTokenExpiresAt - Date.now() > 60_000) {
      return this.clientToken;
    }

    const response = await this.request<{
      granted_token?: {
        token?: string;
        expires_in?: number;
      };
    }>(SPOTIFY_CLIENT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": SPOTIFY_USER_AGENT,
      },
      body: JSON.stringify({
        client_data: {
          client_version: this.auth.clientVersion,
          client_id: this.auth.clientId,
          js_sdk_data: {
            device_brand: "unknown",
            device_model: "unknown",
            os: runtimeOs(),
            os_version: "unknown",
            device_id: this.auth.deviceId,
            device_type: "computer",
          },
        },
      }),
      expectedStatus: 200,
    });

    const token = response.granted_token?.token;
    if (!token) {
      throw new AutoCliError("SPOTIFY_CONNECT_CLIENT_TOKEN_MISSING", "Spotify client-token bootstrap did not return a token.");
    }

    this.clientToken = token;
    this.clientTokenExpiresAt = Date.now() + Math.max(300, response.granted_token?.expires_in ?? 1800) * 1000;
    return token;
  }

  private async createConnectHeaders(input: {
    contentType?: string;
    connectionId?: string;
  }): Promise<Record<string, string>> {
    const clientToken = await this.ensureClientToken();
    const headers: Record<string, string> = {
      accept: "application/json",
      authorization: `Bearer ${this.auth.accessToken}`,
      "client-token": clientToken,
      "spotify-app-version": SPOTIFY_CONNECT_VERSION,
      "app-platform": SPOTIFY_APP_PLATFORM,
      "user-agent": SPOTIFY_USER_AGENT,
    };

    if (input.contentType) {
      headers["content-type"] = input.contentType;
    }

    if (input.connectionId) {
      headers["x-spotify-connection-id"] = input.connectionId;
    }

    return headers;
  }

  private async request<T = unknown>(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: BodyInit | null;
      expectedStatus?: number | number[];
      responseType?: "json" | "text";
    } = {},
  ): Promise<T> {
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    });

    const expected = normalizeExpectedStatus(options.expectedStatus);
    if ((expected.length > 0 && !expected.includes(response.status)) || (expected.length === 0 && !response.ok)) {
      const body = await response.text().catch(() => "");
      throw new AutoCliError("SPOTIFY_CONNECT_REQUEST_FAILED", `Spotify Connect request failed with ${response.status} ${response.statusText}.`, {
        details: {
          url,
          status: response.status,
          statusText: response.statusText,
          body: body.slice(0, 600),
        },
      });
    }

    if (options.responseType === "text") {
      return (await response.text()) as T;
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new AutoCliError("SPOTIFY_CONNECT_INVALID_JSON", "Spotify Connect returned invalid JSON.", {
        cause: error,
        details: {
          url,
          preview: text.slice(0, 200),
        },
      });
    }
  }

  private mapDevices(state: SpotifyConnectState): SpotifyConnectDeviceSummary[] {
    const devices: SpotifyConnectDeviceSummary[] = [];

    for (const [id, raw] of Object.entries(state.devices)) {
      const device = asRecord(raw);
      if (!device) {
        continue;
      }

      const volume = getNumber(device, "volume") ?? getNumber(device, "volume_percent");
      devices.push({
        id,
        name: getString(device, "name") || getString(device, "device_name") || undefined,
        type: getString(device, "device_type") || undefined,
        isActive:
          id === state.activeDeviceId ||
          getBoolean(device, "is_active") ||
          getBoolean(device, "is_currently_playing") ||
          getBoolean(device, "is_active_device"),
        isPrivateSession: false,
        isRestricted: getBoolean(device, "is_restricted"),
        volumePercent: typeof volume === "number" ? clamp(Math.round(volume), 0, 100) : undefined,
        supportsVolume: true,
      });
    }

    return devices;
  }

  private mapPlayback(state: SpotifyConnectState): SpotifyConnectPlaybackSummary {
    const player = state.playerState;
    const track = extractTrack(player);
    const activeDevice = this.mapDevices(state).find((device) => device.isActive);
    const progressMs = getNumber(player, "position_as_of_timestamp") ?? getNumber(player, "position_ms");

    return {
      isPlaying: player ? !(getBoolean(player, "is_paused") ?? false) : false,
      repeatState: getString(player, "repeat_mode") || getString(player, "repeat") || undefined,
      shuffleState: player ? (getBoolean(player, "shuffle") ? "on" : "off") : undefined,
      progress: typeof progressMs === "number" ? formatSpotifyDuration(progressMs) : undefined,
      progressMs: progressMs ?? undefined,
      currentlyPlayingType: getString(player, "currently_playing_type") || undefined,
      deviceId: activeDevice?.id,
      deviceName: activeDevice?.name,
      deviceType: activeDevice?.type,
      contextUri: getString(player, "context_uri") || getString(player, "context_uri_string") || undefined,
      contextUrl: spotifyUriToUrl(getString(player, "context_uri") || getString(player, "context_uri_string")),
      title: track?.title,
      artists: track?.artists,
      album: track?.album,
      duration: track?.duration,
      trackId: track?.id,
      trackUrl: track?.url,
    };
  }

  private mapQueue(state: SpotifyConnectState): SpotifyConnectQueueSummary {
    const player = state.playerState;
    const nextTracks = Array.isArray(player?.next_tracks) ? player.next_tracks : [];
    return {
      current: extractTrack(player),
      queue: nextTracks.map((entry) => extractTrack(entry)).filter((track): track is SpotifyConnectTrackSummary => Boolean(track)),
    };
  }

  private resolveDevice(state: SpotifyConnectState, target: string): SpotifyConnectDeviceSummary {
    const devices = this.mapDevices(state);
    const trimmed = target.trim();
    const normalized = trimmed.toLowerCase();

    const exactId = devices.find((device) => device.id === trimmed);
    if (exactId) {
      return exactId;
    }

    if (normalized === "active") {
      const active = devices.find((device) => device.isActive);
      if (active) {
        return active;
      }
    }

    const exactName = devices.find((device) => typeof device.name === "string" && device.name.toLowerCase() === normalized);
    if (exactName) {
      return exactName;
    }

    const partialName = devices.find((device) => typeof device.name === "string" && device.name.toLowerCase().includes(normalized));
    if (partialName) {
      return partialName;
    }

    throw new AutoCliError("SPOTIFY_DEVICE_NOT_FOUND", `Spotify device "${target}" was not found.`, {
      details: {
        target,
        availableDevices: devices,
      },
    });
  }
}

function normalizeExpectedStatus(expected?: number | number[]): number[] {
  if (typeof expected === "number") {
    return [expected];
  }

  return expected ?? [];
}

function randomHex(size: number): string {
  if (size <= 0) {
    return "";
  }

  return randomBytes(Math.ceil(size / 2)).toString("hex").slice(0, size);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function runtimeOs(): string {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : undefined;
}

function getString(value: unknown, key: string): string {
  const record = asRecord(value);
  const next = record?.[key];
  return typeof next === "string" ? next : "";
}

function getNumber(value: unknown, key: string): number | undefined {
  const record = asRecord(value);
  const next = record?.[key];
  return typeof next === "number" && Number.isFinite(next) ? next : undefined;
}

function getBoolean(value: unknown, key: string): boolean {
  const record = asRecord(value);
  return typeof record?.[key] === "boolean" ? (record[key] as boolean) : false;
}

function findCaseInsensitiveString(value: unknown, key: string): string | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized = key.toLowerCase();
  for (const [entryKey, entryValue] of Object.entries(record)) {
    if (entryKey.toLowerCase() === normalized && typeof entryValue === "string" && entryValue.length > 0) {
      return entryValue;
    }
  }

  return undefined;
}

function detectActiveDeviceId(devices: Record<string, unknown>): string {
  for (const [id, raw] of Object.entries(devices)) {
    if (getBoolean(raw, "is_active") || getBoolean(raw, "is_currently_playing") || getBoolean(raw, "is_active_device")) {
      return id;
    }
  }

  return "";
}

function mapPlayOriginId(player: unknown): string {
  const playOrigin = asRecord(asRecord(player)?.play_origin);
  return typeof playOrigin?.device_identifier === "string" ? playOrigin.device_identifier : "";
}

function isContextUri(uri: string): boolean {
  return !(uri.startsWith("spotify:track:") || uri.startsWith("spotify:episode:"));
}

function extractTrack(value: unknown): SpotifyConnectTrackSummary | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const track = asRecord(record.track) ?? asRecord(record.item) ?? asRecord(record.current_track) ?? record;
  const uri = findFirstUri(track, "track") ?? findFirstUri(track);
  if (!uri || !uri.startsWith("spotify:track:")) {
    return undefined;
  }

  const artists = extractArtistNames(track);
  const album = extractAlbumName(track);
  const durationMs = getNumber(track, "duration_ms") ?? getNumber(track, "durationMs");
  const id = idFromUri(uri);

  return {
    id,
    title: findFirstName(track) || undefined,
    artists: artists.length > 0 ? artists.join(", ") : undefined,
    album: album || undefined,
    duration: typeof durationMs === "number" ? formatSpotifyDuration(durationMs) : undefined,
    uri,
    url: spotifyUriToUrl(uri) ?? (id ? `https://open.spotify.com/track/${id}` : undefined),
  };
}

function extractArtistNames(value: unknown): string[] {
  const names: string[] = [];
  walkMaps(value, (record) => {
    if (Array.isArray(record.artists)) {
      for (const artist of record.artists) {
        const artistRecord = asRecord(artist);
        const name = getString(artistRecord, "name") || getString(asRecord(artistRecord?.profile), "name");
        if (name) {
          names.push(name);
        }
      }
    }

    const firstArtist = asRecord(record.firstArtist);
    if (firstArtist) {
      for (const key of ["items", "nodes", "edges"] as const) {
        const entries = firstArtist[key];
        if (!Array.isArray(entries)) {
          continue;
        }

        for (const entry of entries) {
          const entryRecord = asRecord(entry);
          const node = asRecord(entryRecord?.node) ?? entryRecord;
          const profile = asRecord(node?.profile);
          const name = getString(profile, "name") || getString(node, "name");
          if (name) {
            names.push(name);
          }
        }
      }
    }
  });

  return [...new Set(names.filter(Boolean))];
}

function extractAlbumName(value: unknown): string {
  let album = "";
  walkMaps(value, (record) => {
    if (album) {
      return;
    }

    const fromAlbum = getString(asRecord(record.album), "name");
    if (fromAlbum) {
      album = fromAlbum;
      return;
    }

    const fromAlbumOfTrack = getString(asRecord(record.albumOfTrack), "name");
    if (fromAlbumOfTrack) {
      album = fromAlbumOfTrack;
    }
  });
  return album;
}

function walkMaps(value: unknown, visitor: (record: JsonRecord) => void): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkMaps(entry, visitor);
    }
    return;
  }

  const record = asRecord(value);
  if (!record) {
    return;
  }

  visitor(record);
  for (const entry of Object.values(record)) {
    walkMaps(entry, visitor);
  }
}

function findFirstName(value: unknown): string {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const name = findFirstName(entry);
      if (name) {
        return name;
      }
    }
    return "";
  }

  const record = asRecord(value);
  if (!record) {
    return "";
  }

  if (typeof record.name === "string" && record.name.length > 0) {
    return record.name;
  }

  if (typeof record.title === "string" && record.title.length > 0) {
    return record.title;
  }

  for (const entry of Object.values(record)) {
    const name = findFirstName(entry);
    if (name) {
      return name;
    }
  }

  return "";
}

function findFirstUri(value: unknown, kind?: string): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const uri = findFirstUri(entry, kind);
      if (uri) {
        return uri;
      }
    }
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  if (typeof record.uri === "string" && record.uri.startsWith("spotify:")) {
    if (!kind || record.uri.startsWith(`spotify:${kind}:`)) {
      return record.uri;
    }
  }

  if (kind && typeof record.id === "string" && record.id.length > 0) {
    return `spotify:${kind}:${record.id}`;
  }

  for (const entry of Object.values(record)) {
    const uri = findFirstUri(entry, kind);
    if (uri) {
      return uri;
    }
  }

  return undefined;
}

function idFromUri(uri: string): string | undefined {
  const parts = uri.split(":");
  return parts.length >= 3 ? parts.at(-1) : undefined;
}

function rawDataToText(data: RawData): string {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data.map((entry) => Buffer.isBuffer(entry) ? entry : Buffer.from(entry))).toString("utf8");
  }

  return Buffer.from(data).toString("utf8");
}
