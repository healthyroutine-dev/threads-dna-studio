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
import { isFileDb } from './env';

export interface Store {
  // users / tokens
  upsertUser(user: Omit<User, 'created_at' | 'plan'> & Partial<Pick<User, 'plan'>>): Promise<User>;
  getUser(id: string): Promise<User | null>;
  saveToken(token: Token): Promise<void>;
  getToken(userId: string): Promise<Token | null>;
  getTokensExpiringBefore(iso: string): Promise<Token[]>;

  // posts / insights
  upsertPosts(posts: Post[]): Promise<void>;
  getPosts(userId: string): Promise<Post[]>;
  saveInsights(insights: Insight[]): Promise<void>;
  getInsights(userId: string): Promise<Record<string, Insight>>;

  // dna (버전 히스토리 유지)
  saveDna(userId: string, dna: Dna): Promise<void>;
  getLatestDna(userId: string): Promise<Dna | null>;
  getDnaVersionCount(userId: string): Promise<number>;

  // ideas / drafts / records
  saveIdeas(ideas: Idea[]): Promise<void>;
  getRecentIdeas(userId: string, limit: number): Promise<Idea[]>;
  saveDraft(draft: Draft): Promise<void>;
  getDraft(userId: string, id: string): Promise<Draft | null>;
  getDrafts(userId: string): Promise<Draft[]>;
  saveRecord(record: RecordItem): Promise<void>;
  getRecords(userId: string): Promise<RecordItem[]>;

  // follower snapshots
  upsertSnapshot(snap: FollowerSnapshot): Promise<void>;
  getSnapshots(userId: string): Promise<FollowerSnapshot[]>;

  // sync progress (KV 대용)
  getSyncState(userId: string): Promise<SyncState | null>;
  saveSyncState(state: SyncState): Promise<void>;

  // AI 호출 한도
  getAiUsage(userId: string, date: string): Promise<AiUsage>;
  incrAiUsage(userId: string, date: string): Promise<number>;
}

let store: Store | null = null;

export async function getStore(): Promise<Store> {
  if (store) return store;
  if (isFileDb()) {
    const { FileStore } = await import('./file-store');
    store = new FileStore();
  } else {
    const { PgStore } = await import('./pg-store');
    const pg = new PgStore();
    await pg.ensureSchema();
    store = pg;
  }
  return store;
}
