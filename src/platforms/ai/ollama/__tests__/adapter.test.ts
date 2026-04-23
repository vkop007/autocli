import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";
import {
  OllamaCatalogClient,
  buildOllamaModelUrl,
  normalizeOllamaModelId,
  parseOllamaSearchModels,
  summarizeOllamaModel,
} from "../adapter.js";
import { ollamaPlatformDefinition } from "../manifest.js";

const SEARCH_HTML = `
<ul>
  <li x-test-model class="flex">
    <a href="/library/llama3.2" class="group w-full">
      <div title="llama3.2">
        <h2><span x-test-search-response-title>llama3.2</span></h2>
        <p class="max-w-lg break-words text-neutral-800 text-md">Meta&#39;s Llama 3.2 goes small with 1B and 3B models.</p>
      </div>
      <div>
        <span x-test-capability>tools</span>
        <span x-test-size>1b</span>
        <span x-test-size>3b</span>
      </div>
      <p>
        <span><span x-test-pull-count>66.4M</span><span> Pulls</span></span>
        <span><span x-test-tag-count>33</span><span> Tags</span></span>
        <span title="Sep 25, 2024 9:09 PM UTC"><span x-test-updated>1 year ago</span></span>
      </p>
    </a>
  </li>
</ul>
<li hx-get="/search?page=2&q=llama"></li>
`;

const SHOW_HTML = `
<head>
  <meta name="description" content="Meta&#39;s Llama 3.2 goes small with 1B and 3B models."/>
  <meta property="og:title" content="llama3.2" />
  <meta property="og:url" content="https://ollama.com/llama3.2" />
</head>
<a x-test-model-name href="/library/llama3.2">llama3.2</a>
<span x-test-pull-count>66.4M</span>
<span title="Sep 25, 2024 9:09 PM UTC"><span x-test-updated>1 year ago</span></span>
<span x-test-capability>tools</span>
<span x-test-size>1b</span>
<span x-test-size>3b</span>
`;

describe("ollama adapter helpers", () => {
  test("normalizes Ollama model ids and URLs", () => {
    expect(normalizeOllamaModelId(" llama3.2 ")).toBe("llama3.2");
    expect(normalizeOllamaModelId("https://ollama.com/library/llama3.2")).toBe("llama3.2");
    expect(normalizeOllamaModelId("https://ollama.com/owner/model")).toBe("owner/model");
    expect(buildOllamaModelUrl("llama3.2").toString()).toBe("https://ollama.com/library/llama3.2");
    expect(buildOllamaModelUrl("owner/model").toString()).toBe("https://ollama.com/owner/model");
  });

  test("parses Ollama search result cards", () => {
    expect(parseOllamaSearchModels(SEARCH_HTML)).toEqual([
      {
        id: "llama3.2",
        name: "llama3.2",
        url: "https://ollama.com/library/llama3.2",
        description: "Meta's Llama 3.2 goes small with 1B and 3B models.",
        capabilities: ["tools"],
        sizes: ["1b", "3b"],
        pulls: "66.4M",
        downloads: "66.4M",
        tagCount: 33,
        updated: "1 year ago",
        updatedAt: "Sep 25, 2024 9:09 PM UTC",
      },
    ]);
  });

  test("summarizes Ollama models into stable fields", () => {
    expect(
      summarizeOllamaModel({
        id: "llama3.2",
        description: "Small Llama model",
        capabilities: ["tools"],
        sizes: ["1b", "3b"],
        pulls: "66.4M",
        tagCount: 33,
      }),
    ).toEqual({
      id: "llama3.2",
      name: "llama3.2",
      url: "https://ollama.com/library/llama3.2",
      description: "Small Llama model",
      capabilities: ["tools"],
      sizes: ["1b", "3b"],
      pulls: "66.4M",
      downloads: "66.4M",
      tagCount: 33,
      command: "ollama pull llama3.2",
    });
  });

  test("builds search URLs with query, capability, and sort", async () => {
    let capturedUrl = "";
    const client = new OllamaCatalogClient((async (input: string | URL | Request) => {
      capturedUrl = String(input);
      return new Response(SEARCH_HTML, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }) as typeof fetch);

    const results = await client.searchModels({
      query: "llama model",
      limit: 1,
      capability: "tools",
      sort: "newest",
    });

    expect(capturedUrl).toBe("https://ollama.com/search?q=llama+model&c=tools&o=newest");
    expect(results[0]?.id).toBe("llama3.2");
  });

  test("loads model pages by canonical library URL", async () => {
    let capturedUrl = "";
    const client = new OllamaCatalogClient((async (input: string | URL | Request) => {
      capturedUrl = String(input);
      return new Response(SHOW_HTML, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }) as typeof fetch);

    const result = await client.getModel("llama3.2");

    expect(capturedUrl).toBe("https://ollama.com/library/llama3.2");
    expect(result.id).toBe("llama3.2");
    expect(result.description).toBe("Meta's Llama 3.2 goes small with 1B and 3B models.");
    expect(result.sizes).toEqual(["1b", "3b"]);
  });
});

describe("ollama command surface", () => {
  test("exposes ai ollama command groups", () => {
    const command = buildPlatformCommand(ollamaPlatformDefinition);

    expect(command.name()).toBe("ollama");
    expect(command.aliases()).toContain("ol");
    expect(command.commands.map((entry) => entry.name())).toEqual(["models", "capabilities"]);
    expect(command.commands.find((entry) => entry.name() === "models")?.commands.map((entry) => entry.name())).toEqual([
      "search",
      "show",
    ]);
  });

  test("uses category-based examples in the manifest", () => {
    const examples = ollamaPlatformDefinition.examples ?? [];
    expect(examples.every((example) => example.startsWith("mikacli ai ollama"))).toBe(true);
  });
});
