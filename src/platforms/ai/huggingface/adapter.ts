import { MikaCliError } from "../../../errors.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

const HUGGING_FACE_ORIGIN = "https://huggingface.co";
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;

type FetchLike = typeof fetch;
type ResourceKind = "model" | "dataset" | "space";
type SearchDirection = "asc" | "desc";

export type HuggingFaceSearchInput = {
  query?: string;
  limit?: number;
  author?: string;
  sort?: string;
  direction?: SearchDirection;
};

export type HuggingFaceModelSearchInput = HuggingFaceSearchInput & {
  task?: string;
  library?: string;
  inferenceProvider?: string;
};

export type HuggingFaceSpaceSearchInput = HuggingFaceSearchInput & {
  sdk?: string;
};

export class HuggingFaceApiClient {
  constructor(private readonly fetchFn: FetchLike = fetch) {}

  async listModels(input: HuggingFaceModelSearchInput): Promise<Record<string, unknown>[]> {
    const url = this.buildListUrl("/api/models", {
      search: input.query,
      limit: normalizeHuggingFaceLimit(input.limit),
      author: input.author,
      sort: input.sort,
      direction: toHubDirection(input.direction),
      pipeline_tag: input.task,
      library: input.library,
      inference_provider: input.inferenceProvider,
    });
    return this.requestRecordArray(url, "HUGGINGFACE_MODELS_INVALID", "Hugging Face returned an invalid models response.");
  }

  async getModel(repoId: string): Promise<Record<string, unknown>> {
    const url = new URL(`/api/models/${encodeRepoId(repoId)}`, HUGGING_FACE_ORIGIN);
    return this.requestRecord(url, "HUGGINGFACE_MODEL_INVALID", "Hugging Face returned an invalid model response.");
  }

  async listDatasets(input: HuggingFaceSearchInput): Promise<Record<string, unknown>[]> {
    const url = this.buildListUrl("/api/datasets", {
      search: input.query,
      limit: normalizeHuggingFaceLimit(input.limit),
      author: input.author,
      sort: input.sort,
      direction: toHubDirection(input.direction),
    });
    return this.requestRecordArray(url, "HUGGINGFACE_DATASETS_INVALID", "Hugging Face returned an invalid datasets response.");
  }

  async getDataset(repoId: string): Promise<Record<string, unknown>> {
    const url = new URL(`/api/datasets/${encodeRepoId(repoId)}`, HUGGING_FACE_ORIGIN);
    return this.requestRecord(url, "HUGGINGFACE_DATASET_INVALID", "Hugging Face returned an invalid dataset response.");
  }

  async listSpaces(input: HuggingFaceSpaceSearchInput): Promise<Record<string, unknown>[]> {
    const url = this.buildListUrl("/api/spaces", {
      search: input.query,
      limit: normalizeHuggingFaceLimit(input.limit),
      author: input.author,
      sort: input.sort,
      direction: toHubDirection(input.direction),
      sdk: input.sdk,
    });
    return this.requestRecordArray(url, "HUGGINGFACE_SPACES_INVALID", "Hugging Face returned an invalid Spaces response.");
  }

  async getSpace(repoId: string): Promise<Record<string, unknown>> {
    const url = new URL(`/api/spaces/${encodeRepoId(repoId)}`, HUGGING_FACE_ORIGIN);
    return this.requestRecord(url, "HUGGINGFACE_SPACE_INVALID", "Hugging Face returned an invalid Space response.");
  }

  private buildListUrl(path: string, params: Record<string, string | number | undefined>): URL {
    const url = new URL(path, HUGGING_FACE_ORIGIN);
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "undefined" || String(value).trim().length === 0) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    return url;
  }

  private async requestRecordArray(url: URL, code: string, message: string): Promise<Record<string, unknown>[]> {
    const json = await this.requestJson(url);
    if (!Array.isArray(json)) {
      throw new MikaCliError(code, message, {
        details: {
          url: url.toString(),
        },
      });
    }

    return json.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  }

  private async requestRecord(url: URL, code: string, message: string): Promise<Record<string, unknown>> {
    const json = await this.requestJson(url);
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new MikaCliError(code, message, {
        details: {
          url: url.toString(),
        },
      });
    }

    return json as Record<string, unknown>;
  }

  private async requestJson(url: URL): Promise<unknown> {
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": "mikacli-huggingface",
    };

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers,
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      throw new MikaCliError("HUGGINGFACE_REQUEST_FAILED", "Failed to reach Hugging Face.", {
        details: {
          url: url.toString(),
        },
        cause: error,
      });
    }

    const text = await response.text();
    const body = parseJsonText(text);
    if (!response.ok) {
      throw new MikaCliError(
        "HUGGINGFACE_REQUEST_FAILED",
        extractHuggingFaceErrorMessage(body) ?? `Hugging Face request failed with ${response.status} ${response.statusText}.`,
        {
          details: {
            status: response.status,
            url: url.toString(),
            response: body,
          },
        },
      );
    }

    return body;
  }
}

