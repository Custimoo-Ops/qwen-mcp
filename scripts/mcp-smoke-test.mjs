#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['bin/server.mjs'],
  env: {
    ...process.env,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || 'smoke-test-key',
    QWEN_SYSTEM_PROMPT_URL: 'off'
  }
});

const client = new Client({ name: 'qwen-mcp-smoke-test', version: '0.1.0' });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const names = tools.tools.map((tool) => tool.name).sort();
  const required = ['ask_qwen_design', 'check_qwen_availability', 'compare_design_images', 'review_design_image', 'vectorization_qa'];
  for (const name of required) {
    if (!names.includes(name)) throw new Error(`Missing MCP tool: ${name}`);
  }
  const status = await client.callTool({ name: 'check_qwen_availability', arguments: { ping: false } });
  const text = status.content?.[0]?.text || '';
  if (!text.includes('serverRunning')) throw new Error('Availability response did not include serverRunning status');
  console.log(`QWEN_MCP_SMOKE_OK tools=${names.length}`);
} finally {
  await client.close();
}
