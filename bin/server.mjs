#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import OpenAI from 'openai';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const DEFAULT_MODEL = 'qwen/qwen3-vl-235b-a22b-instruct';
const MODEL = process.env.QWEN_MODEL || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
const API_KEY = readApiKey();

function readApiKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim();
  const keyFile = process.env.OPENROUTER_API_KEY_FILE;
  if (keyFile && fs.existsSync(keyFile)) return fs.readFileSync(keyFile, 'utf8').trim();
  return '';
}

function requireApiKey() {
  if (!API_KEY) {
    throw new Error('Missing OpenRouter API key. Set OPENROUTER_API_KEY or OPENROUTER_API_KEY_FILE.');
  }
}

const client = new OpenAI({
  apiKey: API_KEY || 'missing-key',
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://github.com/Custimoo-Ops/qwen-mcp',
    'X-Title': process.env.OPENROUTER_TITLE || 'Custimoo Qwen Design MCP'
  }
});

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function imageContentFromInput(input, label='image') {
  if (!input || typeof input !== 'string') throw new Error(`${label} is required`);
  if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('data:')) {
    return { type: 'image_url', image_url: { url: input } };
  }
  const filePath = input.replace(/^file:\/\//, '');
  if (!fs.existsSync(filePath)) throw new Error(`${label} file not found: ${filePath}`);
  const stat = fs.statSync(filePath);
  const maxBytes = Number(process.env.QWEN_MCP_MAX_FILE_BYTES || 20 * 1024 * 1024);
  if (stat.size > maxBytes) throw new Error(`${label} exceeds size limit (${stat.size} > ${maxBytes} bytes)`);
  const data = fs.readFileSync(filePath).toString('base64');
  return { type: 'image_url', image_url: { url: `data:${mimeFor(filePath)};base64,${data}` } };
}

const productionReviewPrompt = `You are a senior production design assistant for Custimoo garment and merchandise production.
Review only what is visible/provided. Do not invent facts.
Focus on: artwork placement, alignment, scale, colors, missing elements, text/logo distortion, print/embroidery feasibility, artifacts, export/vector risks, ambiguity needing human confirmation.
Return concise structured feedback with:
1. Summary
2. Critical issues
3. Major issues
4. Minor issues
5. Production risks
6. Designer action checklist
7. Questions/uncertainties`;

async function qwenVision(messages, maxTokens=1800) {
  requireApiKey();
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages,
    temperature: Number(process.env.QWEN_TEMPERATURE || 0.2),
    max_tokens: maxTokens
  });
  return completion.choices?.[0]?.message?.content || '';
}

const tools = [
  {
    name: 'review_design_image',
    description: 'Review one design/mockup/reference image with Qwen3-VL for production readiness. Accepts a local image path, image URL, or data URL.',
    inputSchema: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Local file path, image URL, or data URL.' },
        context: { type: 'string', description: 'Optional order/customer/design context.' },
        focus: { type: 'string', description: 'Optional focus area, e.g. logo placement, print readiness, garment tech pack.' }
      },
      required: ['image']
    }
  },
  {
    name: 'compare_design_images',
    description: 'Compare a customer/reference image against a produced mockup/export and list meaningful production differences.',
    inputSchema: {
      type: 'object',
      properties: {
        reference_image: { type: 'string', description: 'Reference/customer image path, URL, or data URL.' },
        produced_image: { type: 'string', description: 'Produced mockup/export image path, URL, or data URL.' },
        context: { type: 'string', description: 'Optional customer/order notes.' }
      },
      required: ['reference_image', 'produced_image']
    }
  },
  {
    name: 'vectorization_qa',
    description: 'Compare original raster artwork and vectorized preview/export to decide whether vectorization is production-ready.',
    inputSchema: {
      type: 'object',
      properties: {
        original_image: { type: 'string', description: 'Original raster logo/artwork path, URL, or data URL.' },
        vector_preview: { type: 'string', description: 'Rendered preview of SVG/PDF/EPS vector result as image path, URL, or data URL.' },
        context: { type: 'string', description: 'Optional production context.' }
      },
      required: ['original_image', 'vector_preview']
    }
  },
  {
    name: 'ask_qwen_design',
    description: 'General Qwen3-VL design coworker prompt. Optional image input. Use focused tools above when possible.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Question/task for Qwen.' },
        image: { type: 'string', description: 'Optional image path, URL, or data URL.' }
      },
      required: ['prompt']
    }
  }
];

const server = new Server({ name: 'custimoo-qwen-design-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args = {} } = request.params;
    let result;
    if (name === 'review_design_image') {
      result = await qwenVision([
        { role: 'system', content: productionReviewPrompt },
        { role: 'user', content: [
          { type: 'text', text: `Context: ${args.context || 'none'}\nFocus: ${args.focus || 'general production readiness'}\nReview this design image.` },
          imageContentFromInput(args.image, 'image')
        ]}
      ]);
    } else if (name === 'compare_design_images') {
      result = await qwenVision([
        { role: 'system', content: productionReviewPrompt },
        { role: 'user', content: [
          { type: 'text', text: `Context: ${args.context || 'none'}\nCompare image 1 (reference/customer expectation) with image 2 (produced mockup/export). List only meaningful visual/production differences and recommended corrections.` },
          imageContentFromInput(args.reference_image, 'reference_image'),
          imageContentFromInput(args.produced_image, 'produced_image')
        ]}
      ], 2200);
    } else if (name === 'vectorization_qa') {
      result = await qwenVision([
        { role: 'system', content: productionReviewPrompt },
        { role: 'user', content: [
          { type: 'text', text: `Context: ${args.context || 'none'}\nCompare image 1 (original raster artwork) with image 2 (vectorized result preview). Check lost details, artifacts, path/shape quality visible in preview, text/logo distortion, color changes, and production readiness.` },
          imageContentFromInput(args.original_image, 'original_image'),
          imageContentFromInput(args.vector_preview, 'vector_preview')
        ]}
      ], 2200);
    } else if (name === 'ask_qwen_design') {
      const content = [{ type: 'text', text: args.prompt }];
      if (args.image) content.push(imageContentFromInput(args.image, 'image'));
      result = await qwenVision([{ role: 'system', content: productionReviewPrompt }, { role: 'user', content }], 2200);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: result }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error?.message || String(error) }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
