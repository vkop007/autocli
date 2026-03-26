import { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";
import { ClaudeService } from "./service.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, PlatformSession } from "../../../types.js";

export class ClaudeAdapter extends CookieLlmAdapter {
  private readonly service = new ClaudeService();

  constructor() {
    super({
      platform: "claude",
      textUnsupportedMessage: "Claude text prompting is temporarily unavailable.",
      imageUnsupportedMessage: "Claude image prompting is temporarily unavailable.",
      videoUnsupportedMessage:
        "Claude video prompting is not implemented in this CLI because the browserless web video flow is not mapped.",
    });
  }

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const result = await super.login(input);
    return this.refreshSavedSession(result.account, result.sessionPath);
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);
    const persisted = await this.persistExistingSession(session, {
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(inspection.organizationId ? { organizationId: inspection.organizationId } : {}),
        ...(inspection.organizationName ? { organizationName: inspection.organizationName } : {}),
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
    const result = await this.service.executeText(client, {
      prompt: input.prompt,
      model: input.model,
      preferredOrganizationId: readSessionOrganizationId(session),
    });

    await this.persistExistingSession(session, {
      jar: client.jar,
      status: {
        state: "active",
        message: "Claude session is active.",
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        ...(session.metadata ?? {}),
        organizationId: result.organizationId,
        ...(result.organizationName ? { organizationName: result.organizationName } : {}),
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "text",
      message: `Claude replied using ${result.model}.`,
      id: result.chatId,
      url: result.url,
      user: session.user,
      data: {
        model: result.model,
        outputText: result.outputText,
        chatId: result.chatId,
        organizationId: result.organizationId,
        organizationName: result.organizationName,
      },
    };
  }

  protected async executeImage(
    session: PlatformSession,
    input: {
      account?: string;
      mediaPath: string;
      caption?: string;
      model?: string;
    },
  ): Promise<AdapterActionResult> {
    const client = await this.createClient(session);
    const result = await this.service.executeImage(client, {
      mediaPath: input.mediaPath,
      caption: input.caption,
      model: input.model,
      preferredOrganizationId: readSessionOrganizationId(session),
    });

    await this.persistExistingSession(session, {
      jar: client.jar,
      status: {
        state: "active",
        message: "Claude session is active.",
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        ...(session.metadata ?? {}),
        organizationId: result.organizationId,
        ...(result.organizationName ? { organizationName: result.organizationName } : {}),
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "image",
      message: `Claude processed the uploaded image using ${result.model}.`,
      id: result.chatId,
      url: result.url,
      user: session.user,
      data: {
        model: result.model,
        outputText: result.outputText,
        chatId: result.chatId,
        fileId: result.fileId,
        organizationId: result.organizationId,
        organizationName: result.organizationName,
      },
    };
  }

  private async refreshSavedSession(account: string, sessionPath?: string): Promise<AdapterActionResult> {
    const { session, path } = await this.loadSession(account);
    const inspection = await this.inspectSavedSession(session);

    await this.persistExistingSession(session, {
      status: inspection.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(inspection.organizationId ? { organizationId: inspection.organizationId } : {}),
        ...(inspection.organizationName ? { organizationName: inspection.organizationName } : {}),
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "login",
      message:
        inspection.status.state === "active"
          ? `Saved Claude session for ${session.account}.`
          : `Saved Claude session for ${session.account}, but ${inspection.status.message?.toLowerCase() ?? "live validation could not complete."}`,
      sessionPath: sessionPath ?? path,
      user: session.user,
      data: {
        status: inspection.status.state,
      },
    };
  }

  private async inspectSavedSession(session: PlatformSession) {
    const client = await this.createClient(session);
    return this.service.inspectSession(client, readSessionOrganizationId(session));
  }
}

function readSessionOrganizationId(session: PlatformSession): string | undefined {
  return typeof session.metadata?.organizationId === "string" ? session.metadata.organizationId : undefined;
}

export const claudeAdapter = new ClaudeAdapter();
