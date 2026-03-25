import { randomUUID } from "node:crypto";

import { AutoCliError } from "../errors.js";
import { maybeAutoRefreshSession } from "../utils/autorefresh.js";
import { serializeCookieJar } from "../utils/cookie-manager.js";
import { readMediaFile } from "../utils/media.js";
import { parseInstagramProfileTarget, parseInstagramTarget } from "../utils/targets.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../platforms.js";
import { BasePlatformAdapter } from "./base.js";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  PlatformSession,
  PostMediaInput,
  SessionStatus,
  SessionUser,
  TextPostInput,
} from "../types.js";

const INSTAGRAM_ORIGIN = getPlatformOrigin("instagram");
const INSTAGRAM_HOME = getPlatformHomeUrl("instagram");
const INSTAGRAM_APP_ID = "936619743392459";
const INSTAGRAM_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface InstagramProbe {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

interface InstagramCurrentUserResponse {
  status?: string;
  user?: {
    pk?: string | number;
    username?: string;
    full_name?: string;
  };
  form_data?: {
    username?: string;
    first_name?: string;
  };
}

interface InstagramMutationResponse {
  status?: string;
  feedback_message?: string;
  media?: {
    id?: string;
    code?: string;
  };
  friendship_status?: {
    following?: boolean;
    outgoing_request?: boolean;
  };
  previous_following?: boolean;
  error?: string | null;
}

interface InstagramSearchResponse {
  users?: Array<{
    position?: number;
    user?: InstagramUserPayload;
  }>;
}

interface InstagramUserPayload {
  pk?: string | number;
  id?: string | number;
  username?: string;
  full_name?: string;
  biography?: string;
  external_url?: string | null;
  is_private?: boolean;
  is_verified?: boolean;
  profile_pic_url?: string;
  profile_pic_url_hd?: string;
  edge_followed_by?: {
    count?: number;
  };
  edge_follow?: {
    count?: number;
  };
  edge_owner_to_timeline_media?: {
    count?: number;
  };
  follower_count?: number;
  following_count?: number;
  media_count?: number;
}

interface InstagramProfileInfoResponse {
  status?: string;
  data?: {
    user?: InstagramUserPayload;
  };
  user?: InstagramUserPayload;
}

interface InstagramMediaInfoResponse {
  status?: string;
  items?: InstagramMediaPayload[];
}

interface InstagramMediaPayload {
  id?: string;
  pk?: string | number;
  code?: string;
  media_type?: number;
  product_type?: string;
  like_count?: number;
  comment_count?: number;
  play_count?: number;
  view_count?: number;
  taken_at?: number;
  user?: InstagramUserPayload;
  caption?: {
    text?: string;
  };
  image_versions2?: {
    candidates?: Array<{
      url?: string;
    }>;
  };
  video_versions?: Array<{
    url?: string;
  }>;
}

interface InstagramSearchResultItem {
  id: string;
  username: string;
  fullName?: string;
  url: string;
  isPrivate?: boolean;
  isVerified?: boolean;
  followerCount?: number;
  profilePicUrl?: string;
}

interface InstagramProfileInfo {
  id: string;
  username?: string;
  fullName?: string;
  biography?: string;
  url?: string;
  externalUrl?: string;
  isPrivate?: boolean;
  isVerified?: boolean;
  followerCount?: number;
  followingCount?: number;
  mediaCount?: number;
  profilePicUrl?: string;
}

interface InstagramMediaInfo {
  id: string;
  shortcode?: string;
  url?: string;
  ownerUsername?: string;
  ownerUrl?: string;
  mediaType?: string;
  likeCount?: number;
  commentCount?: number;
  playCount?: number;
  caption?: string;
  takenAt?: string;
  thumbnailUrl?: string;
}

export class InstagramAdapter extends BasePlatformAdapter {
  readonly platform = "instagram" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const provisionalSession = {
      version: 1 as const,
      platform: this.platform,
      account: input.account ?? "default",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: imported.source,
      status: { state: "unknown" as const },
      cookieJar: serializeCookieJar(imported.jar),
    };

    const probe = await this.probeSession(provisionalSession);
    const account = input.account ?? probe.user?.username ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      user: probe.user,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "Instagram session has expired.", {
        details: {
          platform: this.platform,
          account,
          sessionPath,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message:
        probe.status.state === "active"
          ? `Saved Instagram session for ${account}.`
          : `Saved Instagram session for ${account}, but it should be revalidated before heavy use.`,
      user: probe.user,
      sessionPath,
      data: {
        status: probe.status.state,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.prepareSession(account);
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);
    return this.buildStatusResult({
      account: session.account,
      sessionPath: path,
      status: probe.status,
      user: probe.user,
    });
  }

  async postMedia(input: PostMediaInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const media = await readMediaFile(input.mediaPath);
    const client = await this.createInstagramClient(session);
    const uploadId = `${Date.now()}`;
    const entityName = `${uploadId}_0_${randomUUID()}`;

    await this.tryRequestChain(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/rupload_igphoto/${uploadId}`, {
            method: "POST",
            responseType: "text",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/octet-stream",
              offset: "0",
              "x-entity-name": entityName,
              "x-entity-type": media.mimeType,
              "x-entity-length": String(media.bytes.length),
              "x-instagram-rupload-params": JSON.stringify({
                media_type: 1,
                upload_id: uploadId,
                upload_media_width: 1080,
                upload_media_height: 1350,
                image_compression: JSON.stringify({
                  lib_name: "moz",
                  lib_version: "3.1.m",
                  quality: "80",
                }),
              }),
              referer: `${INSTAGRAM_ORIGIN}/create/style/`,
            },
            body: new Uint8Array(media.bytes),
          }),
      ],
      "Failed to upload media to Instagram. The private web upload flow may have changed.",
    );

    const configureResponse = await this.tryRequestChain<InstagramMutationResponse>(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/media/configure/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/x-www-form-urlencoded",
              referer: `${INSTAGRAM_ORIGIN}/create/details/`,
            },
            body: new URLSearchParams({
              upload_id: uploadId,
              caption: input.caption ?? "",
              source_type: "library",
              timezone_offset: "0",
              disable_comments: "0",
              like_and_view_counts_disabled: "0",
            }),
          }),
      ],
      "Failed to configure the Instagram post after upload.",
    );

    const postId = configureResponse.media?.id ?? uploadId;
    const shortcode = configureResponse.media?.code;
    const url = shortcode ? `${INSTAGRAM_ORIGIN}/p/${shortcode}/` : undefined;

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "post",
      message: `Instagram post created for ${session.account}.`,
      id: postId,
      url,
      user: probe.user,
      data: {
        caption: input.caption ?? "",
        mediaPath: input.mediaPath,
      },
    };
  }

  async postText(_input: TextPostInput): Promise<AdapterActionResult> {
    throw new AutoCliError(
      "UNSUPPORTED_ACTION",
      "Instagram web sessions cannot publish a text-only post. Use `autocli instagram post <media-path> --caption ...`.",
    );
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const target = parseInstagramTarget(input.target);

    await this.tryRequestChain(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/web/likes/${target.mediaId}/like/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: await this.buildInstagramHeaders(client, probe.metadata),
          }),
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/web/likes/${target.mediaId}/like/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: await this.buildInstagramHeaders(client, probe.metadata),
          }),
      ],
      "Failed to like the Instagram post.",
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "like",
      message: `Instagram post liked for ${session.account}.`,
      id: target.mediaId,
      user: probe.user,
    };
  }

  async unlike(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const target = parseInstagramTarget(input.target);

    await this.tryRequestChain(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/web/likes/${target.mediaId}/unlike/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: await this.buildInstagramHeaders(client, probe.metadata),
          }),
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/web/likes/${target.mediaId}/unlike/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: await this.buildInstagramHeaders(client, probe.metadata),
          }),
      ],
      "Failed to unlike the Instagram post.",
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "unlike",
      message: `Instagram post unliked for ${session.account}.`,
      id: target.mediaId,
      user: probe.user,
    };
  }

  async comment(input: CommentInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const target = parseInstagramTarget(input.target);

    await this.tryRequestChain(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/web/comments/${target.mediaId}/add/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              comment_text: input.text,
            }),
          }),
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/web/comments/${target.mediaId}/add/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              comment_text: input.text,
            }),
          }),
      ],
      "Failed to comment on the Instagram post.",
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "comment",
      message: `Instagram comment sent for ${session.account}.`,
      id: target.mediaId,
      user: probe.user,
      data: {
        text: input.text,
      },
    };
  }

  async search(input: {
    account?: string;
    query: string;
    limit?: number;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const query = input.query.trim();

    if (!query) {
      throw new AutoCliError("INVALID_SEARCH_QUERY", "Expected a non-empty Instagram search query.");
    }

    const limit = this.normalizeSearchLimit(input.limit);
    const response = await client.request<InstagramSearchResponse>(
      `${INSTAGRAM_ORIGIN}/web/search/topsearch/?context=blended&count=${limit}&query=${encodeURIComponent(query)}`,
      {
        expectedStatus: 200,
        headers: await this.buildInstagramHeaders(client, probe.metadata),
      },
    );

    const results = (response.users ?? [])
      .map((item) => item.user)
      .filter((user): user is InstagramUserPayload => Boolean(user?.username))
      .slice(0, limit)
      .map((user) => this.toInstagramSearchResult(user));

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "search",
      message:
        results.length > 0
          ? `Found ${results.length} Instagram account result${results.length === 1 ? "" : "s"} for "${query}".`
          : `No Instagram account results found for "${query}".`,
      user: probe.user,
      data: {
        query,
        limit,
        results: results.map((result) => ({ ...result })),
      },
    };
  }

  async mediaInfo(input: {
    account?: string;
    target: string;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const target = parseInstagramTarget(input.target);

    const response = await client.request<InstagramMediaInfoResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/media/${target.mediaId}/info/`,
      {
        expectedStatus: 200,
        headers: await this.buildInstagramHeaders(client, probe.metadata),
      },
    );

    const media = response.items?.[0];
    if (!media?.id && !media?.pk) {
      throw new AutoCliError("INSTAGRAM_MEDIA_NOT_FOUND", "Instagram could not find that media item.", {
        details: {
          target: input.target,
          mediaId: target.mediaId,
        },
      });
    }

    const info = this.toInstagramMediaInfo(media, target.url);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "mediaid",
      message: `Loaded Instagram media details for ${info.id}.`,
      id: info.id,
      url: info.url,
      user: probe.user,
      data: { ...info },
    };
  }

  async profileInfo(input: {
    account?: string;
    target: string;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const info = await this.resolveInstagramProfileInfo(client, probe.metadata, input.target);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "profileid",
      message: `Loaded Instagram profile details for ${info.username ?? info.id}.`,
      id: info.id,
      url: info.url,
      user: probe.user,
      data: { ...info },
    };
  }

  async follow(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const info = await this.resolveInstagramProfileInfo(client, probe.metadata, input.target);

    const response = await client.request<InstagramMutationResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/friendships/create/${info.id}/`,
      {
        method: "POST",
        expectedStatus: 200,
        headers: {
          ...(await this.buildInstagramHeaders(client, probe.metadata)),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(),
      },
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "follow",
      message: `Instagram follow request sent for ${info.username ?? info.id}.`,
      id: info.id,
      url: info.url,
      user: probe.user,
      data: {
        username: info.username,
        following: response.friendship_status?.following,
        outgoingRequest: response.friendship_status?.outgoing_request,
      },
    };
  }

  async unfollow(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const info = await this.resolveInstagramProfileInfo(client, probe.metadata, input.target);

    const response = await client.request<InstagramMutationResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/friendships/destroy/${info.id}/`,
      {
        method: "POST",
        expectedStatus: 200,
        headers: {
          ...(await this.buildInstagramHeaders(client, probe.metadata)),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(),
      },
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "unfollow",
      message: `Instagram unfollow request sent for ${info.username ?? info.id}.`,
      id: info.id,
      url: info.url,
      user: probe.user,
      data: {
        username: info.username,
        following: response.friendship_status?.following,
        previousFollowing: response.previous_following,
      },
    };
  }

  private async ensureActiveSession(session: PlatformSession): Promise<InstagramProbe> {
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "Instagram session has expired.", {
        details: {
          platform: this.platform,
          account: session.account,
        },
      });
    }

    return probe;
  }

  private async probeSession(session: PlatformSession): Promise<InstagramProbe> {
    const client = await this.createInstagramClient(session);
    const sessionId = await client.getCookieValue("sessionid", INSTAGRAM_HOME);
    const csrfToken = await client.getCookieValue("csrftoken", INSTAGRAM_HOME);
    const dsUserId = await client.getCookieValue("ds_user_id", INSTAGRAM_HOME);

    if (!sessionId || !csrfToken) {
      return {
        status: {
          state: "expired",
          message: "Missing required Instagram session cookies. Re-import cookies.txt.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    const homeHtml = await client.request<string>(INSTAGRAM_HOME, {
      responseType: "text",
      expectedStatus: 200,
      headers: {
        "user-agent": INSTAGRAM_USER_AGENT,
      },
    });

    const inlineUser = this.extractUserFromHtml(homeHtml, dsUserId);
    const appId = this.extractFirst(homeHtml, /"app_id":"([^"]+)"/u) ?? INSTAGRAM_APP_ID;
    const deviceId = this.extractFirst(homeHtml, /"device_id":"([^"]+)"/u);

    const apiUser = await this.tryRequestChain<InstagramCurrentUserResponse | null>(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/accounts/current_user/?edit=true`, {
            expectedStatus: 200,
            headers: await this.buildInstagramHeaders(client, { appId, deviceId }),
          }),
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/accounts/edit/web_form_data/`, {
            expectedStatus: 200,
            headers: await this.buildInstagramHeaders(client, { appId, deviceId }),
          }),
      ],
      "",
      true,
    );

    const user: SessionUser | undefined =
      apiUser?.user
        ? {
            id: String(apiUser.user.pk ?? dsUserId ?? ""),
            username: apiUser.user.username ?? inlineUser?.username,
            displayName: apiUser.user.full_name ?? inlineUser?.displayName,
            profileUrl: apiUser.user.username ? `${INSTAGRAM_ORIGIN}/${apiUser.user.username}/` : inlineUser?.profileUrl,
          }
        : apiUser?.form_data?.username || inlineUser
          ? {
              id: dsUserId,
              username: apiUser?.form_data?.username ?? inlineUser?.username,
              displayName: apiUser?.form_data?.first_name ?? inlineUser?.displayName,
              profileUrl:
                apiUser?.form_data?.username ?? inlineUser?.username
                  ? `${INSTAGRAM_ORIGIN}/${apiUser?.form_data?.username ?? inlineUser?.username}/`
                  : undefined,
            }
          : undefined;

    if (!apiUser && !user) {
      return {
        status: {
          state: "expired",
          message: "Instagram did not expose a logged-in user for these cookies. Re-import cookies.txt.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "LOGGED_OUT",
        },
        metadata: {
          appId,
          deviceId,
        },
      };
    }

    return {
      status: {
        state: apiUser ? "active" : "unknown",
        message:
          apiUser
            ? "Session validated."
            : "Homepage includes logged-in user data, but the validation endpoint was unavailable.",
        lastValidatedAt: new Date().toISOString(),
      },
      user,
      metadata: {
        appId,
        deviceId,
      },
    };
  }

  private async createInstagramClient(session: PlatformSession) {
    return this.createClient(session, {
      accept: "*/*",
      origin: INSTAGRAM_ORIGIN,
      "user-agent": INSTAGRAM_USER_AGENT,
    });
  }

  private async buildInstagramHeaders(
    client: Awaited<ReturnType<InstagramAdapter["createInstagramClient"]>>,
    metadata?: Record<string, unknown>,
  ): Promise<Record<string, string>> {
    const csrfToken = await client.getCookieValue("csrftoken", INSTAGRAM_HOME);
    return {
      accept: "*/*",
      origin: INSTAGRAM_ORIGIN,
      referer: INSTAGRAM_HOME,
      "x-asbd-id": "129477",
      "x-csrftoken": csrfToken ?? "",
      "x-ig-app-id": String(metadata?.appId ?? INSTAGRAM_APP_ID),
      "x-requested-with": "XMLHttpRequest",
    };
  }

  private extractUserFromHtml(html: string, dsUserId?: string): SessionUser | undefined {
    const username =
      this.extractFirst(html, /"username":"([^"]+)"/u) ??
      this.extractFirst(html, /"forceLoginUsername":"([^"]+)"/u);
    const displayName = this.extractFirst(html, /"full_name":"([^"]+)"/u);

    if (!username && !displayName && !dsUserId) {
      return undefined;
    }

    return {
      id: dsUserId,
      username: username ?? undefined,
      displayName: displayName ?? undefined,
      profileUrl: username ? `${INSTAGRAM_ORIGIN}/${username}/` : undefined,
    };
  }

  private extractFirst(input: string, pattern: RegExp): string | undefined {
    return input.match(pattern)?.[1];
  }

  private normalizeSearchLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return 5;
    }

    return Math.max(1, Math.min(25, Math.floor(limit)));
  }

  private toInstagramSearchResult(user: InstagramUserPayload): InstagramSearchResultItem {
    const id = String(user.pk ?? user.id ?? "");
    const username = user.username ?? id;
    return {
      id,
      username,
      fullName: user.full_name ?? undefined,
      url: `${INSTAGRAM_ORIGIN}/${username}/`,
      isPrivate: user.is_private,
      isVerified: user.is_verified,
      followerCount: user.follower_count ?? user.edge_followed_by?.count,
      profilePicUrl: user.profile_pic_url_hd ?? user.profile_pic_url,
    };
  }

  private toInstagramProfileInfo(user: InstagramUserPayload, fallbackUrl?: string): InstagramProfileInfo {
    const id = String(user.pk ?? user.id ?? "");
    const username = user.username ?? undefined;
    return {
      id,
      username,
      fullName: user.full_name ?? undefined,
      biography: user.biography ?? undefined,
      url: username ? `${INSTAGRAM_ORIGIN}/${username}/` : fallbackUrl,
      externalUrl: user.external_url ?? undefined,
      isPrivate: user.is_private,
      isVerified: user.is_verified,
      followerCount: user.follower_count ?? user.edge_followed_by?.count,
      followingCount: user.following_count ?? user.edge_follow?.count,
      mediaCount: user.media_count ?? user.edge_owner_to_timeline_media?.count,
      profilePicUrl: user.profile_pic_url_hd ?? user.profile_pic_url,
    };
  }

  private toInstagramMediaInfo(media: InstagramMediaPayload, fallbackUrl?: string): InstagramMediaInfo {
    const id = String(media.pk ?? media.id ?? "");
    const shortcode = media.code ?? undefined;
    return {
      id,
      shortcode,
      url: shortcode ? `${INSTAGRAM_ORIGIN}/p/${shortcode}/` : fallbackUrl,
      ownerUsername: media.user?.username ?? undefined,
      ownerUrl: media.user?.username ? `${INSTAGRAM_ORIGIN}/${media.user.username}/` : undefined,
      mediaType: this.describeInstagramMediaType(media),
      likeCount: media.like_count,
      commentCount: media.comment_count,
      playCount: media.play_count ?? media.view_count,
      caption: media.caption?.text ?? undefined,
      takenAt: this.toIsoTimestamp(media.taken_at),
      thumbnailUrl: media.image_versions2?.candidates?.[0]?.url ?? media.video_versions?.[0]?.url,
    };
  }

  private describeInstagramMediaType(media: InstagramMediaPayload): string | undefined {
    if (media.product_type === "clips") {
      return "reel";
    }

    switch (media.media_type) {
      case 1:
        return "photo";
      case 2:
        return "video";
      case 8:
        return "carousel";
      default:
        return media.product_type ?? undefined;
    }
  }

  private toIsoTimestamp(value?: number): string | undefined {
    if (!value || !Number.isFinite(value)) {
      return undefined;
    }

    return new Date(value * 1_000).toISOString();
  }

  private async resolveInstagramProfileInfo(
    client: Awaited<ReturnType<InstagramAdapter["createInstagramClient"]>>,
    metadata: Record<string, unknown> | undefined,
    target: string,
  ): Promise<InstagramProfileInfo> {
    const parsed = parseInstagramProfileTarget(target);
    const user = parsed.userId
      ? await this.fetchInstagramUserById(client, metadata, parsed.userId)
      : parsed.username
        ? await this.fetchInstagramUserByUsername(client, metadata, parsed.username)
        : undefined;

    if (!user) {
      throw new AutoCliError("INSTAGRAM_PROFILE_NOT_FOUND", "Instagram could not find that profile.", {
        details: {
          target,
        },
      });
    }

    return this.toInstagramProfileInfo(user, parsed.url);
  }

  private async fetchInstagramUserByUsername(
    client: Awaited<ReturnType<InstagramAdapter["createInstagramClient"]>>,
    metadata: Record<string, unknown> | undefined,
    username: string,
  ): Promise<InstagramUserPayload | undefined> {
    const response = await this.tryRequestChain<InstagramProfileInfoResponse | null>(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
            expectedStatus: 200,
            headers: await this.buildInstagramHeaders(client, metadata),
          }),
      ],
      "",
      true,
    );

    return response?.data?.user ?? response?.user;
  }

  private async fetchInstagramUserById(
    client: Awaited<ReturnType<InstagramAdapter["createInstagramClient"]>>,
    metadata: Record<string, unknown> | undefined,
    userId: string,
  ): Promise<InstagramUserPayload | undefined> {
    const response = await this.tryRequestChain<InstagramProfileInfoResponse | null>(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/users/${encodeURIComponent(userId)}/info/`, {
            expectedStatus: 200,
            headers: await this.buildInstagramHeaders(client, metadata),
          }),
      ],
      "",
      true,
    );

    return response?.data?.user ?? response?.user;
  }

  private async prepareSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    const loaded = await this.loadSession(account);
    return {
      path: loaded.path,
      session: await this.maybeAutoRefresh(loaded.session),
    };
  }

  private async maybeAutoRefresh(session: PlatformSession): Promise<PlatformSession> {
    const client = await this.createInstagramClient(session);
    const refresh = await maybeAutoRefreshSession({
      platform: this.platform,
      session,
      jar: client.jar,
      strategy: "homepage_keepalive",
      capability: "auto",
      refresh: async () => {
        await client.request<string>(INSTAGRAM_HOME, {
          responseType: "text",
          expectedStatus: 200,
          headers: {
            referer: INSTAGRAM_HOME,
          },
        });
      },
    });

    return this.persistExistingSession(session, {
      jar: client.jar,
      metadata: {
        ...(session.metadata ?? {}),
        ...refresh.metadata,
      },
    });
  }

  private async persistSessionState(session: PlatformSession, probe: InstagramProbe): Promise<void> {
    await this.persistExistingSession(session, {
      user: probe.user ?? session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  private async tryRequestChain<T>(
    attempts: Array<() => Promise<T>>,
    fallbackMessage: string,
    allowNull = false,
  ): Promise<T> {
    let lastError: unknown;

    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
      }
    }

    if (allowNull) {
      return null as T;
    }

    throw new AutoCliError("PLATFORM_REQUEST_FAILED", fallbackMessage, {
      cause: lastError,
      details: lastError instanceof Error ? { message: lastError.message } : undefined,
    });
  }
}