export class HuggingFaceAdapter {
  readonly platform = "huggingface" as Platform;
  readonly displayName = "Hugging Face";

  constructor(private readonly client = new HuggingFaceApiClient()) {}

  async searchModels(input: HuggingFaceModelSearchInput): Promise<AdapterActionResult> {
    const models = await this.client.listModels(input);
    const items = models.map((entry) => summarizeHuggingFaceModel(entry));
    return this.buildResult({
      account: "public",
      action: "models-search",
      message: buildSearchMessage("model", items.length, input.query),
      data: {
        query: normalizeOptionalText(input.query) ?? null,
        models: items,
        search: summarizeSearchInput(input),
      },
    });
  }

  async model(input: { repo: string }): Promise<AdapterActionResult> {
    const repo = normalizeRepoId(input.repo);
    const model = await this.client.getModel(repo);
    const summary = summarizeHuggingFaceModel(model);
    const id = readSummaryString(summary, "id") ?? repo;
    const url = readSummaryString(summary, "url");
    return this.buildResult({
      account: "public",
      action: "model",
      message: `Loaded Hugging Face model ${id}.`,
      id,
      url,
      data: {
        model: summary,
        files: summarizeRepoFiles(model.siblings),
      },
    });
  }

  async searchDatasets(input: HuggingFaceSearchInput): Promise<AdapterActionResult> {
    const datasets = await this.client.listDatasets(input);
    const items = datasets.map((entry) => summarizeHuggingFaceDataset(entry));
    return this.buildResult({
      account: "public",
      action: "datasets-search",
      message: buildSearchMessage("dataset", items.length, input.query),
      data: {
        query: normalizeOptionalText(input.query) ?? null,
        datasets: items,
        search: summarizeSearchInput(input),
      },
    });
  }

  async dataset(input: { repo: string }): Promise<AdapterActionResult> {
    const repo = normalizeRepoId(input.repo);
    const dataset = await this.client.getDataset(repo);
    const summary = summarizeHuggingFaceDataset(dataset);
    const id = readSummaryString(summary, "id") ?? repo;
    const url = readSummaryString(summary, "url");
    return this.buildResult({
      account: "public",
      action: "dataset",
      message: `Loaded Hugging Face dataset ${id}.`,
      id,
      url,
      data: {
        dataset: summary,
        files: summarizeRepoFiles(dataset.siblings),
      },
    });
  }

  async searchSpaces(input: HuggingFaceSpaceSearchInput): Promise<AdapterActionResult> {
    const spaces = await this.client.listSpaces(input);
    const items = spaces.map((entry) => summarizeHuggingFaceSpace(entry));
    return this.buildResult({
      account: "public",
      action: "spaces-search",
      message: buildSearchMessage("Space", items.length, input.query),
      data: {
        query: normalizeOptionalText(input.query) ?? null,
        spaces: items,
        search: summarizeSearchInput(input),
      },
    });
  }

  async space(input: { repo: string }): Promise<AdapterActionResult> {
    const repo = normalizeRepoId(input.repo);
    const space = await this.client.getSpace(repo);
    const summary = summarizeHuggingFaceSpace(space);
    const id = readSummaryString(summary, "id") ?? repo;
    const url = readSummaryString(summary, "url");
    return this.buildResult({
      account: "public",
      action: "space",
      message: `Loaded Hugging Face Space ${id}.`,
      id,
      url,
      data: {
        space: summary,
      },
    });
  }

  private buildResult(input: {
    account: string;
    action: string;
    message: string;
    id?: string;
    url?: string;
    data?: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: input.account,
      action: input.action,
      message: input.message,
      id: input.id,
      url: input.url,
      data: input.data,
    };
  }
}

