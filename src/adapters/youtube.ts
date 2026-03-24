import { createHash } from "node:crypto";

import { AutoCliError, isAutoCliError } from "../errors.js";
import { maybeAutoRefreshSession } from "../utils/autorefresh.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../platforms.js";
import { parseYouTubeChannelTarget, parseYouTubeTarget } from "../utils/targets.js";
import { BasePlatformAdapter } from "./base.js";
import { Cookie, CookieJar } from "tough-cookie";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  PlatformSession,
  PostMediaInput,
  SessionStatus,
  TextPostInput,
} from "../types.js";

const YOUTUBE_ORIGIN = getPlatformOrigin("youtube");
const YOUTUBE_HOME = getPlatformHomeUrl("youtube");
const YOUTUBE_WATCH = `${YOUTUBE_ORIGIN}/watch?v=`;
const YOUTUBE_CLIENT_NAME = "WEB";
const YOUTUBE_CLIENT_NAME_ID = "1";
const YOUTUBE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const YOUTUBE_COOKIE_ALLOWLIST = new Set([
  "APISID",
  "CONSENT",
  "GPS",
  "HSID",
  "LOGIN_INFO",
  "PREF",
  "SAPISID",
  "SID",
  "SIDCC",
  "SSID",
  "VISITOR_INFO1_LIVE",
  "YSC",
  "__Secure-1PAPISID",
  "__Secure-1PSID",
  "__Secure-1PSIDCC",
  "__Secure-1PSIDTS",
  "__Secure-3PAPISID",
  "__Secure-3PSID",
  "__Secure-3PSIDCC",
  "__Secure-3PSIDTS",
]);

interface YouTubeProbe {
  status: SessionStatus;
  metadata?: Record<string, unknown>;
}

interface YouTubePageConfig {
  apiKey?: string;
  clientVersion?: string;
  visitorData?: string;
  delegatedSessionId?: string;
  sessionIndex?: string;
  createCommentParams?: string;
  loggedIn?: boolean;
}

interface YouTubeActionContext {
  client: Awaited<ReturnType<YouTubeAdapter["createYouTubeClient"]>>;
  page: YouTubePageConfig;
  apiKey: string;
  clientVersion: string;
  url: string;
}

interface YouTubeSearchResultItem {
  id: string;
  title: string;
  url: string;
  channel?: string;
  duration?: string;
  views?: string;
  published?: string;
  description?: string;
  thumbnailUrl?: string;
}

interface YouTubeVideoInfo {
  id: string;
  title: string;
  url: string;
  channel?: string;
  channelId?: string;
  channelUrl?: string;
  duration?: string;
  durationSeconds?: number;
  views?: string;
  published?: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
  live?: boolean;
}

