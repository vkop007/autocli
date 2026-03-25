import { describe, expect, it } from "bun:test";

import { extractSearchPageSummary, parseSearchResults } from "../platforms/public/websearch/client.js";
import { absoluteSearchResultUrl, normalizeWebSearchEngine } from "../platforms/public/websearch/helpers.js";

describe("websearch helpers", () => {
  it("normalizes engines and defaults to duckduckgo", () => {
    expect(normalizeWebSearchEngine(undefined)).toBe("duckduckgo");
    expect(normalizeWebSearchEngine("BING")).toBe("bing");
  });

  it("extracts google redirect urls", () => {
    expect(
      absoluteSearchResultUrl(
        "/url?q=https%3A%2F%2Fexample.com%2Farticle&sa=U&ved=2ah",
        "https://www.google.com/search?gbv=1&q=test",
      ),
    ).toBe("https://example.com/article");
  });

  it("extracts duckduckgo redirect urls", () => {
    expect(
      absoluteSearchResultUrl(
        "//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpost&rut=abc",
        "https://html.duckduckgo.com/html/?q=test",
      ),
    ).toBe("https://example.com/post");
  });

  it("extracts bing redirect urls", () => {
    expect(
      absoluteSearchResultUrl(
        "https://www.bing.com/ck/a?!&&u=a1aHR0cHM6Ly9leGFtcGxlLmNvbS9iaW5nLXBvc3Q",
        "https://www.bing.com/search?q=test",
      ),
    ).toBe("https://example.com/bing-post");
  });

  it("parses duckduckgo style html", () => {
    const html = `
      <div class="result">
        <a class="result__a" href="https://example.com/post">Example Result</a>
        <div class="result__snippet">Useful result summary</div>
      </div>
    `;

    const results = parseSearchResults("duckduckgo", html, "https://html.duckduckgo.com/html/?q=test", 5);
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Example Result");
    expect(results[0]?.url).toBe("https://example.com/post");
    expect(results[0]?.snippet).toBe("Useful result summary");
  });

  it("falls back to generic anchor parsing", () => {
    const html = `<a href="https://example.org/docs">Example Docs</a>`;
    const results = parseSearchResults("bing", html, "https://www.bing.com/search?q=test", 5);
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe("https://example.org/docs");
  });

  it("parses bing result snippets from b_caption blocks", () => {
    const html = `
      <li class="b_algo">
        <div class="b_tpcn"></div>
        <h2><a href="https://www.bing.com/ck/a?!&&u=a1aHR0cHM6Ly9leGFtcGxlLmNvbS9iaW5nLWRvYw">Bing Result</a></h2>
        <div class="b_caption"><p>This is the Bing snippet for the result.</p></div>
      </li>
    `;

    const results = parseSearchResults("bing", html, "https://www.bing.com/search?q=test", 5);
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe("https://example.com/bing-doc");
    expect(results[0]?.snippet).toBe("This is the Bing snippet for the result.");
  });

  it("returns no results for blocked google fallback pages", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="yvlrue">If you're having trouble accessing Google Search, please <a href="/search?q=test">click here</a>.</div>
        </body>
      </html>
    `;

    const results = parseSearchResults("google", html, "https://www.google.com/search?gbv=1&q=test", 5);
    expect(results).toHaveLength(0);
  });

  it("extracts a summary from meta description first", () => {
    const html = `
      <html>
        <head>
          <meta name="description" content="Bun provides native cookie APIs for parsing, generating, and managing cookies in HTTP requests and responses.">
        </head>
        <body>
          <p>Ignored paragraph because meta description should win.</p>
        </body>
      </html>
    `;

    expect(extractSearchPageSummary(html)).toContain("Bun provides native cookie APIs");
  });

  it("falls back to paragraph content for summaries", () => {
    const html = `
      <html>
        <body>
          <p>Short intro.</p>
          <p>Bun implements the WHATWG fetch standard and adds server-focused extensions, including optimized request handling, headers, and cookie helpers for runtime use.</p>
          <p>It is generally recommended over lower-level alternatives for typical HTTP client work.</p>
        </body>
      </html>
    `;

    const summary = extractSearchPageSummary(html);
    expect(summary).toContain("Bun implements the WHATWG fetch standard");
  });
});