export const huggingFaceAdapter = new HuggingFaceAdapter();

export function normalizeHuggingFaceLimit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SEARCH_LIMIT;
  }

  return Math.max(1, Math.min(MAX_SEARCH_LIMIT, Math.trunc(value)));
}

export function parseHuggingFaceLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new MikaCliError("HUGGINGFACE_OPTION_INVALID", `Expected a positive integer limit, received "${value}".`);
  }

  return normalizeHuggingFaceLimit(parsed);
}

export function parseHuggingFaceDirectionOption(value: string): SearchDirection {
  const normalized = value.trim().toLowerCase();
  if (normalized === "desc" || normalized === "-1") {
    return "desc";
  }
  if (normalized === "asc" || normalized === "1") {
    return "asc";
  }

  throw new MikaCliError("HUGGINGFACE_OPTION_INVALID", `Expected direction asc or desc, received "${value}".`);
}

export function summarizeHuggingFaceModel(record: Record<string, unknown>): Record<string, unknown> {
  const id = readRepoId(record);
  const tags = toStringArray(record.tags);
  const cardData = toRecord(record.cardData);
  const inferenceProviders = toInferenceProviders(record.inferenceProviderMapping);
  return compactRecord({
    id,
    type: "model",
    author: firstString(record, ["author"]) ?? parseAuthor(id),
    url: buildResourceUrl("model", id),
    task: firstString(record, ["pipeline_tag", "pipelineTag"]) ?? inferTagValue(tags, "pipeline_tag"),
    library: firstString(record, ["library_name", "libraryName"]) ?? inferTagValue(tags, "library"),
    downloads: firstNumber(record, ["downloads"]),
    likes: firstNumber(record, ["likes"]),
    gated: firstString(record, ["gated"]) ?? (typeof record.gated === "boolean" ? record.gated : undefined),
    private: typeof record.private === "boolean" ? record.private : undefined,
    inference: firstString(record, ["inference"]),
    inferenceProviders: inferenceProviders.length > 0 ? inferenceProviders : undefined,
    license: firstString(cardData ?? {}, ["license"]) ?? inferLicense(tags),
    lastModified: firstString(record, ["lastModified", "last_modified"]),
    createdAt: firstString(record, ["createdAt", "created_at"]),
    tags: tags.slice(0, 20),
  });
}

export function summarizeHuggingFaceDataset(record: Record<string, unknown>): Record<string, unknown> {
  const id = readRepoId(record);
  const tags = toStringArray(record.tags);
  const cardData = toRecord(record.cardData);
  return compactRecord({
    id,
    type: "dataset",
    author: firstString(record, ["author"]) ?? parseAuthor(id),
    url: buildResourceUrl("dataset", id),
    downloads: firstNumber(record, ["downloads"]),
    likes: firstNumber(record, ["likes"]),
    gated: firstString(record, ["gated"]) ?? (typeof record.gated === "boolean" ? record.gated : undefined),
    private: typeof record.private === "boolean" ? record.private : undefined,
    license: firstString(cardData ?? {}, ["license"]) ?? inferLicense(tags),
    lastModified: firstString(record, ["lastModified", "last_modified"]),
    createdAt: firstString(record, ["createdAt", "created_at"]),
    tags: tags.slice(0, 20),
  });
}

export function summarizeHuggingFaceSpace(record: Record<string, unknown>): Record<string, unknown> {
  const id = readRepoId(record);
  const tags = toStringArray(record.tags);
  const runtime = toRecord(record.runtime);
  return compactRecord({
    id,
    type: "space",
    author: firstString(record, ["author"]) ?? parseAuthor(id),
    url: buildResourceUrl("space", id),
    sdk: firstString(record, ["sdk"]),
    likes: firstNumber(record, ["likes"]),
    private: typeof record.private === "boolean" ? record.private : undefined,
    stage: firstString(runtime ?? {}, ["stage"]),
    hardware: firstString(runtime ?? {}, ["hardware"]),
    lastModified: firstString(record, ["lastModified", "last_modified"]),
    createdAt: firstString(record, ["createdAt", "created_at"]),
    tags: tags.slice(0, 20),
  });
}

export function encodeRepoId(repoId: string): string {
  return normalizeRepoId(repoId).split("/").map(encodeURIComponent).join("/");
}