export class YouTubeAdapter extends BasePlatformAdapter {
  readonly platform = "youtube" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const probe = await this.inspectCookieJar(imported.jar);
    const account = input.account ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "YouTube session has expired.", {
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
          ? `Saved YouTube session for ${account}.`
          : `Saved YouTube session for ${account}, but it should be revalidated before heavy use.`,
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
      user: session.user,
    });
  }

  async postMedia(_input: PostMediaInput): Promise<AdapterActionResult> {
    throw new AutoCliError(
      "UNSUPPORTED_ACTION",
      "YouTube uploads are not implemented yet. They require a separate Studio upload flow, not just watch-page session actions.",
    );
  }

  async postText(_input: TextPostInput): Promise<AdapterActionResult> {
    throw new AutoCliError(
      "UNSUPPORTED_ACTION",
      "YouTube community posting is not implemented yet. The current CLI supports engagement actions on videos and channels.",
    );
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    await this.ensureUsableSession(session);

    const target = parseYouTubeTarget(input.target);
    const context = await this.prepareVideoActionContext(session, target.videoId, target.url);

    await this.executeVideoPreferenceMutation({
      context,
      videoId: target.videoId,
      path: "like/like",
      expectedLikeStatus: "LIKE",
      fallbackMessage: "Failed to like the YouTube video.",
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "like",
      message: `YouTube video liked for ${session.account}.`,
      id: target.videoId,
      url: context.url,
    };
  }

  async dislike(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    await this.ensureUsableSession(session);

    const target = parseYouTubeTarget(input.target);
    const context = await this.prepareVideoActionContext(session, target.videoId, target.url);

    await this.executeVideoPreferenceMutation({
      context,
      videoId: target.videoId,
      path: "like/dislike",
      expectedLikeStatus: "DISLIKE",
      fallbackMessage: "Failed to dislike the YouTube video.",
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "dislike",
      message: `YouTube video disliked for ${session.account}.`,
      id: target.videoId,
      url: context.url,
    };
  }

  async unlike(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    await this.ensureUsableSession(session);

    const target = parseYouTubeTarget(input.target);
    const context = await this.prepareVideoActionContext(session, target.videoId, target.url);

    await this.executeVideoPreferenceMutation({
      context,
      videoId: target.videoId,
      path: "like/removelike",
      expectedLikeStatus: "INDIFFERENT",
      fallbackMessage: "Failed to remove the YouTube like/dislike state.",
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "unlike",
      message: `YouTube video preference cleared for ${session.account}.`,
      id: target.videoId,
      url: context.url,
    };
  }

  async comment(input: CommentInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    await this.ensureUsableSession(session);

    const target = parseYouTubeTarget(input.target);
    const context = await this.prepareVideoActionContext(session, target.videoId, target.url);
    const watchUrl = context.url;
    const createCommentParams = this.requirePageField(
      context.page.createCommentParams,
      "YouTube createCommentParams token",
      "YouTube did not expose a comment token for this video. Comments may be disabled, or the page needs a fresh logged-in cookie export.",
    );

    try {
      await context.client.request(this.buildYoutubeiUrl("comment/create_comment", context.apiKey), {
        method: "POST",
        expectedStatus: 200,
        headers: await this.buildYouTubeApiHeaders(context.client, {
          clientVersion: context.clientVersion,
          visitorData: context.page.visitorData,
          delegatedSessionId: context.page.delegatedSessionId,
          sessionIndex: context.page.sessionIndex,
          referer: watchUrl,
        }),
        body: JSON.stringify({
          context: this.buildYouTubeContext({
            clientVersion: context.clientVersion,
            visitorData: context.page.visitorData,
            originalUrl: watchUrl,
          }),
          createCommentParams,
          commentText: input.text,
        }),
      });
    } catch (error) {
      throw this.mapYouTubeWriteError(error, "Failed to comment on the YouTube video.");
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "comment",
      message: `YouTube comment sent for ${session.account}.`,
      id: target.videoId,
      url: watchUrl,
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
    await this.ensureUsableSession(session);

    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("INVALID_SEARCH_QUERY", "Expected a non-empty YouTube search query.");
    }

    const limit = this.normalizeSearchLimit(input.limit);
    const client = await this.createYouTubeClient(session);
    const resultsUrl = `${YOUTUBE_ORIGIN}/results?search_query=${encodeURIComponent(query)}`;
    const context = await this.preparePageActionContext(client, YOUTUBE_HOME);

    let results: YouTubeSearchResultItem[];
    let estimatedResults: string | undefined;

    try {
      const response = await context.client.request<Record<string, unknown>>(
        this.buildYoutubeiUrl("search", context.apiKey),
        {
          method: "POST",
          expectedStatus: 200,
          headers: await this.buildYouTubeApiHeaders(context.client, {
            clientVersion: context.clientVersion,
            visitorData: context.page.visitorData,
            delegatedSessionId: context.page.delegatedSessionId,
            sessionIndex: context.page.sessionIndex,
            referer: resultsUrl,
          }),
          body: JSON.stringify({
            context: this.buildYouTubeContext({
              clientVersion: context.clientVersion,
              visitorData: context.page.visitorData,
              originalUrl: resultsUrl,
            }),
            query,
          }),
        },
      );

      results = this.extractSearchResults(response, limit);
      estimatedResults =
        "estimatedResults" in response && typeof response.estimatedResults === "string"
          ? response.estimatedResults
          : undefined;
    } catch (error) {
      throw this.mapYouTubeWriteError(error, "Failed to search YouTube.");
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "search",
      message:
        results.length > 0
          ? `Found ${results.length} YouTube video result${results.length === 1 ? "" : "s"} for "${query}".`
          : `No YouTube video results found for "${query}".`,
      url: resultsUrl,
      data: {
        query,
        limit,
        estimatedResults,
        results,
      },
    };
  }

  async info(input: {
    account?: string;
    target: string;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    await this.ensureUsableSession(session);

    const target = parseYouTubeTarget(input.target);
    const context = await this.prepareVideoActionContext(session, target.videoId, target.url);

    let info: YouTubeVideoInfo;
    try {
      const response = await context.client.request<Record<string, unknown>>(
        this.buildYoutubeiUrl("player", context.apiKey),
        {
          method: "POST",
          expectedStatus: 200,
          headers: await this.buildYouTubeApiHeaders(context.client, {
            clientVersion: context.clientVersion,
            visitorData: context.page.visitorData,
            delegatedSessionId: context.page.delegatedSessionId,
            sessionIndex: context.page.sessionIndex,
            referer: context.url,
          }),
          body: JSON.stringify({
            context: this.buildYouTubeContext({
              clientVersion: context.clientVersion,
              visitorData: context.page.visitorData,
              originalUrl: context.url,
            }),
            videoId: target.videoId,
          }),
        },
      );

      info = this.parseVideoInfoResponse(response, target.videoId, context.url);
    } catch (error) {
      throw this.mapYouTubeWriteError(error, "Failed to fetch YouTube video details.");
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "videoid",
      message: `Loaded YouTube video details for ${info.id}.`,
      id: info.id,
      url: info.url,
      data: { ...info },
    };
  }

  async subscribe(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    await this.ensureUsableSession(session);

    const client = await this.createYouTubeClient(session);
    const target = await this.resolveChannelTarget(client, input.target);
    const context = await this.preparePageActionContext(client, target.url);

    await this.executeSubscriptionMutation({
      context,
      channelId: target.channelId,
      path: "subscription/subscribe",
      expectedSubscribed: true,
      fallbackMessage: "Failed to subscribe to the YouTube channel.",
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "subscribe",
      message: `YouTube channel subscribed for ${session.account}.`,
      id: target.channelId,
      url: target.url,
    };
  }

  async unsubscribe(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    await this.ensureUsableSession(session);

    const client = await this.createYouTubeClient(session);
    const target = await this.resolveChannelTarget(client, input.target);
    const context = await this.preparePageActionContext(client, target.url);

    await this.executeSubscriptionMutation({
      context,
      channelId: target.channelId,
      path: "subscription/unsubscribe",
      expectedSubscribed: false,
      fallbackMessage: "Failed to unsubscribe from the YouTube channel.",
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "unsubscribe",
      message: `YouTube channel unsubscribed for ${session.account}.`,
      id: target.channelId,
      url: target.url,
    };
  }

  private async ensureUsableSession(session: PlatformSession): Promise<void> {
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "YouTube session has expired.", {
        details: {
          platform: this.platform,
          account: session.account,
        },
      });
    }
  }

  private async prepareSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    const loaded = await this.loadSession(account);
    return {
      path: loaded.path,
      session: await this.maybeAutoRefresh(loaded.session),
    };
  }

  private async maybeAutoRefresh(session: PlatformSession): Promise<PlatformSession> {
    const client = await this.createYouTubeClient(session);
    const refresh = await maybeAutoRefreshSession({
      platform: this.platform,
      session,
      jar: client.jar,
      strategy: "homepage_keepalive",
      capability: "auto",
      refresh: async () => {
        await client.request<string>(YOUTUBE_HOME, {
          responseType: "text",
          expectedStatus: 200,
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

  private async probeSession(session: PlatformSession): Promise<YouTubeProbe> {
    const jar = await this.cookieManager.createJar(session);
    return this.inspectCookieJar(jar);
  }

  private async inspectCookieJar(jar: CookieJar): Promise<YouTubeProbe> {
    const client = await this.createYouTubeClientFromJar(jar);
    const authCookie = await this.getAuthCookieValue(client);
    const loginCookie =
      (await client.getCookieValue("LOGIN_INFO", YOUTUBE_HOME)) ??
      (await client.getCookieValue("SID", YOUTUBE_HOME)) ??
      (await client.getCookieValue("__Secure-3PSID", YOUTUBE_HOME));

    if (!authCookie || !loginCookie) {
      return {
        status: {
          state: "expired",
          message: "Missing required YouTube auth cookies. Re-import cookies.txt from a logged-in browser session.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    try {
      const html = await client.request<string>(YOUTUBE_HOME, {
        responseType: "text",
        expectedStatus: 200,
      });
      const page = this.parseYouTubePageConfig(html);

      if (page.loggedIn === true) {
        return {
          status: {
            state: "active",
            message: "Session validated via the YouTube homepage.",
            lastValidatedAt: new Date().toISOString(),
          },
          metadata: this.toMetadata(page),
        };
      }

      if (page.loggedIn === false) {
        return {
          status: {
            state: "expired",
            message: "YouTube returned a logged-out homepage. Re-import cookies.txt.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "AUTH_FAILED",
          },
          metadata: this.toMetadata(page),
        };
      }

      return {
        status: {
          state: "unknown",
          message: "YouTube auth cookies are present, but homepage validation was inconclusive.",
          lastValidatedAt: new Date().toISOString(),
        },
        metadata: this.toMetadata(page),
      };
    } catch (error) {
      return {
        status: {
          state: "unknown",
          message: "YouTube auth cookies are present, but homepage validation was unavailable.",
          lastValidatedAt: new Date().toISOString(),
        },
        metadata: isAutoCliError(error) ? error.details : undefined,
      };
    }
  }

  private async createYouTubeClient(session: PlatformSession) {
    const jar = await this.cookieManager.createJar(session);
    return this.createYouTubeClientFromJar(jar);
  }

  private async createYouTubeClientFromJar(jar: CookieJar) {
    const filteredJar = await this.filterYouTubeCookies(jar);
    return new (await import("../utils/http-client.js")).SessionHttpClient(filteredJar, {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": YOUTUBE_USER_AGENT,
    });
  }

  private normalizeSearchLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return 5;
    }

    return Math.max(1, Math.min(25, Math.floor(limit)));
  }

  private async prepareVideoActionContext(
    session: PlatformSession,
    videoId: string,
    inputUrl?: string,
  ): Promise<YouTubeActionContext> {
    const client = await this.createYouTubeClient(session);
    const url = inputUrl ?? `${YOUTUBE_WATCH}${videoId}`;
    return this.preparePageActionContext(client, url);
  }

  private async preparePageActionContext(
    client: Awaited<ReturnType<YouTubeAdapter["createYouTubeClient"]>>,
    url: string,
  ): Promise<YouTubeActionContext> {
    const page = await this.loadPageContext(client, url);
    return {
      client,
      page,
      apiKey: this.requirePageField(page.apiKey, "YouTube API key"),
      clientVersion: this.requirePageField(page.clientVersion, "YouTube client version"),
      url,
    };
  }

  private async executeVideoPreferenceMutation(input: {
    context: YouTubeActionContext;
    videoId: string;
    path: string;
    expectedLikeStatus: "LIKE" | "DISLIKE" | "INDIFFERENT";
    fallbackMessage: string;
  }): Promise<void> {
    try {
      const response = await input.context.client.request<Record<string, unknown>>(
        this.buildYoutubeiUrl(input.path, input.context.apiKey),
        {
          method: "POST",
          expectedStatus: 200,
          headers: await this.buildYouTubeApiHeaders(input.context.client, {
            clientVersion: input.context.clientVersion,
            visitorData: input.context.page.visitorData,
            delegatedSessionId: input.context.page.delegatedSessionId,
            sessionIndex: input.context.page.sessionIndex,
            referer: input.context.url,
          }),
          body: JSON.stringify({
            context: this.buildYouTubeContext({
              clientVersion: input.context.clientVersion,
              visitorData: input.context.page.visitorData,
              originalUrl: input.context.url,
            }),
            target: {
              videoId: input.videoId,
            },
          }),
        },
      );

      const likeStatus = this.extractLikeStatus(response);
      if (likeStatus && likeStatus !== input.expectedLikeStatus) {
        throw new AutoCliError("YOUTUBE_REQUEST_REJECTED", "YouTube did not apply the requested video preference.", {
          details: {
            expectedLikeStatus: input.expectedLikeStatus,
            actualLikeStatus: likeStatus,
            path: input.path,
          },
        });
      }
    } catch (error) {
      throw this.mapYouTubeWriteError(error, input.fallbackMessage);
    }
  }

  private async executeSubscriptionMutation(input: {
    context: YouTubeActionContext;
    channelId: string;
    path: string;
    expectedSubscribed: boolean;
    fallbackMessage: string;
  }): Promise<void> {
    try {
      const response = await input.context.client.request<Record<string, unknown>>(
        this.buildYoutubeiUrl(input.path, input.context.apiKey),
        {
          method: "POST",
          expectedStatus: [200, 404],
          headers: await this.buildYouTubeApiHeaders(input.context.client, {
            clientVersion: input.context.clientVersion,
            visitorData: input.context.page.visitorData,
            delegatedSessionId: input.context.page.delegatedSessionId,
            sessionIndex: input.context.page.sessionIndex,
            referer: input.context.url,
          }),
          body: JSON.stringify({
            context: this.buildYouTubeContext({
              clientVersion: input.context.clientVersion,
              visitorData: input.context.page.visitorData,
              originalUrl: input.context.url,
            }),
            channelIds: [input.channelId],
          }),
        },
      );

      const modalMessage = this.extractSubscriptionErrorMessage(response);
      if (modalMessage) {
        throw new AutoCliError("YOUTUBE_REQUEST_REJECTED", modalMessage, {
          details: {
            channelId: input.channelId,
            path: input.path,
          },
        });
      }

      const subscribedState = this.extractSubscribedState(response, input.channelId);
      if (typeof subscribedState === "boolean" && subscribedState !== input.expectedSubscribed) {
        throw new AutoCliError("YOUTUBE_REQUEST_REJECTED", "YouTube did not apply the requested subscription state.", {
          details: {
            channelId: input.channelId,
            expectedSubscribed: input.expectedSubscribed,
            actualSubscribed: subscribedState,
            path: input.path,
          },
        });
      }
    } catch (error) {
      throw this.mapYouTubeWriteError(error, input.fallbackMessage);
    }
  }

  private async loadWatchPageContext(
    client: Awaited<ReturnType<YouTubeAdapter["createYouTubeClient"]>>,
    videoId: string,
  ): Promise<YouTubePageConfig> {
    return this.loadPageContext(client, `${YOUTUBE_WATCH}${videoId}`);
  }

  private async loadPageContext(
    client: Awaited<ReturnType<YouTubeAdapter["createYouTubeClient"]>>,
    url: string,
  ): Promise<YouTubePageConfig> {
    const html = await client.request<string>(url, {
      responseType: "text",
      expectedStatus: 200,
      headers: {
        referer: YOUTUBE_HOME,
      },
    });

    const page = this.parseYouTubePageConfig(html);
    if (page.loggedIn === false) {
      throw new AutoCliError("SESSION_EXPIRED", "YouTube returned a logged-out page. Re-import cookies.txt.");
    }

    return page;
  }

  private parseYouTubePageConfig(html: string): YouTubePageConfig {
    return {
      apiKey: this.matchQuotedValue(html, /"INNERTUBE_API_KEY":"([^"]+)"/),
      clientVersion: this.matchQuotedValue(html, /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/),
      visitorData: this.matchQuotedValue(html, /"VISITOR_DATA":"([^"]+)"/),
      delegatedSessionId: this.matchQuotedValue(html, /"DELEGATED_SESSION_ID":"([^"]+)"/),
      sessionIndex: this.matchQuotedValue(html, /"SESSION_INDEX":"?([^",}]+)"?/),
      createCommentParams: this.matchQuotedValue(html, /"createCommentParams":"([^"]+)"/),
      loggedIn: this.matchBoolean(html, /"LOGGED_IN":(true|false)/),
    };
  }

  private matchQuotedValue(html: string, pattern: RegExp): string | undefined {
    const match = html.match(pattern);
    if (!match?.[1]) {
      return undefined;
    }

    try {
      return JSON.parse(`"${match[1]}"`) as string;
    } catch {
      return match[1];
    }
  }

  private matchBoolean(html: string, pattern: RegExp): boolean | undefined {
    const match = html.match(pattern);
    if (!match?.[1]) {
      return undefined;
    }

    return match[1] === "true";
  }

  private toMetadata(page: YouTubePageConfig): Record<string, unknown> {
    return {
      ...(page.apiKey ? { apiKey: page.apiKey } : {}),
      ...(page.clientVersion ? { clientVersion: page.clientVersion } : {}),
      ...(page.visitorData ? { visitorData: page.visitorData } : {}),
      ...(page.delegatedSessionId ? { delegatedSessionId: page.delegatedSessionId } : {}),
      ...(page.sessionIndex ? { sessionIndex: page.sessionIndex } : {}),
    };
  }

  private requirePageField<T extends string>(
    value: T | undefined,
    fieldLabel: string,
    message?: string,
  ): T {
    if (!value) {
      throw new AutoCliError("YOUTUBE_PAGE_CONFIG_MISSING", message ?? `Missing ${fieldLabel} from the YouTube page.`);
    }

    return value;
  }

  private buildYoutubeiUrl(path: string, apiKey: string): string {
    return `${YOUTUBE_ORIGIN}/youtubei/v1/${path}?prettyPrint=false&key=${encodeURIComponent(apiKey)}`;
  }

  private async buildYouTubeApiHeaders(
    client: Awaited<ReturnType<YouTubeAdapter["createYouTubeClient"]>>,
    input: {
      clientVersion: string;
      visitorData?: string;
      delegatedSessionId?: string;
      sessionIndex?: string;
      referer: string;
    },
  ): Promise<Record<string, string>> {
    const sapisid = await this.getAuthCookieValue(client);
    if (!sapisid) {
      throw new AutoCliError("SESSION_EXPIRED", "YouTube SAPISID cookie is missing. Re-import cookies.txt.");
    }

    return {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      authorization: buildSapisidHash(sapisid, YOUTUBE_ORIGIN),
      "content-type": "application/json",
      origin: YOUTUBE_ORIGIN,
      referer: input.referer,
      "user-agent": YOUTUBE_USER_AGENT,
      "x-goog-authuser": input.sessionIndex ?? "0",
      ...(input.delegatedSessionId ? { "x-goog-pageid": input.delegatedSessionId } : {}),
      ...(input.visitorData ? { "x-goog-visitor-id": input.visitorData } : {}),
      "x-origin": YOUTUBE_ORIGIN,
      "x-youtube-bootstrap-logged-in": "true",
      "x-youtube-client-name": YOUTUBE_CLIENT_NAME_ID,
      "x-youtube-client-version": input.clientVersion,
    };
  }

  private buildYouTubeContext(input: {
    clientVersion: string;
    visitorData?: string;
    originalUrl: string;
  }): Record<string, unknown> {
    return {
      client: {
        clientName: YOUTUBE_CLIENT_NAME,
        clientVersion: input.clientVersion,
        hl: "en",
        gl: "US",
        visitorData: input.visitorData,
        userAgent: YOUTUBE_USER_AGENT,
        browserName: "Chrome",
        browserVersion: "136.0.0.0",
        osName: "Macintosh",
        osVersion: "10_15_7",
        platform: "DESKTOP",
        clientFormFactor: "UNKNOWN_FORM_FACTOR",
        originalUrl: input.originalUrl,
      },
      user: {
        lockedSafetyMode: false,
      },
      request: {
        useSsl: true,
      },
    };
  }

  private async getAuthCookieValue(
    client: Awaited<ReturnType<YouTubeAdapter["createYouTubeClient"]>>,
  ): Promise<string | undefined> {
    return (
      (await client.getCookieValue("SAPISID", YOUTUBE_HOME)) ??
      (await client.getCookieValue("__Secure-3PAPISID", YOUTUBE_HOME)) ??
      (await client.getCookieValue("APISID", YOUTUBE_HOME)) ??
      (await client.getCookieValue("__Secure-1PAPISID", YOUTUBE_HOME))
    );
  }

  private extractLikeStatus(response: Record<string, unknown>): string | undefined {
    const entityBatchUpdate =
      response.frameworkUpdates &&
      typeof response.frameworkUpdates === "object" &&
      "entityBatchUpdate" in response.frameworkUpdates
        ? response.frameworkUpdates.entityBatchUpdate
        : undefined;

    if (!entityBatchUpdate || typeof entityBatchUpdate !== "object" || !("mutations" in entityBatchUpdate)) {
      return undefined;
    }

    const mutations = Array.isArray(entityBatchUpdate.mutations) ? entityBatchUpdate.mutations : [];
    for (const mutation of mutations) {
      if (!mutation || typeof mutation !== "object") {
        continue;
      }

      const payload = "payload" in mutation ? mutation.payload : undefined;
      if (!payload || typeof payload !== "object" || !("likeStatusEntity" in payload)) {
        continue;
      }

      const likeStatusEntity = payload.likeStatusEntity;
      if (
        likeStatusEntity &&
        typeof likeStatusEntity === "object" &&
        "likeStatus" in likeStatusEntity &&
        typeof likeStatusEntity.likeStatus === "string"
      ) {
        return likeStatusEntity.likeStatus;
      }
    }

    return undefined;
  }

  private extractSubscriptionErrorMessage(response: Record<string, unknown>): string | undefined {
    const actions = Array.isArray(response.actions) ? response.actions : [];
    for (const action of actions) {
      if (!action || typeof action !== "object" || !("openPopupAction" in action)) {
        continue;
      }

      const popup = action.openPopupAction;
      if (!popup || typeof popup !== "object" || !("popup" in popup)) {
        continue;
      }

      const popupRenderer = popup.popup;
      const title = this.extractTextFromRunsPath(popupRenderer, [
        "modalWithTitleAndButtonRenderer",
        "title",
        "runs",
      ]);
      const content = this.extractSimpleTextPath(popupRenderer, [
        "modalWithTitleAndButtonRenderer",
        "content",
        "simpleText",
      ]);

      if (title || content) {
        return [title, content].filter(Boolean).join(": ");
      }
    }

    return undefined;
  }

  private extractSubscribedState(response: Record<string, unknown>, channelId: string): boolean | undefined {
    const actions = Array.isArray(response.actions) ? response.actions : [];
    for (const action of actions) {
      if (!action || typeof action !== "object" || !("updateSubscribeButtonAction" in action)) {
        continue;
      }

      const update = action.updateSubscribeButtonAction;
      if (
        update &&
        typeof update === "object" &&
        "channelId" in update &&
        update.channelId === channelId &&
        "subscribed" in update &&
        typeof update.subscribed === "boolean"
      ) {
        return update.subscribed;
      }
    }

    return undefined;
  }

  private extractTextFromRunsPath(node: unknown, path: string[]): string | undefined {
    const target = this.getNestedValue(node, path);
    if (!Array.isArray(target)) {
      return undefined;
    }

    return target
      .map((entry) =>
        entry && typeof entry === "object" && "text" in entry && typeof entry.text === "string" ? entry.text : "",
      )
      .filter(Boolean)
      .join("");
  }

  private extractSimpleTextPath(node: unknown, path: string[]): string | undefined {
    const target = this.getNestedValue(node, path);
    return typeof target === "string" ? target : undefined;
  }

  private getNestedValue(node: unknown, path: string[]): unknown {
    let current = node;

    for (const key of path) {
      if (!current || typeof current !== "object" || !(key in current)) {
        return undefined;
      }

      current = current[key as keyof typeof current];
    }

    return current;
  }

  private async resolveChannelTarget(
    client: Awaited<ReturnType<YouTubeAdapter["createYouTubeClient"]>>,
    target: string,
  ): Promise<{ channelId: string; url: string }> {
    const parsed = parseYouTubeChannelTarget(target);
    if (parsed.channelId) {
      return {
        channelId: parsed.channelId,
        url: parsed.url ?? `${YOUTUBE_ORIGIN}/channel/${parsed.channelId}`,
      };
    }

    const url = parsed.url ?? `${YOUTUBE_ORIGIN}${parsed.handle ?? parsed.path ?? ""}`;
    const html = await client.request<string>(url, {
      responseType: "text",
      expectedStatus: 200,
      headers: {
        referer: YOUTUBE_HOME,
      },
    });

    const channelId = this.extractChannelId(html);
    if (!channelId) {
      throw new AutoCliError("YOUTUBE_CHANNEL_RESOLUTION_FAILED", "Could not resolve the YouTube channel ID.", {
        details: {
          target,
          url,
        },
      });
    }

    return {
      channelId,
      url,
    };
  }

  private extractChannelId(html: string): string | undefined {
    return (
      this.matchQuotedValue(html, /"externalId":"(UC[^"]+)"/) ??
      this.matchQuotedValue(html, /"browseId":"(UC[^"]+)"/) ??
      this.matchQuotedValue(html, /"channelId":"(UC[^"]+)"/)
    );
  }

  private parseVideoInfoResponse(
    response: Record<string, unknown>,
    videoId: string,
    url: string,
  ): YouTubeVideoInfo {
    const playabilityStatus =
      "playabilityStatus" in response && response.playabilityStatus && typeof response.playabilityStatus === "object"
        ? response.playabilityStatus
        : undefined;

    const playabilityState =
      playabilityStatus && "status" in playabilityStatus && typeof playabilityStatus.status === "string"
        ? playabilityStatus.status
        : undefined;

    if (playabilityState && playabilityState !== "OK") {
      const reason =
        (playabilityStatus && "reason" in playabilityStatus && typeof playabilityStatus.reason === "string"
          ? playabilityStatus.reason
          : undefined) ?? "Video unavailable";
      throw new AutoCliError("YOUTUBE_VIDEO_UNAVAILABLE", reason, {
        details: {
          videoId,
          playabilityStatus: playabilityState,
        },
      });
    }

    const videoDetails =
      "videoDetails" in response && response.videoDetails && typeof response.videoDetails === "object"
        ? response.videoDetails
        : undefined;
    if (!videoDetails) {
      throw new AutoCliError("YOUTUBE_VIDEO_INFO_MISSING", "YouTube did not return video details.", {
        details: { videoId },
      });
    }

    const microformat =
      "microformat" in response && response.microformat && typeof response.microformat === "object"
        ? response.microformat
        : undefined;
    const playerMicroformat =
      microformat &&
      "playerMicroformatRenderer" in microformat &&
      microformat.playerMicroformatRenderer &&
      typeof microformat.playerMicroformatRenderer === "object"
        ? microformat.playerMicroformatRenderer
        : undefined;

    const durationSeconds =
      "lengthSeconds" in videoDetails && typeof videoDetails.lengthSeconds === "string"
        ? Number.parseInt(videoDetails.lengthSeconds, 10)
        : undefined;
    const parsedViewCount =
      "viewCount" in videoDetails && typeof videoDetails.viewCount === "string"
        ? Number.parseInt(videoDetails.viewCount, 10)
        : undefined;
    const channelId =
      ("channelId" in videoDetails && typeof videoDetails.channelId === "string"
        ? videoDetails.channelId
        : undefined) ??
      (playerMicroformat &&
      "externalChannelId" in playerMicroformat &&
      typeof playerMicroformat.externalChannelId === "string"
        ? playerMicroformat.externalChannelId
        : undefined);

    return {
      id: videoId,
      title:
        ("title" in videoDetails && typeof videoDetails.title === "string" ? videoDetails.title : undefined) ??
        "Untitled video",
      url,
      channel:
        ("author" in videoDetails && typeof videoDetails.author === "string" ? videoDetails.author : undefined) ??
        (playerMicroformat
          ? this.extractTextValue(
              "ownerChannelName" in playerMicroformat ? playerMicroformat.ownerChannelName : undefined,
            )
          : undefined),
      channelId,
      channelUrl: channelId ? `${YOUTUBE_ORIGIN}/channel/${channelId}` : undefined,
      duration:
        typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
          ? formatDuration(durationSeconds)
          : undefined,
      durationSeconds:
        typeof durationSeconds === "number" && Number.isFinite(durationSeconds) ? durationSeconds : undefined,
      views:
        typeof parsedViewCount === "number" && Number.isFinite(parsedViewCount)
          ? `${parsedViewCount.toLocaleString("en-US")} views`
          : undefined,
      published:
        (playerMicroformat &&
        "publishDate" in playerMicroformat &&
        typeof playerMicroformat.publishDate === "string"
          ? playerMicroformat.publishDate
          : undefined) ??
        (playerMicroformat &&
        "uploadDate" in playerMicroformat &&
        typeof playerMicroformat.uploadDate === "string"
          ? playerMicroformat.uploadDate
          : undefined),
      description:
        ("shortDescription" in videoDetails && typeof videoDetails.shortDescription === "string"
          ? videoDetails.shortDescription
          : undefined) ??
        (playerMicroformat ? this.extractDescriptionValue(playerMicroformat as Record<string, unknown>) : undefined),
      category:
        playerMicroformat && "category" in playerMicroformat && typeof playerMicroformat.category === "string"
          ? playerMicroformat.category
          : undefined,
      thumbnailUrl: this.extractThumbnailUrl("thumbnail" in videoDetails ? videoDetails.thumbnail : undefined),
      live:
        ("isLiveContent" in videoDetails && typeof videoDetails.isLiveContent === "boolean"
          ? videoDetails.isLiveContent
          : undefined) ??
        (playerMicroformat && "isLive" in playerMicroformat && typeof playerMicroformat.isLive === "boolean"
          ? playerMicroformat.isLive
          : undefined),
    };
  }

  private extractSearchResults(response: Record<string, unknown>, limit: number): YouTubeSearchResultItem[] {
    const results: YouTubeSearchResultItem[] = [];
    this.walkForSearchResults(response, results, limit);
    return results;
  }

  private walkForSearchResults(node: unknown, results: YouTubeSearchResultItem[], limit: number): void {
    if (results.length >= limit || node == null) {
      return;
    }

    if (Array.isArray(node)) {
      for (const entry of node) {
        this.walkForSearchResults(entry, results, limit);
        if (results.length >= limit) {
          return;
        }
      }
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    if ("videoRenderer" in node) {
      const item = this.parseVideoSearchRenderer((node as { videoRenderer?: unknown }).videoRenderer);
      if (item) {
        results.push(item);
      }
      return;
    }

    for (const value of Object.values(node)) {
      this.walkForSearchResults(value, results, limit);
      if (results.length >= limit) {
        return;
      }
    }
  }

  private parseVideoSearchRenderer(renderer: unknown): YouTubeSearchResultItem | undefined {
    if (!renderer || typeof renderer !== "object" || !("videoId" in renderer) || typeof renderer.videoId !== "string") {
      return undefined;
    }

    const title = this.extractTextValue("title" in renderer ? renderer.title : undefined);
    if (!title) {
      return undefined;
    }

    const videoId = renderer.videoId;
    return {
      id: videoId,
      title,
      url: `${YOUTUBE_WATCH}${videoId}`,
      channel: this.extractTextValue(
        ("longBylineText" in renderer ? renderer.longBylineText : undefined) ??
          ("ownerText" in renderer ? renderer.ownerText : undefined),
      ),
      duration: this.extractTextValue("lengthText" in renderer ? renderer.lengthText : undefined),
      views: this.extractTextValue("viewCountText" in renderer ? renderer.viewCountText : undefined),
      published: this.extractTextValue("publishedTimeText" in renderer ? renderer.publishedTimeText : undefined),
      description: this.extractDescriptionValue(renderer),
      thumbnailUrl: this.extractThumbnailUrl("thumbnail" in renderer ? renderer.thumbnail : undefined),
    };
  }

  private extractDescriptionValue(renderer: Record<string, unknown>): string | undefined {
    const snippet =
      ("detailedMetadataSnippets" in renderer ? renderer.detailedMetadataSnippets : undefined) ??
      ("descriptionSnippet" in renderer ? renderer.descriptionSnippet : undefined);

    if (Array.isArray(snippet) && snippet[0] && typeof snippet[0] === "object") {
      return this.extractTextValue(
        "snippetText" in snippet[0] ? snippet[0].snippetText : "runs" in snippet[0] ? snippet[0] : undefined,
      );
    }

    return this.extractTextValue(snippet);
  }

  private extractThumbnailUrl(node: unknown): string | undefined {
    if (!node || typeof node !== "object" || !("thumbnails" in node) || !Array.isArray(node.thumbnails)) {
      return undefined;
    }

    const thumbnails = node.thumbnails.filter(
      (entry): entry is { url: string } => Boolean(entry && typeof entry === "object" && "url" in entry && typeof entry.url === "string"),
    );

    return thumbnails.at(-1)?.url;
  }

  private extractTextValue(node: unknown): string | undefined {
    if (!node || typeof node !== "object") {
      return typeof node === "string" ? node : undefined;
    }

    if ("simpleText" in node && typeof node.simpleText === "string") {
      return node.simpleText;
    }

    if ("runs" in node && Array.isArray(node.runs)) {
      const text = node.runs
        .map((entry) =>
          entry && typeof entry === "object" && "text" in entry && typeof entry.text === "string" ? entry.text : "",
        )
        .filter(Boolean)
        .join("");
      return text || undefined;
    }

    return undefined;
  }

  private mapYouTubeWriteError(error: unknown, fallbackMessage: string): AutoCliError {
    if (
      isAutoCliError(error) &&
      (error.code === "YOUTUBE_REQUEST_REJECTED" ||
        error.code === "YOUTUBE_VIDEO_UNAVAILABLE" ||
        error.code === "YOUTUBE_VIDEO_INFO_MISSING")
    ) {
      return error;
    }

    if (isAutoCliError(error) && error.code === "HTTP_REQUEST_FAILED") {
      const status = typeof error.details?.status === "number" ? error.details.status : undefined;

      if (status === 400) {
        return new AutoCliError(
          "YOUTUBE_REQUEST_REJECTED",
          "YouTube rejected this action request. The video may not allow this action, or the saved cookies need a fresh export.",
          {
            cause: error,
            details: error.details,
          },
        );
      }

      if (status === 401 || status === 403) {
        return new AutoCliError(
          "SESSION_EXPIRED",
          "YouTube rejected the saved session for this action. Re-export cookies from an active browser session.",
          {
            cause: error,
            details: error.details,
          },
        );
      }
    }

    return new AutoCliError("PLATFORM_REQUEST_FAILED", fallbackMessage, {
      cause: error,
      details:
        isAutoCliError(error) && error.details
          ? error.details
          : error instanceof Error
            ? { message: error.message }
            : undefined,
    });
  }

  private async persistSessionState(session: PlatformSession, probe: YouTubeProbe): Promise<void> {
    await this.persistExistingSession(session, {
      user: session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  private async filterYouTubeCookies(sourceJar: CookieJar): Promise<CookieJar> {
    const filteredJar = new CookieJar();
    const cookies = await sourceJar.getCookies(YOUTUBE_HOME);

    for (const cookie of cookies) {
      if (!YOUTUBE_COOKIE_ALLOWLIST.has(cookie.key)) {
        continue;
      }

      const normalized = Cookie.fromJSON(cookie.toJSON());
      if (!normalized) {
        continue;
      }

      await filteredJar.setCookie(normalized, `https://${cookie.domain}${cookie.path || "/"}`, {
        ignoreError: true,
      });
    }

    return filteredJar;
  }
}

function buildSapisidHash(sapisid: string, origin: string): string {
  const timestamp = Math.floor(Date.now() / 1_000);
  const digest = createHash("sha1").update(`${timestamp} ${sapisid} ${origin}`).digest("hex");
  return `SAPISIDHASH ${timestamp}_${digest}`;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
