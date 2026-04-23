# Hugging Face

Generated from the real MikaCLI provider definition and command tree.

- Provider: `huggingface`
- Category: `ai`
- Command prefix: `mikacli ai huggingface`
- Aliases: `hf`
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public Hugging Face models, datasets, and Spaces

## Notes

- Uses Hugging Face Hub public APIs for model, dataset, and Space discovery.

## Fast Start

- `mikacli ai huggingface models search "text embedding" --task sentence-similarity`
- `mikacli ai huggingface models show sentence-transformers/all-MiniLM-L6-v2`
- `mikacli ai huggingface datasets search "finance"`
- `mikacli ai huggingface capabilities --json`

## Default Command

Usage:
```bash
mikacli ai huggingface [command]
```

No root-only options.


## Commands

### `models`

Usage:
```bash
mikacli ai huggingface models [options] [command]
```

Search and inspect Hugging Face model repositories

No command-specific options.

#### `search`

Usage:
```bash
mikacli ai huggingface models search [options] [query...]
```

Search public Hugging Face models

Options:

- `--limit <number>`: Maximum models to return (default: 10, max: 50)
- `--author <name>`: Filter to one owner or organization
- `--task <pipeline-tag>`: Filter by pipeline tag, for example text-generation or sentence-similarity
- `--library <name>`: Filter by library, for example transformers, diffusers, or sentence-transformers
- `--inference-provider <id>`: Filter to models served by an inference provider, or all
- `--sort <field>`: Sort field such as downloads, likes, lastModified, or createdAt
- `--direction <asc|desc>`: Sort direction (default: desc)

#### `show`

Usage:
```bash
mikacli ai huggingface models show [options] <repo>
```

Aliases: `info`

Load one Hugging Face model repository

No command-specific options.


### `datasets`

Usage:
```bash
mikacli ai huggingface datasets [options] [command]
```

Search and inspect Hugging Face dataset repositories

No command-specific options.

#### `search`

Usage:
```bash
mikacli ai huggingface datasets search [options] [query...]
```

Search public Hugging Face datasets

Options:

- `--limit <number>`: Maximum datasets to return (default: 10, max: 50)
- `--author <name>`: Filter to one owner or organization
- `--sort <field>`: Sort field such as downloads, likes, lastModified, or createdAt
- `--direction <asc|desc>`: Sort direction (default: desc)

#### `show`

Usage:
```bash
mikacli ai huggingface datasets show [options] <repo>
```

Aliases: `info`

Load one Hugging Face dataset repository

No command-specific options.


### `spaces`

Usage:
```bash
mikacli ai huggingface spaces [options] [command]
```

Search and inspect Hugging Face Spaces

No command-specific options.

#### `search`

Usage:
```bash
mikacli ai huggingface spaces search [options] [query...]
```

Search public Hugging Face Spaces

Options:

- `--limit <number>`: Maximum Spaces to return (default: 10, max: 50)
- `--author <name>`: Filter to one owner or organization
- `--sdk <name>`: Filter by Space SDK, for example gradio, streamlit, or docker
- `--sort <field>`: Sort field such as likes, lastModified, or createdAt
- `--direction <asc|desc>`: Sort direction (default: desc)

#### `show`

Usage:
```bash
mikacli ai huggingface spaces show [options] <repo>
```

Aliases: `info`

Load one Hugging Face Space

No command-specific options.


### `capabilities`

Usage:
```bash
mikacli ai huggingface capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
