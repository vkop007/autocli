import { MikaCliError } from "../../../errors.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

const OLLAMA_ORIGIN = "https://ollama.com";
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;
const PAGE_SIZE_HINT = 10;

type FetchLike = typeof fetch;
type OllamaSearchSort = "popular" | "newest";

export type OllamaModelSearchInput = {
  query?: string;
  limit?: number;
  capability?: string;
  sort?: OllamaSearchSort;
};

export class OllamaCatalogClient {
  constructor(private readonly fetchFn: FetchLike = fetch) {}

  async searchModels(input: OllamaModelSearchInput): Promise<Record<string, unknown>[]> {
    const limit = normalizeOllamaLimit(input.limit);
    const items: Record<string, unknown>[] = [];
    const pagesToFetch = Math.max(1, Math.ceil(limit / PAGE_SIZE_HINT));

    for (let page = 1; page <= pagesToFetch && items.length < limit; page += 1) {
      const url = this.buildSearchUrl(input, page);
      const html = await this.requestHtml(url);
      const pageItems = parseOllamaSearchModels(html);
      items.push(...pageItems);
      if (pageItems.length === 0 || !hasMoreSearchPages(html)) {
        break;
      }
    }

    return dedupeById(items).slice(0, limit);
  }

  async getModel(model: string): Promise<Record<string, unknown>> {
    const modelId = normalizeOllamaModelId(model);
    const url = buildOllamaModelUrl(modelId);
    const html = await this.requestHtml(url);
    return parseOllamaModelPage(html, modelId, url.toString());
  }

  private buildSearchUrl(input: OllamaModelSearchInput, page: number): URL {
    const url = new URL("/search", OLLAMA_ORIGIN);
    const query = normalizeOptionalText(input.query);
    if (query) {
      url.searchParams.set("q", query);
    }
    if (page > 1) {
      url.searchParams.set("page", String(page));
    }
    const capability = normalizeOllamaCapability(input.capability);
    if (capability) {
      url.searchParams.set("c", capability);
    }
    const sort = input.sort ?? "popular";
    if (sort !== "popular") {
      url.searchParams.set("o", sort);
    }
    return url;
  }

  private async requestHtml(url: URL): Promise<string> {
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "mikacli-ollama",
        },
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      throw new MikaCliError("OLLAMA_REQUEST_FAILED", "Failed to reach Ollama.", {
        details: {
          url: url.toString(),
        },
        cause: error,
      });
    }

    const text = await response.text();
    if (!response.ok) {
      throw new MikaCliError("OLLAMA_REQUEST_FAILED", `Ollama request failed with ${response.status} ${response.statusText}.`, {
        details: {
          status: response.status,
          url: url.toString(),
          response: text.slice(0, 500),
        },
      });
    }

    return text;
  }
}

export class OllamaAdapter {
  readonly platform = "ollama" as Platform;
  readonly displayName = "Ollama";

  constructor(private readonly client = new OllamaCatalogClient()) {}

  async searchModels(input: OllamaModelSearchInput): Promise<AdapterActionResult> {
    const models = await this.client.searchModels(input);
    const items = models.map((entry) => summarizeOllamaModel(entry));
    return this.buildResult({
      action: "models-search",
      message: buildSearchMessage(items.length, input.query),
      data: {
        query: normalizeOptionalText(input.query) ?? null,
        models: items,
        search: summarizeSearchInput(input),
      },
    });
  }

  async model(input: { model: string }): Promise<AdapterActionResult> {
    const modelId = normalizeOllamaModelId(input.model);
    const model = await this.client.getModel(modelId);
    const summary = summarizeOllamaModel(model);
    const id = readSummaryString(summary, "id") ?? modelId;
    const url = readSummaryString(summary, "url") ?? buildOllamaModelUrl(id).toString();
    return this.buildResult({
      action: "model",
      message: `Loaded Ollama model ${id}.`,
      id,
      url,
      data: {
        model: summary,
        entity: summary,
      },
    });
  }

  private buildResult(input: {
    action: string;
    message: string;
    id?: string;
    url?: string;
    data?: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: input.action,
      message: input.message,
      id: input.id,
      url: input.url,
      data: input.data,
    };
  }
}

export const ollamaAdapter = new OllamaAdapter();

