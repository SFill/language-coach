#!/usr/bin/env node

/**
 * judge.mjs — Vision model comparison bridge
 *
 * Compares a target screenshot against an implementation screenshot
 * using a vision model API. Returns structured text feedback.
 *
 * Usage:
 *   node scripts/judge.mjs --target <target.png> --impl <impl.png> [--model <model>]
 *
 * Environment:
 *   OPENAI_API_KEY  — required for GPT-4o / GPT-4.1 vision
 *   ANTHROPIC_API_KEY — required for Claude vision
 *
 * Output: JSON with { match: boolean, feedback: string, diff_areas: string[] }
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const targetPath = getArg('--target');
const implPath = getArg('--impl');
const model = getArg('--model') || 'gpt-4o';

if (!targetPath || !implPath) {
  console.error('Usage: node judge.mjs --target <target.png> --impl <impl.png> [--model <model>]');
  process.exit(1);
}

function imageToBase64(filePath) {
  const ext = path.extname(filePath).slice(1);
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  const data = fs.readFileSync(filePath).toString('base64');
  return { type: `image/${mime}`, data };
}

async function judgeWithOpenAI(target, impl, model) {
  const targetImg = imageToBase64(target);
  const implImg = imageToBase64(impl);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a UI reviewer. Compare two screenshots: TARGET (desired design) and IMPLEMENTATION (current build).
Return a JSON object with:
- "match": boolean — true if implementation closely matches the target
- "feedback": string — specific, actionable feedback on what to fix. Be precise about spacing, colors, fonts, layout.
- "diff_areas": string[] — list of areas that differ (e.g. "navbar padding", "button color", "font size")`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'TARGET screenshot:' },
            { type: 'image_url', image_url: { url: `data:${targetImg.type};base64,${targetImg.data}` } },
            { type: 'text', text: 'IMPLEMENTATION screenshot:' },
            { type: 'image_url', image_url: { url: `data:${implImg.type};base64,${implImg.data}` } },
          ],
        },
      ],
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${err}`);
  }

  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
}

async function judgeWithClaude(target, impl) {
  const targetImg = imageToBase64(target);
  const implImg = imageToBase64(impl);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: targetImg.type, data: targetImg.data },
            },
            { type: 'text', text: 'TARGET screenshot' },
            {
              type: 'image',
              source: { type: 'base64', media_type: implImg.type, data: implImg.data },
            },
            { type: 'text', text: 'IMPLEMENTATION screenshot. Compare these two. Return JSON: { "match": bool, "feedback": string, "diff_areas": string[] }' },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${err}`);
  }

  const result = await response.json();
  const text = result.content[0].text;
  // Extract JSON from potential markdown code block
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```|(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[2]) : text;
  return JSON.parse(jsonStr);
}

async function main() {
  const isClaude = model.startsWith('claude');

  try {
    const result = isClaude
      ? await judgeWithClaude(targetPath, implPath)
      : await judgeWithOpenAI(targetPath, implPath, model);

    console.log(JSON.stringify(result, null, 2));

    if (!result.match) {
      process.exit(2); // Non-match exit code
    }
  } catch (err) {
    console.error('Judge failed:', err.message);
    process.exit(1);
  }
}

main();