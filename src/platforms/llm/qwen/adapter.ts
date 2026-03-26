import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";
import { QwenWebClient, mapQwenError, normalizeQwenAuthToken } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, PlatformSession } from "../../../types.js";

export class QwenAdapter extends CookieLlmAdapter {
  constructor() {
    super({
      platform: "qwen",
      defaultModel: "qwen-max-latest",
      textUnsupportedMessage: "Qwen text prompting is temporarily unavailable.",
      imageUnsupportedMessage: "Qwen image prompting is not wired in this CLI yet.",
      videoUnsupportedMessage: "Qwen video prompting is not wired in this CLI yet.",
    });
  }

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const account = input.account?.trim() || "default";
    const token = normalizeOptionalQwenToken(input.token);
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      status: {
        state: "unknown",
        message: "Qwen session imported. Verifying bearer token...",
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        defaultModel: "qwen-max-latest",
        ...(token ? { qwenAuthToken: token } : {}),
      },
      jar: imported.jar,
    });

    return this.refreshSavedSession(account, sessionPath);
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);
    const persisted = await this.persistExistingSession(session, {
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel ?? session.metadata?.defaultModel ?? "qwen-max-latest",
      },
    });

    return this.buildStatusResult({
      account: persisted.account,
      sessionPath: path,
      status: inspection.status,
      user: persisted.user,
    });
  }

  protected async executeText(
    session: PlatformSession,
    input: {
      account?: string;
      prompt: string;
      model?: string;
    },
  ): Promise<AdapterActionResult> {
    const client = await this.createClient(session);

    try {
      const result = await new QwenWebClient(client, readQwenToken(session)).executeText({
        prompt: input.prompt,
        model: input.model,
      });

      await this.persistExistingSession(session, {
        status: {
          state: "active",
          message: "Qwen session is active.",
          lastValidatedAt: new Date().toISOString(),
        },
        metadata: {
          ...(session.metadata ?? {}),
          defaultModel: result.model,
        },
      });

      return {
        ok: true,
        platform: this.platform,
        account: session.account,
        action: "text",
        message: `Qwen replied using ${result.model}.`,
        data: {
          model: result.model,
          outputText: result.outputText,
          searchResults: result.searchResults,
        },
      };
    } catch (error) {
      throw mapQwenError(error, "Failed to complete the Qwen prompt.");
    }
  }

  private async refreshSavedSession(account: string, sessionPath?: string): Promise<AdapterActionResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);

    await this.persistExistingSession(session, {
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel ?? session.metadata?.defaultModel ?? "qwen-max-latest",
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "login",
      message:
        inspection.status.state === "active"
          ? `Saved Qwen session for ${session.account}.`
          : `Saved Qwen session for ${session.account}, but ${inspection.status.message?.toLowerCase() ?? "live validation could not complete."}`,
      sessionPath: sessionPath ?? path,
      data: {
        status: inspection.status.state,
      },
    };
  }

  private async inspectSavedSession(session: PlatformSession) {
    const client = await this.createClient(session);
    return new QwenWebClient(client, readQwenToken(session)).inspectSession();
  }
}

export const qwenAdapter = new QwenAdapter();

function readQwenToken(session: PlatformSession): string | undefined {
  const token = session.metadata?.qwenAuthToken;
  return typeof token === "string" && token.trim().length > 0 ? token : undefined;
}

function normalizeOptionalQwenToken(token?: string): string | undefined {
  if (typeof token !== "string" || token.trim().length === 0) {
    return undefined;
  }

  return normalizeQwenAuthToken(token);
}