export function normalizeRepoId(value: string): string {
  const normalized = value.trim().replace(/^https:\/\/huggingface\.co\//u, "").replace(/^\/+/u, "").replace(/\/+$/u, "");
  if (!normalized) {
    throw new MikaCliError("HUGGINGFACE_REPO_REQUIRED", "Provide a Hugging Face repo id.");
  }

  if (normalized.startsWith("datasets/")) {
    return normalized.slice("datasets/".length);
  }

  if (normalized.startsWith("spaces/")) {
    return normalized.slice("spaces/".length);
  }

  return normalized;
}

function buildSearchMessage(kind: string, count: number, query: string | undefined): string {
  const plural = kind === "Space" ? `Space${count === 1 ? "" : "s"}` : `${kind}${count === 1 ? "" : "s"}`;
  const suffix = normalizeOptionalText(query) ? ` for "${normalizeOptionalText(query)}"` : "";
  return `Loaded ${count} Hugging Face ${plural}${suffix}.`;
}

function summarizeSearchInput(input: HuggingFaceModelSearchInput | HuggingFaceSpaceSearchInput): Record<string, unknown> {
  return compactRecord({
    limit: normalizeHuggingFaceLimit(input.limit),
    author: normalizeOptionalText(input.author),
    sort: normalizeOptionalText(input.sort),
    direction: input.direction ?? "desc",
    task: "task" in input ? normalizeOptionalText(input.task) : undefined,
    library: "library" in input ? normalizeOptionalText(input.library) : undefined,
    inferenceProvider: "inferenceProvider" in input ? normalizeOptionalText(input.inferenceProvider) : undefined,
    sdk: "sdk" in input ? normalizeOptionalText(input.sdk) : undefined,
  });
}

function summarizeRepoFiles(value: unknown): Record<string, unknown>[] {
  return toRecordArray(value).map((entry) =>
    compactRecord({
      path: firstString(entry, ["rfilename", "path", "name"]),
      size: firstNumber(entry, ["size"]),
      blobId: firstString(entry, ["blobId", "oid"]),
      lfs: toRecord(entry.lfs),
    }),
  );
}

function buildResourceUrl(kind: ResourceKind, id: string): string {
  if (kind === "dataset") {
    return `${HUGGING_FACE_ORIGIN}/datasets/${id}`;
  }
  if (kind === "space") {
    return `${HUGGING_FACE_ORIGIN}/spaces/${id}`;
  }
  return `${HUGGING_FACE_ORIGIN}/${id}`;
}

function readRepoId(record: Record<string, unknown>): string {
  return firstString(record, ["id", "modelId", "datasetId", "spaceId", "name"]) ?? "unknown";
}

function readSummaryString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseAuthor(id: string): string | undefined {
  const [author] = id.split("/");
  return author && author !== id ? author : undefined;
}

function inferTagValue(tags: readonly string[], prefix: string): string | undefined {
  const normalizedPrefix = `${prefix}:`;
  const match = tags.find((tag) => tag.startsWith(normalizedPrefix));
  return match?.slice(normalizedPrefix.length);
}

function inferLicense(tags: readonly string[]): string | undefined {
  return inferTagValue(tags, "license");
}

function toInferenceProviders(value: unknown): Array<Record<string, unknown>> {
  const mapping = toRecord(value);
  if (!mapping) {
    return [];
  }

  return Object.entries(mapping).map(([provider, entry]) => {
    const record = toRecord(entry) ?? {};
    return compactRecord({
      provider,
      status: firstString(record, ["status"]),
      providerId: firstString(record, ["providerId", "provider_id"]),
      task: firstString(record, ["task"]),
    });
  });
}

function toHubDirection(value: SearchDirection | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value === "asc" ? "1" : "-1";
}

function extractHuggingFaceErrorMessage(body: unknown): string | undefined {
  const record = toRecord(body);
  if (!record) {
    return undefined;
  }

  const error = record.error;
  if (Array.isArray(error)) {
    const messages = error.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
    return messages.length > 0 ? messages.join("; ") : undefined;
  }

  return firstString(record, ["error", "message"]);
}

function parseJsonText(value: string): unknown {
  if (!value.trim()) {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch {
    return {
      text: value,
    };
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
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

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
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
