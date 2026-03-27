export interface BalancedJsonSegment {
  json: string;
  start: number;
  end: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function collapseWhitespace(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return decodeHtmlEntities(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function toAbsoluteUrl(origin: string, target: string | undefined): string | undefined {
  if (!target) {
    return undefined;
  }

  try {
    return new URL(decodeHtmlEntities(target), origin).toString();
  } catch {
    return undefined;
  }
}

export function parsePriceText(text: string | undefined): {
  value?: number;
  currency?: string;
  text?: string;
} {
  if (!text) {
    return {};
  }

  const cleaned = collapseWhitespace(text);
  if (!cleaned) {
    return {};
  }

  const currency = cleaned.includes("₹") ? "INR" : undefined;
  const numeric = cleaned.replace(/[^0-9.]/g, "");
  const value = numeric ? Number.parseFloat(numeric) : undefined;

  return {
    value: Number.isFinite(value) ? value : undefined,
    currency,
    text: cleaned,
  };
}

export function extractBalancedJsonSegments(input: string, marker: string): BalancedJsonSegment[] {
  const results: BalancedJsonSegment[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    const markerIndex = input.indexOf(marker, cursor);
    if (markerIndex === -1) {
      break;
    }

    const braceIndex = input.indexOf("{", markerIndex + marker.length);
    if (braceIndex === -1) {
      break;
    }

    const segment = extractBalancedObjectAt(input, braceIndex);
    if (!segment) {
      break;
    }

    results.push(segment);
    cursor = segment.end;
  }

  return results;
}

function extractBalancedObjectAt(input: string, start: number): BalancedJsonSegment | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const character = input[index];
    if (!character) {
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          json: input.slice(start, index + 1),
          start,
          end: index + 1,
        };
      }
    }
  }

  return undefined;
}
