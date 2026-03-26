import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";
import { GeminiService } from "./service.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, PlatformSession } from "../../../types.js";

export class GeminiAdapter extends CookieLlmAdapter {
  private readonly service = new GeminiService();

  constructor() {
    super({
      platform: "gemini",
      defaultModel: "gemini-3-flash",
      textUnsupportedMessage:
        "Gemini text prompting is temporarily unavailable.",
      imageUnsupportedMessage:
        "Gemini image prompting is scaffolded, but the private multimodal upload flow still needs live validation.",
      videoUnsupportedMessage:
        "Gemini video prompting is scaffolded, but the private media-generation flow is not mapped yet in this CLI.",
    });
  }

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const result = await super.login(input);
    return this.refreshSavedSession(result.account, result.sessionPath);
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);
    await this.persistExistingSession(session, {
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel,
      },
    });

    return this.buildStatusResult({
      account: session.account,
      sessionPath: path,
      status: inspection.status,
      user: session.user,
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
    const result = await this.service.executeText(client, {
      prompt: input.prompt,
      model: input.model,
    });

    await this.persistExistingSession(session, {
      jar: client.jar,
      status: {
        state: "active",
        message: "Gemini session is active.",
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
      message: `Gemini replied using ${result.model}.`,
      id: result.candidateId,
      url: result.url,
      user: session.user,
      data: {
        model: result.model,
        chatId: result.chatId,
        responseId: result.responseId,
        candidateId: result.candidateId,
        outputText: result.outputText,
      },
    };
  }

  private async refreshSavedSession(account: string, sessionPath?: string): Promise<AdapterActionResult> {
    const { session, path } = await this.loadSession(account);
    const client = await this.createClient(session);
    const inspection = await this.service.inspectSession(client);

    await this.persistExistingSession(session, {
      jar: client.jar,
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        defaultModel: inspection.defaultModel,
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "login",
      message:
        inspection.status.state === "active"
          ? `Saved Gemini session for ${session.account}.`
          : `Saved Gemini session for ${session.account}, but ${inspection.status.message?.toLowerCase() ?? "live validation could not complete."}`,
      sessionPath: sessionPath ?? path,
      user: session.user,
      data: {
        status: inspection.status.state,
      },
    };
  }

  private async inspectSavedSession(session: PlatformSession) {
    const client = await this.createClient(session);
    return this.service.inspectSession(client);
  }
}

export const geminiAdapter = new GeminiAdapter();
