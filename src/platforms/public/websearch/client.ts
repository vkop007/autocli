import {
  absoluteSearchResultUrl,
  dedupeWebSearchResults,
  getWebSearchEngineInfo,
  isUsefulSearchResult,
  stripHtml,
  type WebSearchEngine,
  type WebSearchResult,
} from "./helpers.js";
import { AutoCliError } from "../../../errors.js";

export class WebSearchClient {
  async search(input: {
    engine: WebSearchEngine;
    query: string;
    limit: number;
    summary?: boolean;
    summaryLimit?: number;
  }): Promise<{ engine: WebSearchEngine; query: string; searchUrl: string; results: WebSearchResult[] }> {
    const engineInfo = getWebSearchEngineInfo(input.engine);
    const searchUrl = engineInfo.searchUrl(input.query);
    const response = await fetch(searchUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; AutoCLI/1.0; +https://github.com/)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`${engineInfo.label} search returned ${response.status} ${response.statusText}.`);
    }

    const html = await response.text();
    if (isBlockedSearchResponse(input.engine, html)) {
      throw new AutoCliError(
        "WEBSEARCH_ENGINE_BLOCKED",
        `${engineInfo.label} returned an anti-bot or JavaScript fallback page instead of real search results.`,
        {
          details: {
            engine: input.engine,
            searchUrl,
          },
        },
      );
    }

    const results = parseSearchResults(input.engine, html, searchUrl, input.limit);
    const enrichedResults = input.summary ? await this.attachSummaries(results, input.summaryLimit ?? 3) : results;
    return {
      engine: input.engine,
      query: input.query,
      searchUrl,
      results: enrichedResults,
    };
  }

  private async attachSummaries(results: WebSearchResult[], summaryLimit: number): Promise<WebSearchResult[]> {
    const limit = clamp(summaryLimit, 1, 10);
    let remaining = limit;

    return Promise.all(
      results.map(async (result) => {
        if (remaining <= 0) {
          return result;
        }

        remaining -= 1;
        const fetchedSummary = await this.fetchPageSummary(result.url);
        return fetchedSummary ? { ...result, fetchedSummary } : result;
      }),
    );
  }

  private async fetchPageSummary(url: string): Promise<string | undefined> {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; AutoCLI/1.0; +https://github.com/)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
          "accept-language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        return undefined;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (contentType.includes("application/pdf") || contentType.includes("image/")) {
        return undefined;
      }

      const body = await response.text();
      return extractSearchPageSummary(body);
    } catch {
      return undefined;
    }
  }
}

export function parseSearchResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (isBlockedSearchResponse(engine, html)) {
    return [];
  }

  const parsers = [parseDuckDuckGoResults, parseBingResults, parseBraveResults, parseGoogleResults, parseGenericAnchorResults];

  for (const parser of parsers) {
    const parsed = parser(engine, html, pageUrl, limit);
    if (parsed.length > 0) {
      return dedupeWebSearchResults(parsed, limit);
    }
  }

  return [];
}

function isBlockedSearchResponse(engine: WebSearchEngine, html: string): boolean {
  const normalized = html.toLowerCase();

  if (engine === "google") {
    return (
      normalized.includes("if you're having trouble accessing google search") ||
      normalized.includes("/httpservice/retry/enablejs") ||
      normalized.includes("id=\"yvlrue\"")
    );
  }

  return false;
}

export function extractSearchPageSummary(html: string): string | undefined {
  const metaDescription = extractMetaDescription(html);
  if (metaDescription) {
    return truncateSummary(metaDescription);
  }

  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1] ?? ""))
    .filter((entry) => isUsefulSummaryText(entry));

  if (paragraphs.length > 0) {
    return truncateSummary(joinSummaryParts(paragraphs, 2));
  }

  const articleLikeBlocks = [...html.matchAll(/<(article|main|section)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => stripHtml(match[2] ?? ""))
    .filter((entry) => isUsefulSummaryText(entry));

  if (articleLikeBlocks.length > 0) {
    return truncateSummary(articleLikeBlocks[0] ?? "");
  }

  const plainText = stripHtml(html);
  if (isUsefulSummaryText(plainText)) {
    return truncateSummary(plainText);
  }

  return undefined;
}

