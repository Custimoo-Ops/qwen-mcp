# Custimoo Qwen Design MCP

Claude Desktop MCP server for testing Qwen3-VL as a production design coworker through OpenRouter.

## Model

Default model:

    qwen/qwen3-vl-235b-a22b-instruct

Override with:

    QWEN_MODEL=qwen/qwen3-vl-235b-a22b-thinking

## Tools

- `check_qwen_availability` — check whether the MCP server is connected, whether an OpenRouter key is configured, and optionally ping OpenRouter.
- `review_design_image` — review a mockup/reference/export image for production readiness.
- `compare_design_images` — compare customer reference vs produced mockup/export.
- `vectorization_qa` — compare original raster artwork vs vectorized result preview.
- `ask_qwen_design` — general Qwen design coworker prompt with optional image.

Inputs can be local image paths, HTTPS image URLs, or data URLs.

## Claude Desktop / Company Connector config

The Custimoo `Plugins` company marketplace points Claude Desktop at this package with `npx`.

The MCP server requires one of:

    OPENROUTER_API_KEY=sk-or-...

or:

    OPENROUTER_API_KEY_FILE=/path/to/openrouter-key.md

or a local key file:

    ~/.custimoo/openrouter-qwen.key

A designer can create the local key file with:

    mkdir -p ~/.custimoo
    pbpaste > ~/.custimoo/openrouter-qwen.key
    chmod 600 ~/.custimoo/openrouter-qwen.key

Only do this after copying the approved OpenRouter key to the clipboard. Do not commit API keys into GitHub.

If Claude says the plugin is “still connecting”, check that Node/npm are installed and reachable from Claude Desktop, then restart Claude Desktop. If Claude says “organization has disabled Claude subscription access for Claude Code”, that is a separate Claude access/admin setting: Qwen still needs a working host Claude account/session to invoke the MCP tools.

## Local smoke test

    npm install
    OPENROUTER_API_KEY_FILE="$HOME/.custimoo/openrouter-qwen.key" npm start

The server runs on stdio, so it will wait silently for MCP messages. Use Claude Desktop or an MCP inspector for interactive testing.



## Central updates

Designer installations should run this package through the Custimoo `Plugins` company marketplace. The marketplace pins the `npx` source to an immutable release tag such as:

`npx -y github:Custimoo-Ops/qwen-mcp#v0.1.2`

Do not point production installs at `#main`. Release a reviewed tag when server/tool fixes should roll out.

The production review rubric is bundled from `prompts/qwen-design-system-prompt.md` inside the pinned package. For local testing only, set `QWEN_SYSTEM_PROMPT_FILE`. If `QWEN_SYSTEM_PROMPT_URL` is used, it must be a `raw.githubusercontent.com` URL pinned to a 40-character commit SHA; branch URLs such as `/main/` are rejected.
