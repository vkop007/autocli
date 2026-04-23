import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";
import { HuggingFaceApiClient, encodeRepoId, normalizeRepoId, summarizeHuggingFaceModel } from "../adapter.js";
import { huggingFacePlatformDefinition } from "../manifest.js";

describe("huggingface adapter helpers", () => {
  test("normalizes Hugging Face repo ids and URLs", () => {
    expect(normalizeRepoId(" sentence-transformers/all-MiniLM-L6-v2 ")).toBe("sentence-transformers/all-MiniLM-L6-v2");
    expect(normalizeRepoId("https://huggingface.co/datasets/openai/gsm8k")).toBe("openai/gsm8k");
    expect(normalizeRepoId("https://huggingface.co/spaces/gradio/hello_world")).toBe("gradio/hello_world");
    expect(encodeRepoId("owner/model name")).toBe("owner/model%20name");
  });

  test("summarizes model records into stable fields", () => {
    expect(
      summarizeHuggingFaceModel({
        id: "sentence-transformers/all-MiniLM-L6-v2",
        pipeline_tag: "sentence-similarity",
        library_name: "sentence-transformers",
        downloads: 123,
        likes: 45,
        tags: ["license:apache-2.0", "region:us"],
      }),
    ).toEqual({
      id: "sentence-transformers/all-MiniLM-L6-v2",
      type: "model",
      author: "sentence-transformers",
      url: "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2",
      task: "sentence-similarity",
      library: "sentence-transformers",
      downloads: 123,
      likes: 45,
      license: "apache-2.0",
      tags: ["license:apache-2.0", "region:us"],
    });
  });

  test("builds model search URLs with filters", async () => {
    let capturedUrl = "";
    let capturedHeaders: Headers | undefined;
    const client = new HuggingFaceApiClient((async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify([{ id: "Qwen/Qwen2.5-7B-Instruct" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch);

    const results = await client.listModels({
      query: "qwen instruct",
      limit: 5,
      task: "text-generation",
      library: "transformers",
      inferenceProvider: "all",
      sort: "downloads",
      direction: "desc",
    });

    expect(capturedUrl).toBe("https://huggingface.co/api/models?search=qwen+instruct&limit=5&sort=downloads&direction=-1&pipeline_tag=text-generation&library=transformers&inference_provider=all");
    expect(capturedHeaders?.get("authorization")).toBeNull();
    expect(results).toEqual([{ id: "Qwen/Qwen2.5-7B-Instruct" }]);
  });
});

describe("huggingface command surface", () => {
  test("exposes ai huggingface command groups", () => {
    const command = buildPlatformCommand(huggingFacePlatformDefinition);

    expect(command.name()).toBe("huggingface");
    expect(command.aliases()).toContain("hf");
    expect(command.commands.map((entry) => entry.name())).toEqual(["models", "datasets", "spaces", "capabilities"]);
  });

  test("uses category-based examples in the manifest", () => {
    const examples = huggingFacePlatformDefinition.examples ?? [];
    expect(examples.every((example) => example.startsWith("mikacli ai huggingface"))).toBe(true);
  });
});