function extractMetaDescription(html: string): string | undefined {
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  for (const tag of metaTags) {
    const normalized = tag.toLowerCase();
    if (
      normalized.includes('name="description"') ||
      normalized.includes("name='description'") ||
      normalized.includes('property="og:description"') ||
      normalized.includes("property='og:description'") ||
      normalized.includes('name="twitter:description"') ||
      normalized.includes("name='twitter:description'")
    ) {
      const content =
        tag.match(/\bcontent="([^"]*)"/i)?.[1] ??
        tag.match(/\bcontent='([^']*)'/i)?.[1];
      const value = stripHtml(content ?? "");
      if (isUsefulSummaryText(value)) {
        return value;
      }
    }
  }
  return undefined;
}

function joinSummaryParts(parts: string[], maxParts: number): string {
  return parts
    .slice(0, maxParts)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function isUsefulSummaryText(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 60) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  if (
    lowered.includes("skip to main content") ||
    lowered.includes("cookie settings") ||
    lowered.includes("open menu") ||
    lowered.startsWith("enable javascript") ||
    lowered.includes("cookie preferences") ||
    lowered.includes("accept cookies") ||
    lowered.includes("sign in") ||
    lowered.includes("subscribe now")
  ) {
    return false;
  }

  return true;
}

function truncateSummary(value: string, maxLength = 320): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const shortened = normalized.slice(0, maxLength);
  const lastBoundary = Math.max(shortened.lastIndexOf(". "), shortened.lastIndexOf(" "), shortened.lastIndexOf(", "));
  const trimmed = lastBoundary > 120 ? shortened.slice(0, lastBoundary) : shortened;
  return `${trimmed.trim()}...`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseDuckDuckGoResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (engine !== "duckduckgo") {
    return [];
  }

  const results: WebSearchResult[] = [];
  const blockRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,1000}?(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi;
  for (const match of html.matchAll(blockRegex)) {
    const url = absoluteSearchResultUrl(match[1] ?? "", pageUrl);
    const title = stripHtml(match[2] ?? "");
    const snippet = stripHtml(match[3] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl)) {
      continue;
    }
    results.push({ engine, title, url, snippet });
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

function parseBingResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (engine !== "bing") {
    return [];
  }

  const results: WebSearchResult[] = [];
  const blockRegex = /<li[^>]+class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const blockMatch of html.matchAll(blockRegex)) {
    const block = blockMatch[1] ?? "";
    const headingMatch = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
    if (!headingMatch) {
      continue;
    }

    const url = absoluteSearchResultUrl(headingMatch[1] ?? "", pageUrl);
    const title = stripHtml(headingMatch[2] ?? "");
    const snippet =
      stripHtml(block.match(/<div[^>]+class="[^"]*\bb_caption\b[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "") ||
      stripHtml(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl)) {
      continue;
    }
    results.push({ engine, title, url, snippet });
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

function parseBraveResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (engine !== "brave") {
    return [];
  }

  const results: WebSearchResult[] = [];
  const blockRegex = /<a[^>]+href="([^"]+)"[^>]*data-type="web"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,1200}?(?:<div[^>]+class="[^"]*(?:snippet|description)[^"]*"[^>]*>([\s\S]*?)<\/div>)?/gi;
  for (const match of html.matchAll(blockRegex)) {
    const url = absoluteSearchResultUrl(match[1] ?? "", pageUrl);
    const title = stripHtml(match[2] ?? "");
    const snippet = stripHtml(match[3] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl)) {
      continue;
    }
    results.push({ engine, title, url, snippet });
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

function parseGoogleResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  if (engine !== "google") {
    return [];
  }

  const results: WebSearchResult[] = [];
  const blockRegex = /<a[^>]+href="([^"]*\/url\?[^"]+|https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,800}?(?:<div[^>]*>([\s\S]*?)<\/div>)?/gi;
  for (const match of html.matchAll(blockRegex)) {
    const url = absoluteSearchResultUrl(match[1] ?? "", pageUrl);
    const title = stripHtml(match[2] ?? "");
    const snippet = stripHtml(match[3] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl) || title.length < 3) {
      continue;
    }
    results.push({ engine, title, url, snippet });
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

function parseGenericAnchorResults(engine: WebSearchEngine, html: string, pageUrl: string, limit: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const anchorRegex = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const url = absoluteSearchResultUrl(match[1] ?? "", pageUrl);
    const title = stripHtml(match[2] ?? "");
    if (!url || !isUsefulSearchResult(url, title, pageUrl) || title.length < 3) {
      continue;
    }

    results.push({
      engine,
      title,
      url,
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}
