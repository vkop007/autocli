import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { huggingFaceAdapter, parseHuggingFaceDirectionOption, parseHuggingFaceLimitOption } from "./adapter.js";
import { printHuggingFaceResult } from "./output.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  'mikacli ai huggingface models search "text embedding" --task sentence-similarity',
  "mikacli ai huggingface models show sentence-transformers/all-MiniLM-L6-v2",
  'mikacli ai huggingface datasets search "finance"',
  'mikacli ai huggingface spaces search "image generation" --sdk gradio',
] as const;

function buildHuggingFaceCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("huggingface").description("Search public Hugging Face models, datasets, and Spaces");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  const models = command.command("models").description("Search and inspect Hugging Face model repositories");
  models
    .command("search")
    .description("Search public Hugging Face models")
    .argument("[query...]", "Search terms")
    .option("--limit <number>", "Maximum models to return (default: 10, max: 50)", parseHuggingFaceLimitOption)
    .option("--author <name>", "Filter to one owner or organization")
    .option("--task <pipeline-tag>", "Filter by pipeline tag, for example text-generation or sentence-similarity")
    .option("--library <name>", "Filter by library, for example transformers, diffusers, or sentence-transformers")
    .option("--inference-provider <id>", "Filter to models served by an inference provider, or all")
    .option("--sort <field>", "Sort field such as downloads, likes, lastModified, or createdAt", "downloads")
    .option("--direction <asc|desc>", "Sort direction (default: desc)", parseHuggingFaceDirectionOption, "desc")
    .action(async (query: string[] | undefined, input: Record<string, unknown>, cmd: Command) => {
      await runHuggingFaceAction(cmd, "Searching Hugging Face models...", "Hugging Face models loaded.", () =>
        huggingFaceAdapter.searchModels({
          query: joinQuery(query),
          limit: input.limit as number | undefined,
          author: input.author as string | undefined,
          task: input.task as string | undefined,
          library: input.library as string | undefined,
          inferenceProvider: input.inferenceProvider as string | undefined,
          sort: input.sort as string | undefined,
          direction: input.direction as "asc" | "desc" | undefined,
        }),
      );
    });

  models
    .command("show")
    .alias("info")
    .description("Load one Hugging Face model repository")
    .argument("<repo>", "Model repo id or huggingface.co model URL")
    .action(async (repo: string, _input: Record<string, unknown>, cmd: Command) => {
      await runHuggingFaceAction(cmd, "Loading Hugging Face model...", "Hugging Face model loaded.", () =>
        huggingFaceAdapter.model({
          repo,
        }),
      );
    });

  const datasets = command.command("datasets").description("Search and inspect Hugging Face dataset repositories");
  datasets
    .command("search")
    .description("Search public Hugging Face datasets")
    .argument("[query...]", "Search terms")
    .option("--limit <number>", "Maximum datasets to return (default: 10, max: 50)", parseHuggingFaceLimitOption)
    .option("--author <name>", "Filter to one owner or organization")
    .option("--sort <field>", "Sort field such as downloads, likes, lastModified, or createdAt", "downloads")
    .option("--direction <asc|desc>", "Sort direction (default: desc)", parseHuggingFaceDirectionOption, "desc")
    .action(async (query: string[] | undefined, input: Record<string, unknown>, cmd: Command) => {
      await runHuggingFaceAction(cmd, "Searching Hugging Face datasets...", "Hugging Face datasets loaded.", () =>
        huggingFaceAdapter.searchDatasets({
          query: joinQuery(query),
          limit: input.limit as number | undefined,
          author: input.author as string | undefined,
          sort: input.sort as string | undefined,
          direction: input.direction as "asc" | "desc" | undefined,
        }),
      );
    });

  datasets
    .command("show")
    .alias("info")
    .description("Load one Hugging Face dataset repository")
    .argument("<repo>", "Dataset repo id or huggingface.co dataset URL")
    .action(async (repo: string, _input: Record<string, unknown>, cmd: Command) => {
      await runHuggingFaceAction(cmd, "Loading Hugging Face dataset...", "Hugging Face dataset loaded.", () =>
        huggingFaceAdapter.dataset({
          repo,
        }),
      );
    });

  const spaces = command.command("spaces").description("Search and inspect Hugging Face Spaces");
  spaces
    .command("search")
    .description("Search public Hugging Face Spaces")
    .argument("[query...]", "Search terms")
    .option("--limit <number>", "Maximum Spaces to return (default: 10, max: 50)", parseHuggingFaceLimitOption)
    .option("--author <name>", "Filter to one owner or organization")
    .option("--sdk <name>", "Filter by Space SDK, for example gradio, streamlit, or docker")
    .option("--sort <field>", "Sort field such as likes, lastModified, or createdAt", "likes")
    .option("--direction <asc|desc>", "Sort direction (default: desc)", parseHuggingFaceDirectionOption, "desc")
    .action(async (query: string[] | undefined, input: Record<string, unknown>, cmd: Command) => {
      await runHuggingFaceAction(cmd, "Searching Hugging Face Spaces...", "Hugging Face Spaces loaded.", () =>
        huggingFaceAdapter.searchSpaces({
          query: joinQuery(query),
          limit: input.limit as number | undefined,
          author: input.author as string | undefined,
          sdk: input.sdk as string | undefined,
          sort: input.sort as string | undefined,
          direction: input.direction as "asc" | "desc" | undefined,
        }),
      );
    });

  spaces
    .command("show")
    .alias("info")
    .description("Load one Hugging Face Space")
    .argument("<repo>", "Space repo id or huggingface.co Space URL")
    .action(async (repo: string, _input: Record<string, unknown>, cmd: Command) => {
      await runHuggingFaceAction(cmd, "Loading Hugging Face Space...", "Hugging Face Space loaded.", () =>
        huggingFaceAdapter.space({
          repo,
        }),
      );
    });

  return command;
}

async function runHuggingFaceAction(
  cmd: Command,
  loadingText: string,
  successMessage: string,
  action: () => Promise<AdapterActionResult>,
): Promise<void> {
  const ctx = resolveCommandContext(cmd);
  const logger = new Logger(ctx);
  const spinner = logger.spinner(loadingText);

  await runCommandAction({
    spinner,
    successMessage,
    action,
    onSuccess: (result) => printHuggingFaceResult(result, ctx.json),
  });
}

function joinQuery(value: string[] | undefined): string | undefined {
  const query = value?.join(" ").trim();
  return query && query.length > 0 ? query : undefined;
}

export const huggingFacePlatformDefinition: PlatformDefinition = {
  id: "huggingface" as PlatformDefinition["id"],
  category: "ai",
  displayName: "Hugging Face",
  description: "Search public Hugging Face models, datasets, and Spaces",
  aliases: ["hf"],
  authStrategies: ["none"],
  buildCommand: buildHuggingFaceCommand,
  adapter: huggingFaceAdapter,
  capabilityMetadata: {
    discovery: "supported",
    mutation: "unsupported",
    browserLogin: "unsupported",
    stability: "stable",
    notes: ["Uses Hugging Face Hub public APIs for model, dataset, and Space discovery."],
  },
  examples: EXAMPLES,
};
