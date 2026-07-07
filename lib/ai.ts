// Anthropic API 클라이언트 — ANTHROPIC_API_KEY가 없으면 목업 응답
import Anthropic from '@anthropic-ai/sdk';
import { isMockAi } from './env';

const MODEL = 'claude-sonnet-4-6';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// 응답에서 JSON만 추출 (코드펜스/앞뒤 설명 제거)
function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  if (start < 0) throw new Error(`AI 응답에서 JSON을 찾지 못했습니다: ${text.slice(0, 200)}`);
  return JSON.parse(raw.slice(start).trim());
}

export async function aiJson<T>(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  mock: () => T;
}): Promise<T> {
  if (isMockAi()) return opts.mock();
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: 'user', content: opts.prompt }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return parseJson<T>(text);
}

export async function aiText(opts: { system: string; prompt: string; maxTokens?: number; mock: () => string }): Promise<string> {
  if (isMockAi()) return opts.mock();
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1500,
    system: opts.system,
    messages: [{ role: 'user', content: opts.prompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
