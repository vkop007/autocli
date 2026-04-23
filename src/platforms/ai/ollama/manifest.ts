import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { ollamaAdapter, parseOllamaLimitOption, parseOllamaSortOption } from "./adapter.js";
import { printOllamaResult } from "./output.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  'mikacli ai ollama models search "llama"',
  'mikacli ai ollama models search "embedding" --capability embedding',
  "mikacli ai ollama models show llama3.2",
] as const;

function buildOllamaCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("ollama").description("Search public Ollama model library entries");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  const models = command.command("models").description("Search and inspect Ollama model library entries");
  models
    .command("search")
    .description("Search public Ollama models")
    .argument("[query...]", "Search terms")
    .option("--limit <number>", "Maximum models to return (default: 10, max: 50)", parseOllamaLimitOption)
    .option("--capability <name>", "Filter by capability: cloud, embedding, vision, tools, or thinking")
    .option("--sort <popular|newest>", "Sort order (default: popular)", parseOllamaSortOption, "popular")
    .action(async (query: string[] | undefined, input: Record<string, unknown>, cmd: Command) => {
      await runOllamaAction(cmd, "Searching Ollama models...", "Ollama models loaded.", () =>
        ollamaAdapter.searchModels({
          query: joinQuery(query),
          limit: input.limit as number | undefined,
          capability: input.capability as string | undefined,
          sort: input.sort as "popular" | "newest" | undefined,
        }),
      );
    });

  models
    .command("show")
    .alias("info")
    .description("Load one Ollama model library entry")
    .argument("<model>", "Ollama model name or ollama.com model URL")
    .action(async (model: string, _input: Record<string, unknown>, cmd: Command) => {
      await runOllamaAction(cmd, "Loading Ollama model...", "Ollama model loaded.", () =>
        ollamaAdapter.model({
          model,
        }),
      );
    });

  return command;
}

async function runOllamaAction(
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
    onSuccess: (result) => printOllamaResult(result, ctx.json),
  });
}

function joinQuery(value: string[] | undefined): string | undefined {
  const query = value?.join(" ").trim();
  return query && query.length > 0 ? query : undefined;
}

export const ollamaPlatformDefinition: PlatformDefinition = {
  id: "ollama" as PlatformDefinition["id"],
  category: "ai",
  displayName: "Ollama",
  description: "Search public Ollama model library entries",
  aliases: ["ol"],
  authStrategies: ["none"],
  buildCommand: buildOllamaCommand,
  adapter: ollamaAdapter,
  capabilityMetadata: {
    discovery: "supported",
    mutation: "unsupported",
    browserLogin: "unsupported",
    stability: "partial",
    notes: ["Uses Ollama's public model library and search pages for discovery."],
  },
  examples: EXAMPLES,
};
