// 환경변수가 없으면 목업 모드로 동작한다.
export function isMockThreads(): boolean {
  return !(process.env.THREADS_APP_ID && process.env.THREADS_APP_SECRET);
}

export function isMockAi(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

export function isFileDb(): boolean {
  return !process.env.DATABASE_URL;
}

export function aiDailyLimit(): number {
  const n = parseInt(process.env.AI_DAILY_LIMIT || '30', 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function sessionSecret(): string {
  return process.env.SESSION_SECRET || 'dev-only-insecure-secret';
}
