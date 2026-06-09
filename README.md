# Custimoo Qwen Design MCP

Claude Desktop MCP server for testing Qwen3-VL as a production design coworker through OpenRouter.

## Model

Default model:

    qwen/qwen3-vl-235b-a22b-instruct

Override with:

    QWEN_MODEL=qwen/qwen3-vl-235b-a22b-thinking

## Tools

- `review_design_image` — review a mockup/reference/export image for production readiness.
- `compare_design_images` — compare customer reference vs produced mockup/export.
- `vectorization_qa` — compare original raster artwork vs vectorized result preview.
- `ask_qwen_design` — general Qwen design coworker prompt with optional image.

Inputs can be local image paths, HTTPS image URLs, or data URLs.

## Claude Desktop / Company Connector config

The Custimoo `Connectors` marketplace plugin points Claude Desktop at this package with `npx`.

The MCP server requires one of:

    OPENROUTER_API_KEY=sk-or-...

or:

    OPENROUTER_API_KEY_FILE=/path/to/openrouter-key.md

Do not commit API keys into GitHub.

## Local smoke test

    npm install
    OPENROUTER_API_KEY_FILE="/Users/dsmacmini/Documents/David-Obsidian/Qwen Ops key - openrouter.md" npm start

The server runs on stdio, so it will wait silently for MCP messages. Use Claude Desktop or an MCP inspector for interactive testing.



## Central updates

Designer installations should run this package through the Custimoo `Plugins` marketplace, which points Claude Desktop at:

`npx -y github:Custimoo-Ops/qwen-mcp#main`

That means MCP server/tool fixes are controlled centrally from this repository and are picked up when Claude Desktop restarts and launches the server again.

The production review behavior is also centrally controlled by `prompts/qwen-design-system-prompt.md`. By default the server fetches the prompt from GitHub raw on startup. To override it for testing, set `QWEN_SYSTEM_PROMPT_FILE` or `QWEN_SYSTEM_PROMPT_URL`. Set `QWEN_SYSTEM_PROMPT_URL=off` to use the built-in fallback prompt.
