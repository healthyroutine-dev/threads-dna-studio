// DATABASE_URL이 없을 때 쓰는 로컬 JSON 파일 저장소 (목업/개발용)
import { promises as fs } from 'fs';
import path from 'path';
import type { Store } from './store';
import type {
  AiUsage,
  Dna,
  Draft,
  FollowerSnapshot,
  Idea,
  Insight,
  Post,
  RecordItem,
  SyncState,
  Token,
  User,
} from './types';

interface Data {
  users: Record<string, User>;
  tokens: Record<string, Token>;
  posts: Record<string, Post>;
  insights: Record<string, Insight>;
  dna: Record<string, Dna[]>;
  ideas: Idea[];
  drafts: Draft[];
  records: RecordItem[];
  snapshots: FollowerSnapshot[];
  sync: Record<string, SyncState>;
  ai_usage: Record<string, number>; // key: userId:date
}

const EMPTY: Data = {
  users: {},
  tokens: {},
  posts: {},
  insights: {},
  dna: {},
  ideas: [],
  drafts: [],
  records: [],
  snapshots: [],
  sync: {},
  ai_usage: {},
};

const FILE = path.join(process.cwd(), '.data', 'store.json');
let cache: Data | null = null;
let writing: Promise<void> = Promise.resolve();

async function load(): Promise<Data> {
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...JSON.parse(await fs.readFile(FILE, 'utf8')) };
  } catch {
    cache = structuredClone(EMPTY);
  }
  return cache!;
}

function persist() {
  writing = writing.then(async () => {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(cache, null, 2));
  });
  return writing;
}

export class FileStore implements Store {
  async upsertUser(user: Omit<User, 'created_at' | 'plan'> & Partial<Pick<User, 'plan'>>): Promise<User> {
    const d = await load();
    const existing = d.users[user.id];
    const merged: User = {
      ...existing,
      ...user,
      plan: user.plan ?? existing?.plan ?? 'free',
      created_at: existing?.created_at ?? new Date().toISOString(),
    };
    d.users[user.id] = merged;
    await persist();
    return merged;
  }

  async getUser(id: string): Promise<User | null> {
    return (await load()).users[id] ?? null;
  }

  async saveToken(token: Token): Promise<void> {
    const d = await load();
    d.tokens[token.user_id] = token;
    await persist();
  }

  async getToken(userId: string): Promise<Token | null> {
    return (await load()).tokens[userId] ?? null;
  }

  async upsertPosts(posts: Post[]): Promise<void> {
    const d = await load();
    for (const p of posts) d.posts[p.id] = p;
    await persist();
  }

  async getPosts(userId: string): Promise<Post[]> {
    const d = await load();
    return Object.values(d.posts)
      .filter((p) => p.user_id === userId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async saveInsights(insights: Insight[]): Promise<void> {
    const d = await load();
    for (const i of insights) d.insights[i.post_id] = i;
    await persist();
  }

  async getInsights(userId: string): Promise<Record<string, Insight>> {
    const d = await load();
    const postIds = new Set(Object.values(d.posts).filter((p) => p.user_id === userId).map((p) => p.id));
    const out: Record<string, Insight> = {};
    for (const [pid, ins] of Object.entries(d.insights)) if (postIds.has(pid)) out[pid] = ins;
    return out;
  }

  async saveDna(userId: string, dna: Dna): Promise<void> {
    const d = await load();
    (d.dna[userId] ??= []).push(dna);
    await persist();
  }

  async getLatestDna(userId: string): Promise<Dna | null> {
    const list = (await load()).dna[userId] ?? [];
    return list.length ? list[list.length - 1] : null;
  }

  async getDnaVersionCount(userId: string): Promise<number> {
    return ((await load()).dna[userId] ?? []).length;
  }

  async saveIdeas(ideas: Idea[]): Promise<void> {
    const d = await load();
    d.ideas.push(...ideas);
    await persist();
  }

  async getRecentIdeas(userId: string, limit: number): Promise<Idea[]> {
    const d = await load();
    return d.ideas
      .filter((i) => i.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  async saveDraft(draft: Draft): Promise<void> {
    const d = await load();
    const idx = d.drafts.findIndex((x) => x.id === draft.id);
    if (idx >= 0) d.drafts[idx] = draft;
    else d.drafts.push(draft);
    await persist();
  }

  async getDraft(userId: string, id: string): Promise<Draft | null> {
    const d = await load();
    return d.drafts.find((x) => x.id === id && x.user_id === userId) ?? null;
  }

  async getDrafts(userId: string): Promise<Draft[]> {
    const d = await load();
    return d.drafts
      .filter((x) => x.user_id === userId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async saveRecord(record: RecordItem): Promise<void> {
    const d = await load();
    d.records.push(record);
    await persist();
  }

  async getRecords(userId: string): Promise<RecordItem[]> {
    const d = await load();
    return d.records
      .filter((r) => r.user_id === userId)
      .sort((a, b) => b.published_at.localeCompare(a.published_at));
  }

  async upsertSnapshot(snap: FollowerSnapshot): Promise<void> {
    const d = await load();
    const idx = d.snapshots.findIndex((s) => s.user_id === snap.user_id && s.date === snap.date);
    if (idx >= 0) d.snapshots[idx] = snap;
    else d.snapshots.push(snap);
    await persist();
  }

  async getSnapshots(userId: string): Promise<FollowerSnapshot[]> {
    const d = await load();
    return d.snapshots
      .filter((s) => s.user_id === userId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getSyncState(userId: string): Promise<SyncState | null> {
    return (await load()).sync[userId] ?? null;
  }

  async saveSyncState(state: SyncState): Promise<void> {
    const d = await load();
    d.sync[state.user_id] = state;
    await persist();
  }

  async getAiUsage(userId: string, date: string): Promise<AiUsage> {
    const d = await load();
    return { user_id: userId, date, count: d.ai_usage[`${userId}:${date}`] ?? 0 };
  }

  async incrAiUsage(userId: string, date: string): Promise<number> {
    const d = await load();
    const key = `${userId}:${date}`;
    d.ai_usage[key] = (d.ai_usage[key] ?? 0) + 1;
    await persist();
    return d.ai_usage[key];
  }
}
