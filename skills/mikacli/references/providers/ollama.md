# Ollama

Generated from the real MikaCLI provider definition and command tree.

- Provider: `ollama`
- Category: `ai`
- Command prefix: `mikacli ai ollama`
- Aliases: `ol`
- Auth: `none`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public Ollama model library entries

## Notes

- Uses Ollama's public model library and search pages for discovery.

## Fast Start

- `mikacli ai ollama models search "llama"`
- `mikacli ai ollama models search "embedding" --capability embedding`
- `mikacli ai ollama models show llama3.2`
- `mikacli ai ollama capabilities --json`

## Default Command

Usage:
```bash
mikacli ai ollama [command]
```

No root-only options.


## Commands

### `models`

Usage:
```bash
mikacli ai ollama models [options] [command]
```

Search and inspect Ollama model library entries

No command-specific options.

#### `search`

Usage:
```bash
mikacli ai ollama models search [options] [query...]
```

Search public Ollama models

Options:

- `--limit <number>`: Maximum models to return (default: 10, max: 50)
- `--capability <name>`: Filter by capability: cloud, embedding, vision, tools, or thinking
- `--sort <popular|newest>`: Sort order (default: popular)

#### `show`

Usage:
```bash
mikacli ai ollama models show [options] <model>
```

Aliases: `info`

Load one Ollama model library entry

No command-specific options.


### `capabilities`

Usage:
```bash
mikacli ai ollama capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
