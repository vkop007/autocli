# AutoCLI

<!-- GENERATED:badges:start -->
[![npm version](https://img.shields.io/npm/v/%40vk007%2Fautocli)](https://www.npmjs.com/package/@vk007/autocli)
[![license](https://img.shields.io/github/license/vkop007/autocli)](./LICENSE)
[![providers](https://img.shields.io/badge/providers-117-blue)](#category-overview)
[![categories](https://img.shields.io/badge/categories-16-6f42c1)](#category-overview)
<!-- GENERATED:badges:end -->

AutoCLI is a terminal automation toolkit for developers and AI agents that turns websites, LLMs, developer platforms, editors, and utilities into one reusable CLI.

The core idea is simple:

- sign in once
- save the session or token locally
- keep using the provider headlessly from the terminal
- return clean `--json` output for scripts, agents, and orchestration

What makes AutoCLI especially useful is that it does not stop at API tokens. It works across cookies, saved browser sessions, user sessions, bot tokens, local tools, and public services, so the same CLI can drive GitHub, ChatGPT, Jira, Reddit, ffmpeg, DNS lookups, and more without switching tools.

## Why It Matters

<!-- GENERATED:why-it-matters-count:start -->
- One command surface across `117` providers.
<!-- GENERATED:why-it-matters-count:end -->
- Shared browser login means less manual cookie exporting for cookie-backed platforms.
- Sessions and tokens stay local, so follow-up commands are short and automation-friendly.
- Category-based routing stays predictable as the tool grows: `autocli llm ...`, `autocli google ...`, `autocli social ...`, `autocli developer ...`, `autocli devops ...`.
- Every provider is designed to be script-friendly, with strong `--json` support.
- Provider capability metadata helps agents see auth type, stability, browser support, and read/write boundaries before they guess.
- Shared result normalization adds stable JSON aliases like `data.items`, `data.entity`, and `data.guidance`.

## Auto Browser Login

AutoCLI can keep a shared browser profile under its own control, let you sign in once, then reuse that browser state for later provider logins.

That means you can:

- log into Google or another identity provider once
- use `Continue with Google`, passkeys, or normal web sign-in flows
- let later provider logins reuse that same saved browser profile
- avoid re-exporting cookies every time for many cookie-backed providers

Typical flow:

```bash
autocli login --browser
autocli developer github login --browser
autocli social x login --browser
autocli llm qwen login --browser
```

After the provider session is saved, normal commands stay headless:

```bash
autocli developer github me --json
autocli social x post "Shipping from AutoCLI"
autocli llm qwen text "Summarize this changelog"
```

## At a Glance

<!-- GENERATED:at-a-glance:start -->
| Item | Value |
| --- | --- |
| Package | `@vk007/autocli` |
| CLI command | `autocli` |
| Providers | `117` |
| Categories | `16` |
| npm install | `npm install -g @vk007/autocli` |
| bun install | `bun install -g @vk007/autocli` |
| Local setup | `bun install` |
| Docs sync | `bun run sync:docs` |
<!-- GENERATED:at-a-glance:end -->

## Get Started

Install globally with npm or Bun:

```bash
npm install -g @vk007/autocli
bun install -g @vk007/autocli
```

Validate the install right away:

```bash
autocli --version
autocli doctor
autocli doctor --fix
```

Set up the repo locally with Bun:

```bash
bun install
bun run build
```

Bootstrap the shared browser once if you want browser-assisted logins:

```bash
autocli login --browser
```

Clear saved state when you want to sign back out:

```bash
autocli logout
autocli logout x default
autocli logout --browser
```

Typical commands:

```bash
autocli status
autocli sessions validate
autocli sessions repair
autocli jobs
autocli logout x default
autocli search "youtube download"
autocli llm chatgpt text "Write release notes for AutoCLI"
autocli developer github login --browser
autocli developer github me --json
autocli developer github capabilities --json
autocli devops cloudflare zones --json
autocli devops render services --json
autocli jobs show job-id-example
autocli google gmail labels --json
autocli google calendar today --json
autocli google docs documents --json
autocli google forms forms --json
autocli google drive files --json
autocli google sheets values google-sheet-id-example Sheet1!A1:B5 --json
autocli tools page-links https://example.com --json
autocli tools http github inspect --json
```

Every provider help page now includes:

- a generated `Quick Start` block
- a `Support Profile` with auth, discovery, mutation, browser, and async support
- a `Stability Guide` so agents can tell whether a provider is `stable`, `partial`, or `experimental`

## Why Use AutoCLI

- Sign into real web apps once, then reuse the saved session from the terminal.
- Use the same CLI for LLMs, socials, job search, developer tools, devops platforms, editors, and public utilities.
- Keep auth local to your machine instead of scattering cookies and tokens across one-off scripts.
- Give agents and scripts a stable command model with consistent JSON output.
- Reach protected web surfaces that are awkward to automate with plain APIs alone.

## Command Model

AutoCLI is category-only. Provider commands never live at the root.

<!-- GENERATED:command-model-categories:start -->
- `autocli llm ...`
- `autocli editor ...`
- `autocli finance ...`
- `autocli data ...`
- `autocli google ...`
- `autocli maps ...`
- `autocli movie ...`
- `autocli news ...`
- `autocli music ...`
- `autocli social ...`
- `autocli careers ...`
- `autocli shopping ...`
- `autocli developer ...`
- `autocli devops ...`
- `autocli bot ...`
- `autocli tools ...`
<!-- GENERATED:command-model-categories:end -->

Examples:

```bash
autocli llm chatgpt text "Write release notes for AutoCLI"
autocli google gmail labels
autocli google calendar today
autocli google docs documents
autocli google forms forms
autocli google drive files
autocli google sheets values google-sheet-id-example Sheet1!A1:B10
autocli social x post "Shipping AutoCLI today"
autocli developer confluence search "release process"
autocli developer github me
autocli devops vercel projects
autocli bot telegrambot send 123456789 "Build finished"
autocli news top "AI"
autocli tools translate "hello world" --to hi
autocli tools timezone "Mumbai"
autocli tools oembed https://www.youtube.com/watch?v=dQw4w9WgXcQ
autocli tools http github request GET /settings/profile
autocli tools download info https://www.youtube.com/watch?v=dQw4w9WgXcQ
autocli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

## Google Workspace

Google providers share the same OAuth2 flow. Enable the APIs you need in Google Cloud, create an OAuth client, and register the localhost callback URI:

```text
http://127.0.0.1:3333/callback
```

Common APIs to enable:

- Gmail API
- Google Calendar API
- Google Docs API
- Google Forms API
- Google Drive API
- Google Sheets API

Typical login flow:

```bash
autocli google gmail login --client-id <id> --client-secret <secret>
autocli google calendar login --client-id <id> --client-secret <secret>
autocli google docs login --client-id <id> --client-secret <secret>
autocli google forms login --client-id <id> --client-secret <secret>
autocli google drive login --client-id <id> --client-secret <secret>
autocli google sheets login --client-id <id> --client-secret <secret>
```

Docs examples:

```bash
autocli google docs documents --limit 10 --json
autocli google docs document google-doc-id-example --json
autocli google docs content google-doc-id-example --json
autocli google docs create "Launch Notes" --text "Hello from AutoCLI" --json
autocli google docs append-text google-doc-id-example "More text from AutoCLI" --json
autocli google docs replace-text google-doc-id-example --search "draft" --replace "published" --json
```

Forms examples:

```bash
autocli google forms forms --limit 10 --json
autocli google forms form google-form-id-example --json
autocli google forms create "Launch Survey" --description "Tell us what you think" --json
autocli google forms add-text-question google-form-id-example --title "What should we improve?" --paragraph --required --json
autocli google forms add-choice-question google-form-id-example --title "How did we do?" --options "Great|Good|Okay|Needs work" --type RADIO --json
autocli google forms responses google-form-id-example --limit 20 --json
autocli google forms publish google-form-id-example --published true --accepting-responses true --json
```

Calendar examples:

```bash
autocli google calendar calendars --json
autocli google calendar today --calendar primary --json
autocli google calendar events --calendar primary --time-min 2026-04-12T00:00:00+05:30 --time-max 2026-04-12T23:59:59+05:30 --json
autocli google calendar create-event --calendar primary --summary "Launch review" --start 2026-04-12T10:00:00+05:30 --end 2026-04-12T10:30:00+05:30 --json
autocli google calendar update-event google-event-id-example --calendar primary --location "Zoom" --json
autocli google calendar delete-event google-event-id-example --calendar primary --json
```

## Cross-Site Downloads

Use `autocli tools download` for multi-site media downloads powered by `yt-dlp`, with optional saved-session cookies from AutoCLI when a site needs auth.

Examples:

```bash
autocli tools download info https://www.youtube.com/watch?v=dQw4w9WgXcQ --json
autocli tools download video https://x.com/user/status/123 --platform x
autocli tools download video https://www.instagram.com/reel/SHORTCODE/ --platform instagram --account default
autocli tools download audio https://www.youtube.com/watch?v=dQw4w9WgXcQ --audio-format mp3
autocli tools download batch ./urls.txt --mode video --quality 720p
autocli tools download info 'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI' --playlist --limit 5
```

## Command Search

Use `autocli search` to find providers and exact runnable commands across AutoCLI's built-in command surface.

Examples:

```bash
autocli search github
autocli search "youtube download"
autocli search uptime --category devops
autocli search gmail --category google
autocli search transcript --json
```

## Session Validation

Use `autocli sessions validate` when you want a live provider check instead of the last saved session state.

Examples:

```bash
autocli sessions validate
autocli sessions validate x
autocli sessions validate youtube default --json
```

Use `autocli sessions repair` when you want AutoCLI to validate first, then replay safe login paths like stored tokens or browser-assisted cookie repair.

Examples:

```bash
autocli sessions repair
autocli sessions repair x --browser
autocli sessions repair discordbot default --json
```

## Saved Jobs

Use `autocli jobs` to inspect saved media and async jobs across providers, then reopen, watch, download, or cancel them from one root command surface.

Examples:

```bash
autocli jobs
autocli jobs --platform grok
autocli jobs show job-id-example
autocli jobs watch job-id-example
autocli jobs download job-id-example --output-dir ./renders
autocli jobs cancel job-id-example --platform grok
```

## Cross-Site Transcripts

Use `autocli tools transcript` to pull subtitles or transcripts from media pages supported by `yt-dlp`, with plain text by default and subtitle formats when you need them.

Examples:

```bash
autocli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ
autocli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ --lang en --format srt
autocli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ --auto --format json --json
```

## Agent JSON Conventions

AutoCLI keeps provider-specific fields, but it also adds a few stable JSON aliases so agents can plan and transform results more reliably:

- `data.items` for list-style results, even when the provider also returns keys like `repos`, `projects`, `posts`, or `recommendations`
- `data.entity` for singular objects, even when the provider also returns keys like `profile`, `page`, `movie`, or `project`
- `data.meta.count` and `data.meta.listKey` for quick list summaries
- `data.guidance.recommendedNextCommand` and `data.guidance.nextCommands` for safer follow-up planning

Example:

```bash
autocli social reddit search "bun cli" --json
autocli movie tmdb title 27205 --json
autocli developer github capabilities --json
```
## Output Filtering & Field Selection

Use `--filter` and `--select` global flags to transform JSON results without external tools:

### Filter by conditions

```bash
autocli developer github repos --json --filter 'stargazers_count > 100'
autocli developer github repos --json --filter 'language = "TypeScript" AND stargazers_count > 1000'
autocli social x posts --json --filter 'public_metrics.likes > 5000'
```

### Select specific fields

```bash
autocli developer github repos --json --select name,stargazers_count,language
autocli social linkedin posts --json --select content,engagement_count,timestamp
```

### Combine filtering and selection

```bash
autocli developer github repos --json \
  --filter 'stargazers_count > 100 AND language = "TypeScript"' \
  --select name,stargazers_count,url
```

### Supported Operators

- **Comparison**: `>`, `<`, `>=`, `<=`, `=`, `!=`
- **Text**: `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`
- **Logic**: `AND`, `OR` with proper precedence
- **Nested fields**: Access via dot notation, e.g., `public_metrics.like_count`

For detailed examples and syntax reference, see [FILTERING_GUIDE.md](./FILTERING_GUIDE.md).

## Output Format Transformations

Transform JSON results into different formats without external tools using `--format`:

### Available Formats

- **`csv`** - Comma-separated values (for spreadsheets and data pipelines)
- **`table`** - Formatted terminal table with unicode borders
- **`yaml`** - YAML output (for configuration and infrastructure)
- **`markdown`** - Markdown tables (for documentation and reports)
- **`html`** - HTML tables (for email reports and web pages)
- **`json`** - Default JSON format

### Examples

```bash
# Export to CSV for Excel
autocli developer github repos --json --format csv > repos.csv

# Display as formatted table in terminal
autocli social reddit search "ai" --json --format table --filter 'score > 100'

# Generate markdown table for documentation
autocli developer github repos --json --format markdown --select name,language,stargazers_count

# Create HTML report
autocli devops vercel projects --json --format html --select name,updated_at > report.html

# YAML for configuration/infrastructure
autocli devops railway services --json --format yaml > services.yaml
```

### Combine Formats with Filtering & Selection

```bash
# High-star TypeScript repos as CSV
autocli developer github repos --json \
  --filter 'language = "TypeScript" AND stargazers_count > 100000' \
  --select name,stargazers_count,forks_count \
  --format csv > top-ts-repos.csv

# Popular posts as markdown table
autocli social reddit search "bun cli" --json \
  --filter 'score > 500' \
  --select title,author,score \
  --format markdown
```
## Stability Levels

- `stable`: ready for routine automation and the default choice when you have options
- `partial`: core flows work well, but some protected or edge routes may still need care
- `experimental`: useful, but still changing quickly and best used with extra verification
- `unknown`: not classified yet, so inspect with `capabilities --json` before leaning on it

To inspect a provider before acting:

```bash
autocli developer github capabilities --json
autocli social reddit capabilities --json
autocli devops railway capabilities --json
```

## Category Overview

<!-- GENERATED:category-overview:start -->
This inventory is generated from the live platform registry.

| Category | Representative providers | Count | Auth modes | Use it for | Route |
| --- | --- | ---: | --- | --- | --- |
| `llm` | `chatgpt`, `claude`, `deepseek`, `gemini`, `grok`, +4 more | 9 | `cookies` | Prompting, chat, image, and generation workflows. | `autocli llm ...` |
| `editor` | `archive`, `audio`, `document`, `gif`, `image`, +3 more | 8 | `none` | Local file, media, and document transformations. | `autocli editor ...` |
| `finance` | `crypto`, `currency`, `stocks` | 3 | `none` | Market, forex, and crypto lookups. | `autocli finance ...` |
| `data` | `csv`, `html`, `json`, `markdown`, `text`, +2 more | 7 | `none` | Structured data cleanup, conversion, filtering, and extraction. | `autocli data ...` |
| `google` | `calendar`, `docs`, `drive`, `forms`, `gmail`, +1 more | 6 | `oauth2` | Google Workspace APIs and account-backed productivity flows. | `autocli google ...` |
| `maps` | `geo`, `openstreetmap`, `osrm` | 3 | `none` | Geocoding, routing, elevation, and geometry helpers. | `autocli maps ...` |
| `movie` | `anilist`, `imdb`, `justwatch`, `kitsu`, `letterboxd`, +3 more | 8 | `cookies`, `none` | Title lookup, recommendations, and streaming availability. | `autocli movie ...` |
| `news` | `news` | 1 | `none` | Headline discovery, source search, and feed aggregation. | `autocli news ...` |
| `music` | `bandcamp`, `deezer`, `soundcloud`, `spotify`, `youtube-music` | 5 | `cookies`, `none` | Music discovery, playback, and library-style workflows. | `autocli music ...` |
| `social` | `bluesky`, `facebook`, `instagram`, `linkedin`, `mastodon`, +9 more | 14 | `cookies`, `none`, `session` | Posting, profile lookup, messaging, and public social reads. | `autocli social ...` |
| `careers` | `indeed`, `ziprecruiter` | 2 | `none` | Job search and hiring discovery workflows. | `autocli careers ...` |
| `shopping` | `amazon`, `ebay`, `etsy`, `flipkart` | 4 | `cookies`, `none` | Product discovery plus cart and order surfaces where supported. | `autocli shopping ...` |
| `developer` | `confluence`, `github`, `gitlab`, `jira`, `linear`, +2 more | 7 | `cookies` | Code hosting, issues, docs, and workspace automation. | `autocli developer ...` |
| `devops` | `cloudflare`, `digitalocean`, `fly`, `netlify`, `railway`, +4 more | 9 | `api token` | Infrastructure, deployments, DNS, and uptime automation. | `autocli devops ...` |
| `bot` | `discordbot`, `githubbot`, `slackbot`, `telegrambot` | 4 | `api token`, `bot token` | Bot-token messaging and chat ops. | `autocli bot ...` |
| `tools` | `cheat`, `dns`, `download`, `favicon`, `headers`, +22 more | 27 | `cookies`, `none`, `session` | Public utilities, temp mail, downloads, transcripts, and web helpers. | `autocli tools ...` |

AutoCLI currently exposes `117` providers across `16` active command groups.
<!-- GENERATED:category-overview:end -->

## Access Modes

| Needs | Meaning |
| --- | --- |
| `none` | Public or local functionality. No cookies, no token, no API key. |
| `local tools` | Uses binaries already installed on the machine, like `ffmpeg`, `ffprobe`, `qpdf`, or `yt-dlp`. |
| `cookies` | Import a browser session with `login --cookies ...` or let AutoCLI open a browser with `login --browser`, then reuse it headlessly. |
| `session` | Do one interactive login once, save the resulting user session locally, then reuse it headlessly. |
| `cookies + local token` | Cookie session plus a token the site keeps in localStorage or a similar client store. |
| `api token` | A personal or service token saved once with `login --token ...`. |
| `bot token` | A bot token saved once with `login --token ...`. |
| `browser later` | The current CLI route works for some surfaces, but more protected flows may later get an opt-in browser-backed mode. |

## Installation

### Recommended Global Install

Use the published package as the primary supported install path:

```bash
npm install -g @vk007/autocli
bun install -g @vk007/autocli
```

After install, verify the command and your local environment:

```bash
autocli --version
autocli doctor
autocli doctor --fix
autocli status
```

`autocli doctor` checks the shared browser setup plus optional local tools such as `ffmpeg`, `yt-dlp`, `qpdf`, `poppler`, `7z`, and macOS-native helpers when relevant.

On macOS, `autocli doctor --fix` can install all supported missing browser and local-tool dependencies automatically with Homebrew, then rerun the health check.

### Local Development Setup

Set up the repo locally with Bun:

```bash
bun install
```

Build the Node-targeted bundle:

```bash
bun run build
```

### Experimental Standalone Binary

You can also compile a standalone Bun binary:

```bash
bun run build:bin
```

This path is still experimental. The supported production install remains the npm or Bun global package above, because some runtime-heavy providers can behave differently in the compiled Bun binary.

### Local Development Linking

Link `autocli` globally for local development:

```bash
bun run link:global
```

If your shell still says `command not found`, open a new shell or run `hash -r`.

### Documentation Sync

Refresh the generated README sections, regenerate the provider-specific skill references, and sync the installed Codex skill copy:

```bash
bun run generate:readme
bun run generate:skill-providers
bun run sync:docs
bun run sync:skills
```

`bun run generate:readme` refreshes the marker-based sections in this README from the live provider registry.

`bun run sync:docs` runs the README generator, refreshes the generated files under [`skills/autocli/references/providers`](./skills/autocli/references/providers), and copies the repo skill into your local Codex skill directory (defaults to `~/.codex/skills/autocli` unless `CODEX_HOME` is set).

`npm publish` now runs this automatically through `prepublishOnly`, so release builds regenerate and sync the docs before typecheck, tests, and build.

### Platform Registry Sync

Platform manifests and provider runtime metadata are auto-discovered into generated files, so new providers no longer need a manual import/edit pass in `src/platforms/index.ts` or a hand-edited central config entry.

```bash
bun run generate:platform-registry
```

Common scripts such as `dev`, `start`, `typecheck`, `test`, `build`, and `generate:skill-providers` refresh the generated registry automatically.

## Open Source Project Files

- [LICENSE](./LICENSE)
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [AI Agent Skill](./skills/autocli/SKILL.md)

If you plan to contribute, please do not commit live cookies, tokens, QR session state, or personal exports. AutoCLI should only store those locally on the contributor machine, never in the repository.

## Quick Start

Check global status:

```bash
autocli status
autocli status --json
autocli doctor
autocli sessions
```

If you have not linked the CLI globally yet:

```bash
bun run dev status
```

Typical first-run flows:

```bash
autocli social x login --cookies ./x.cookies.json
autocli developer github login --browser
autocli llm chatgpt text "Summarize this changelog"
autocli developer github login --cookies ./github.cookies.json
autocli devops cloudflare login --token $CLOUDFLARE_API_TOKEN
autocli social telegram login --api-id 123456 --api-hash abcdef123456 --qr
autocli bot telegrambot login --token 123456:ABCDEF --name alerts-bot
autocli news top "AI"
autocli tools websearch search "bun commander zod"
autocli tools http github inspect
```

## Best Example Workflows

### Cookie-backed social posting

```bash
autocli social instagram login --cookies ./instagram.cookies.txt
autocli social instagram post ./photo.jpg --caption "Shipping from the terminal"
autocli social x login --cookies ./x.cookies.json
autocli social x post "Launching AutoCLI" --image ./launch.png
```

If you do not want to export cookies manually, many cookie-backed providers now also support:

```bash
autocli login --browser
autocli developer github login --browser
autocli social x login --browser
autocli llm qwen login --browser
```

`autocli login --browser` opens AutoCLI's shared browser profile so you can sign into Google or other identity providers once. Later provider logins reuse that same saved browser profile, and `autocli <category> <provider> login --browser` still skips opening the browser entirely when an already-saved active provider session is available.

### LLM prompting and generation

```bash
autocli llm chatgpt text "Write release notes for AutoCLI"
autocli llm deepseek login --cookies ./deepseek.cookies.json --token <userToken>
autocli llm deepseek text "Explain retrieval-augmented generation"
autocli llm grok image "Minimal orange fox logo on white background"
autocli llm grok video "Minimal orange fox logo with subtle camera motion"
```

### Developer and bot automation

```bash
autocli developer confluence search "deploy backend"
autocli developer github me
autocli developer gitlab projects "autocli" --limit 10
autocli developer jira projects
autocli developer linear issues --team ENG --limit 20
autocli developer trello boards
autocli devops netlify sites
autocli devops railway projects
autocli devops fly apps --org personal
autocli devops digitalocean apps
autocli bot telegrambot send 123456789 "Build finished"
autocli bot discordbot send 123456789012345678 "nightly deploy complete"
```

### Google workspace automation

```bash
autocli google gmail labels --json
autocli google calendar today --calendar primary --json
autocli google docs documents --limit 10 --json
autocli google forms forms --limit 10 --json
autocli google drive files --limit 10 --json
autocli google sheets values google-sheet-id-example Sheet1!A1:B10 --json
```

### Session-backed messaging

```bash
autocli social telegram login --api-id 123456 --api-hash abcdef123456 --qr
autocli social telegram send me "Hello from AutoCLI"
autocli social reddit search "bun cli"
autocli social reddit post programming "Launching AutoCLI" "Now with Reddit support."
autocli social whatsapp login
autocli social whatsapp send 919876543210 "Ping from AutoCLI"
```

### Public utilities

```bash
autocli news top "AI" --source google
autocli news search "typescript cli"
autocli news feed https://hnrss.org/frontpage --limit 5
autocli tools translate "hello world" --to hi
autocli tools websearch search "typescript cli bun"
autocli tools screenshot https://example.com --output-dir ./shots
autocli tools favicon openai.com
autocli tools page-links https://example.com --type external
autocli tools timezone "Mumbai"
autocli tools oembed https://www.youtube.com/watch?v=dQw4w9WgXcQ
autocli login --browser
autocli tools http github.com capture --browser-timeout 60
autocli tools http github.com capture --summary --group-by endpoint --browser-timeout 60
autocli tools uptime https://example.com --json
autocli tools rss https://hnrss.org/frontpage --limit 5
```

### Music discovery and download

```bash
autocli music bandcamp search "radiohead"
autocli music bandcamp album https://radiohead.bandcamp.com/album/in-rainbows
autocli music soundcloud search "dandelions"
autocli music soundcloud user aviciiofficial
autocli music soundcloud playlist https://soundcloud.com/lofi-hip-hop-music/sets/lofi-lofi
autocli music soundcloud download "dandelions" --output-dir ./downloads
```

### Local editing

```bash
autocli editor image resize ./photo.png --width 1200
autocli editor video split ./clip.mp4 --every 30
autocli editor video blur ./clip.mp4 --x 120 --y 80 --width 360 --height 200 --start 00:00:05 --duration 3 --corner-radius 24
autocli editor audio loudness-report ./podcast.wav
autocli editor pdf watermark ./deck.pdf --text "Internal"
autocli editor subtitle burn ./video.mp4 --subtitle ./captions.srt
```

## Sessions And Connections

Cookie sessions are stored under:

```text
~/.autocli/sessions/<platform>/<account>.json
```

Token, bot, and saved session connections are stored under:

```text
~/.autocli/connections/<platform>/<account>.json
```

AutoCLI supports importing:

- Netscape `cookies.txt`
- raw cookie strings
- JSON cookie arrays
- serialized `tough-cookie` jars

After the first `login`, later commands normally omit `--account` or `--bot` and AutoCLI uses the most recently saved connection for that provider.

## Provider Matrix

<!-- GENERATED:provider-matrix:start -->
The tables below are generated from provider manifests and runtime capability metadata, so they stay aligned with `autocli <category> <provider> capabilities --json`.

### LLM

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | `stable` | `cookies` | `supported` | `supported` | `supported` | `partial` | `autocli llm chatgpt` |
| Claude | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `autocli llm claude` |
| DeepSeek | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `autocli llm deepseek` |
| Gemini | `stable` | `cookies` | `supported` | `supported` | `supported` | `partial` | `autocli llm gemini` |
| Grok | `partial` | `cookies` | `supported` | `supported` | `supported` | `supported` | `autocli llm grok` |
| Mistral | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `autocli llm mistral` |
| Perplexity | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `autocli llm perplexity` |
| Qwen | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `autocli llm qwen` |
| Z.ai | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `autocli llm zai` |

Notes:
- `chatgpt`: Shared browser login works well for cookie capture and reuse.
- `deepseek`: Some flows also need a token recovered from browser storage.
- `grok`: AutoCLI can fall back to an in-browser Grok request path when the browserless endpoint is blocked.

### Editor

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Archive Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli editor archive` |
| Audio Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli editor audio` |
| Document Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli editor document` |
| GIF Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli editor gif` |
| Image Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli editor image` |
| PDF Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli editor pdf` |
| Subtitle Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli editor subtitle` |
| Video Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli editor video` |

### Finance

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Crypto | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli finance crypto` |
| Currency | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli finance currency` |
| Stocks | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli finance stocks` |

### Data

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CSV | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli data csv` |
| HTML | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli data html` |
| JSON | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli data json` |
| Markdown | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli data markdown` |
| Text | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli data text` |
| XML | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli data xml` |
| YAML | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli data yaml` |

### Google

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gmail | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli google gmail` |
| Google Calendar | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli google calendar` |
| Google Docs | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli google docs` |
| Google Drive | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli google drive` |
| Google Forms | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli google forms` |
| Google Sheets | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli google sheets` |

Notes:
- `gmail`: Uses Google's OAuth2 flow and stores refresh tokens locally for headless reuse.
- `calendar`: Uses Google's OAuth2 flow for calendar listing plus Google Calendar event reads and writes.
- `docs`: Uses Google's OAuth2 flow for Google Docs listing, content reads, document creation, and text edits.
- `drive`: Uses Google's OAuth2 flow and supports Drive file listing, uploads, downloads, and deletes.
- `forms`: Uses Google's OAuth2 flow plus Drive-backed listing and deletion for Google Forms CRUD, responses, and publish settings.
- `sheets`: Uses Google's OAuth2 flow for spreadsheet reads and writes.

### Maps

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Geo | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli maps geo` |
| OpenStreetMap | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli maps openstreetmap` |
| OSRM | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli maps osrm` |

### Movie

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AniList | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli movie anilist` |
| IMDb | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli movie imdb` |
| JustWatch | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli movie justwatch` |
| Kitsu | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli movie kitsu` |
| Letterboxd | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli movie letterboxd` |
| MyAnimeList | `stable` | `cookies`, `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli movie myanimelist` |
| TMDb | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli movie tmdb` |
| TVMaze | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli movie tvmaze` |

### News

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| News | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli news` |

### Music

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bandcamp | `stable` | `none` | `supported` | `unsupported` | `partial` | `unsupported` | `autocli music bandcamp` |
| Deezer | `stable` | `none` | `supported` | `unsupported` | `partial` | `unsupported` | `autocli music deezer` |
| SoundCloud | `stable` | `none` | `supported` | `partial` | `partial` | `unsupported` | `autocli music soundcloud` |
| Spotify | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli music spotify` |
| YouTube Music | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli music youtube-music` |

### Social

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bluesky | `stable` | `none`, `session` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli social bluesky` |
| Facebook | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli social facebook` |
| Instagram | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli social instagram` |
| LinkedIn | `partial` | `cookies` | `supported` | `partial` | `supported` | `unsupported` | `autocli social linkedin` |
| Mastodon | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli social mastodon` |
| Pinterest | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli social pinterest` |
| Reddit | `partial` | `none`, `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli social reddit` |
| Telegram | `partial` | `session` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli social telegram` |
| Threads | `partial` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli social threads` |
| TikTok | `partial` | `cookies` | `supported` | `partial` | `supported` | `unsupported` | `autocli social tiktok` |
| Twitch | `partial` | `cookies` | `supported` | `partial` | `supported` | `unsupported` | `autocli social twitch` |
| WhatsApp | `partial` | `session` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli social whatsapp` |
| X | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli social x` |
| YouTube | `partial` | `cookies` | `supported` | `partial` | `supported` | `unsupported` | `autocli social youtube` |

Notes:
- `bluesky`: Public reads stay available without auth. App-password login enables saved-session `me`, `post`, `comment`, and `like` commands without browser automation.
- `facebook`: Facebook writes now run through browser-backed post, like, and comment flows. Use `--browser` to jump straight into the shared AutoCLI browser profile when you want the visible browser path.
- `instagram`: Reads and image/comment writes are browserless; post and comment deletion can fall back to browser-backed flows when Instagram's web APIs get flaky.
- `reddit`: Public reads are stable; writes can use a saved session or the shared browser profile.
- `telegram`: Uses saved MTProto sessions instead of browser cookies.
- `twitch`: Uses Twitch's authenticated web GraphQL surface for channel, stream, video, and clip lookups.
- `twitch`: Follow and unfollow try Twitch's web mutation path first, then can fall back to the shared AutoCLI browser profile when Twitch enforces an integrity challenge.
- `twitch`: Clip creation and stream settings updates currently run through the shared AutoCLI browser profile.
- `whatsapp`: Uses QR or pairing-code session state instead of browser cookies.
- `x`: X write actions run through browser-backed flows. Use `--browser` to force the shared AutoCLI browser profile immediately when you want the live browser path.
- `youtube`: Studio uploads are browser-backed. Watch-page likes, dislikes, comments, and subscriptions still use request tokens from the saved session.

### Careers

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Indeed | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli careers indeed` |
| ZipRecruiter | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli careers ziprecruiter` |

### Shopping

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Amazon | `partial` | `cookies` | `supported` | `partial` | `supported` | `unsupported` | `autocli shopping amazon` |
| eBay | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli shopping ebay` |
| Etsy | `partial` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli shopping etsy` |
| Flipkart | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli shopping flipkart` |

Notes:
- `amazon`: `add-to-cart`, `remove-from-cart`, `update-cart`, `orders`, `order`, and `cart` support browser-backed execution when the saved session alone is not enough.
- `flipkart`: Uses the saved Flipkart session for cart actions. New adds use the authenticated cart endpoint; quantity updates and removals use the saved session in an invisible browser.

### Developer

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Confluence | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli developer confluence` |
| GitHub | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli developer github` |
| GitLab | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli developer gitlab` |
| Jira | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli developer jira` |
| Linear | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli developer linear` |
| Notion | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli developer notion` |
| Trello | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `autocli developer trello` |

Notes:
- `github`: Uses a saved GitHub web session for browserless repository automation.

### DevOps

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cloudflare | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli devops cloudflare` |
| DigitalOcean | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli devops digitalocean` |
| Fly.io | `partial` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli devops fly` |
| Netlify | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli devops netlify` |
| Railway | `partial` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli devops railway` |
| Render | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli devops render` |
| Supabase | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli devops supabase` |
| UptimeRobot | `stable` | `api token` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli devops uptimerobot` |
| Vercel | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `autocli devops vercel` |

Notes:
- `fly`: Org-aware app listing may require an explicit --org slug for some tokens.
- `railway`: Uses Railway's GraphQL surface, so some deeper actions may still be added later.
- `uptimerobot`: Uses UptimeRobot's official v3 API with bearer-token authentication.

### Bot

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Discord Bot | `stable` | `bot token` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli bot discordbot` |
| GitHub Bot | `stable` | `api token` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli bot githubbot` |
| Slack Bot | `stable` | `bot token` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli bot slackbot` |
| Telegram Bot | `stable` | `bot token` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli bot telegrambot` |

### Tools

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cheat | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools cheat` |
| DNS | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools dns` |
| Download | `stable` | `none`, `cookies` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools download` |
| Favicon | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools favicon` |
| Headers | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools headers` |
| HTTP Toolkit | `stable` | `none`, `cookies` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli tools http` |
| IP | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools ip` |
| Markdown Fetch | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools markdown-fetch` |
| Metadata | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools metadata` |
| oEmbed | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools oembed` |
| Page Links | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools page-links` |
| QR | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools qr` |
| Redirect | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools redirect` |
| Robots | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools robots` |
| RSS | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools rss` |
| Screenshot | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools screenshot` |
| Sitemap | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools sitemap` |
| SSL | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools ssl` |
| Temp Mail | `stable` | `session` | `supported` | `supported` | `unsupported` | `unsupported` | `autocli tools tempmail` |
| Time | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools time` |
| Timezone | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools timezone` |
| Transcript | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools transcript` |
| Translate | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools translate` |
| Uptime | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools uptime` |
| Weather | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools weather` |
| Web Search | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools websearch` |
| Whois | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `autocli tools whois` |

Notes:
- `http`: Best used with saved sessions or the shared browser profile for authenticated request inspection and replay.
- `tempmail`: Uses Mail.tm's free disposable inbox API and stores the mailbox session locally for reuse.
<!-- GENERATED:provider-matrix:end -->

## Agent-Friendly Output

Every command supports `--json`.

Success shape:

```json
{
  "ok": true,
  "platform": "x",
  "account": "personal",
  "action": "post",
  "message": "X post created for personal.",
  "id": "1234567890",
  "url": "https://x.com/user/status/1234567890"
}
```

Error shape:

```json
{
  "ok": false,
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "X returned a logged-out page. Re-import cookies.txt."
  }
}
```

This makes AutoCLI friendly for:

- shell scripts
- CI jobs
- multi-step agents
- external orchestrators

## Session Refresh

AutoCLI includes a refresh layer in `src/utils/autorefresh.ts`.

- Instagram, X, and YouTube can use lightweight authenticated keepalive checks before normal actions.
- Rotated cookies are persisted back into the saved session file when the platform returns them.
- Some platforms still do not support a durable cookie-only refresh path, so expiration handling remains provider-specific.

This is the most practical browserless approach for copied web sessions, but it is not a universal guarantee for every website.

For cookie-backed providers that support interactive capture, you can also use `login --browser` to open a real browser, complete the sign-in flow manually, and let AutoCLI save the session automatically.

## Project Structure

```text
.
├── README.md
├── package.json
├── tsconfig.json
└── src
    ├── __tests__
    ├── core
    │   ├── auth
    │   └── runtime
    ├── commands
    ├── platforms
    │   ├── bot
    │   ├── developer
    │   ├── editor
    │   ├── finance
    │   ├── llm
    │   ├── maps
    │   ├── movie
    │   ├── music
    │   ├── shopping
    │   ├── social
    │   ├── tools
    │   ├── config.ts
    │   └── index.ts
    ├── utils
    ├── config.ts
    ├── errors.ts
    ├── index.ts
    └── logger.ts
```

## Development

Run the local CLI:

```bash
bun run dev --help
bun run dev social x login --cookies ./cookie.json
```

Watch mode:

```bash
bun run dev:watch --help
```

Typecheck:

```bash
bun run typecheck
```

Run tests:

```bash
bun test
```

## Notes On Reliability

- Cookie-backed private web flows can drift as providers change internal endpoints.
- Token-backed developer and bot providers are usually the most stable long-term.
- Local editor and public utility providers are the least fragile because they do not depend on private web sessions.
- The category model is intentionally strict so provider names do not collide as AutoCLI grows.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=vkop007/autocli&type=Date)](https://star-history.com/#vkop007/autocli&Date)