export function parseOllamaLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new MikaCliError("OLLAMA_OPTION_INVALID", `Expected a positive integer limit, received "${value}".`);
  }

  return normalizeOllamaLimit(parsed);
}

export function parseOllamaSortOption(value: string): OllamaSearchSort {
  const normalized = value.trim().toLowerCase();
  if (normalized === "popular" || normalized === "newest") {
    return normalized;
  }

  throw new MikaCliError("OLLAMA_OPTION_INVALID", `Expected sort popular or newest, received "${value}".`);
}

export function normalizeOllamaLimit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SEARCH_LIMIT;
  }

  return Math.max(1, Math.min(MAX_SEARCH_LIMIT, Math.trunc(value)));
}

export function normalizeOllamaModelId(value: string): string {
  const withoutOrigin = value.trim().replace(/^https:\/\/(?:www\.)?ollama\.com\//iu, "");
  const normalized = withoutOrigin.replace(/^library\//iu, "").replace(/^\/+/u, "").replace(/\/+$/u, "");
  if (!normalized) {
    throw new MikaCliError("OLLAMA_MODEL_REQUIRED", "Provide an Ollama model name.");
  }

  return normalized;
}

export function buildOllamaModelUrl(modelId: string): URL {
  const normalized = normalizeOllamaModelId(modelId);
  const path = normalized.includes("/") ? `/${normalized}` : `/library/${normalized}`;
  return new URL(path, OLLAMA_ORIGIN);
}

export function summarizeOllamaModel(record: Record<string, unknown>): Record<string, unknown> {
  const id = firstString(record, ["id", "name", "model"]) ?? "unknown";
  return compactRecord({
    id,
    name: firstString(record, ["name"]) ?? id,
    url: firstString(record, ["url"]) ?? buildOllamaModelUrl(id).toString(),
    description: firstString(record, ["description"]),
    capabilities: toStringArray(record.capabilities),
    sizes: toStringArray(record.sizes),
    pulls: firstString(record, ["pulls"]),
    downloads: firstString(record, ["downloads", "pulls"]),
    tagCount: firstNumber(record, ["tagCount"]),
    updated: firstString(record, ["updated"]),
    updatedAt: firstString(record, ["updatedAt"]),
    command: `ollama pull ${id}`,
  });
}

export function parseOllamaSearchModels(html: string): Record<string, unknown>[] {
  return matchAllBlocks(html, /<li\b[^>]*x-test-model[^>]*>/giu, "</li>").map(parseOllamaSearchModelBlock).filter(isRecordWithId);
}

export function parseOllamaModelPage(html: string, fallbackId: string, fallbackUrl: string): Record<string, unknown> {
  const id = decodeHtml(firstMatch(html, /<a\b[^>]*x-test-model-name[^>]*>([\s\S]*?)<\/a>/iu) ?? firstMeta(html, "og:title") ?? fallbackId);
  const description = decodeHtml(firstMeta(html, "description") ?? firstMeta(html, "og:description") ?? firstElementText(html, "summary-content"));
  const pulls = decodeHtml(firstMatch(html, /<span\b[^>]*x-test-pull-count[^>]*>([\s\S]*?)<\/span>/iu));
  const updated = decodeHtml(firstMatch(html, /<span\b[^>]*x-test-updated[^>]*>([\s\S]*?)<\/span>/iu));
  const updatedAt = decodeHtml(firstMatch(html, /<span\b[^>]*title="([^"]+)"[^>]*>\s*[\s\S]*?x-test-updated/iu));
  return compactRecord({
    id,
    name: id,
    url: firstMeta(html, "og:url")?.replace(/\/([^/]+)$/u, "/library/$1") ?? fallbackUrl,
    description,
    capabilities: extractMarkedSpanTexts(html, "x-test-capability"),
    sizes: extractMarkedSpanTexts(html, "x-test-size"),
    pulls,
    downloads: pulls,
    updated,
    updatedAt,
  });
}

function parseOllamaSearchModelBlock(block: string): Record<string, unknown> {
  const href = decodeHtml(firstMatch(block, /<a\b[^>]*href="([^"]+)"/iu));
  const id = decodeHtml(firstMatch(block, /<span\b[^>]*x-test-search-response-title[^>]*>([\s\S]*?)<\/span>/iu) ?? firstMatch(block, /title="([^"]+)"/iu));
  const description = decodeHtml(firstMatch(block, /<p\b[^>]*class="[^"]*text-neutral-800[^"]*"[^>]*>([\s\S]*?)<\/p>/iu));
  const pulls = decodeHtml(firstMatch(block, /<span\b[^>]*x-test-pull-count[^>]*>([\s\S]*?)<\/span>/iu));
  const updated = decodeHtml(firstMatch(block, /<span\b[^>]*x-test-updated[^>]*>([\s\S]*?)<\/span>/iu));
  const updatedAt = decodeHtml(firstMatch(block, /<span\b[^>]*title="([^"]+)"[^>]*>\s*[\s\S]*?x-test-updated/iu));
  const tagCountText = decodeHtml(firstMatch(block, /<span\b[^>]*x-test-tag-count[^>]*>([\s\S]*?)<\/span>/iu));
  return compactRecord({
    id,
    name: id,
    url: href ? new URL(href, OLLAMA_ORIGIN).toString() : undefined,
    description,
    capabilities: extractMarkedSpanTexts(block, "x-test-capability"),
    sizes: extractMarkedSpanTexts(block, "x-test-size"),
    pulls,
    downloads: pulls,
    tagCount: parseIntegerText(tagCountText),
    updated,
    updatedAt,
  });
}

function buildSearchMessage(count: number, query: string | undefined): string {
  const suffix = normalizeOptionalText(query) ? ` for "${normalizeOptionalText(query)}"` : "";
  return `Loaded ${count} Ollama model${count === 1 ? "" : "s"}${suffix}.`;
}

function summarizeSearchInput(input: OllamaModelSearchInput): Record<string, unknown> {
  return compactRecord({
    limit: normalizeOllamaLimit(input.limit),
    capability: normalizeOllamaCapability(input.capability),
    sort: input.sort ?? "popular",
  });
}

function hasMoreSearchPages(html: string): boolean {
  return /hx-get="\/search\?page=/iu.test(html);
}

function dedupeById(items: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const result: Record<string, unknown>[] = [];
  for (const item of items) {
    const id = firstString(item, ["id", "name"]);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(item);
  }

  return result;
}

function isRecordWithId(value: Record<string, unknown>): boolean {
  return Boolean(firstString(value, ["id", "name"]));
}

function normalizeOllamaCapability(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  const supported = new Set(["cloud", "embedding", "vision", "tools", "thinking"]);
  if (!supported.has(normalized)) {
    throw new MikaCliError("OLLAMA_OPTION_INVALID", `Expected capability cloud, embedding, vision, tools, or thinking, received "${value}".`);
  }

  return normalized;
}

function matchAllBlocks(html: string, startPattern: RegExp, end: string): string[] {
  const blocks: string[] = [];
  for (const match of html.matchAll(startPattern)) {
    const start = match.index ?? 0;
    const close = html.indexOf(end, start);
    if (close < 0) {
      continue;
    }
    blocks.push(html.slice(start, close + end.length));
  }

  return blocks;
}

function extractMarkedSpanTexts(html: string, marker: string): string[] {
  const pattern = new RegExp(`<span\\b[^>]*${escapeRegExp(marker)}[^>]*>([\\s\\S]*?)<\\/span>`, "giu");
  return Array.from(html.matchAll(pattern))
    .map((match) => decodeHtml(match[1]))
    .filter((value): value is string => Boolean(value));
}

function firstElementText(html: string, id: string): string | undefined {
  return firstMatch(html, new RegExp(`<[^>]+id="${escapeRegExp(id)}"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, "iu"));
}

function firstMeta(html: string, name: string): string | undefined {
  const escaped = escapeRegExp(name);
  return firstMatch(html, new RegExp(`<meta\\b[^>]*(?:name|property)="${escaped}"[^>]*content="([^"]*)"`, "iu"));
}

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1];
}

function parseIntegerText(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value.replace(/,/gu, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function decodeHtml(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const withoutTags = value.replace(/<[^>]*>/gu, " ");
  const decoded = withoutTags
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, "\"")
    .replace(/&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&nbsp;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return decoded.length > 0 ? decoded : undefined;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function readSummaryString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function compactRecord<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (typeof value === "undefined" || value === null) {
        return false;
      }
      if (Array.isArray(value) && value.length === 0) {
        return false;
      }
      return true;
    }),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
