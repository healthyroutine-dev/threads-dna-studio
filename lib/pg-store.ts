// DATABASE_URL이 있을 때 쓰는 Postgres 저장소 (Vercel Postgres / Neon)
import { Pool } from 'pg';
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

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  threads_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  name TEXT,
  bio TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL DEFAULT '',
  timestamp TIMESTAMPTZ NOT NULL,
  media_type TEXT NOT NULL DEFAULT '',
  permalink TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS posts_user_idx ON posts(user_id, timestamp DESC);
CREATE TABLE IF NOT EXISTS insights (
  post_id TEXT PRIMARY KEY REFERENCES posts(id),
  views INT NOT NULL DEFAULT 0,
  likes INT NOT NULL DEFAULT 0,
  replies INT NOT NULL DEFAULT 0,
  reposts INT NOT NULL DEFAULT 0,
  quotes INT NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dna (
  user_id TEXT NOT NULL REFERENCES users(id),
  version INT NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (user_id, version)
);
CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  topic TEXT NOT NULL,
  axis TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  permalink TEXT
);
CREATE TABLE IF NOT EXISTS follower_snapshots (
  user_id TEXT NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  followers_count INT NOT NULL,
  views INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
CREATE TABLE IF NOT EXISTS sync_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
`;

export class PgStore implements Store {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });
  private ready = false;

  async ensureSchema(): Promise<void> {
    if (this.ready) return;
    await this.pool.query(SCHEMA);
    this.ready = true;
  }

  async upsertUser(user: Omit<User, 'created_at' | 'plan'> & Partial<Pick<User, 'plan'>>): Promise<User> {
    const { rows } = await this.pool.query(
      `INSERT INTO users (id, threads_user_id, username, name, bio)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET username=$3, name=$4, bio=$5
       RETURNING *`,
      [user.id, user.threads_user_id, user.username, user.name ?? null, user.bio ?? null]
    );
    const r = rows[0];
    return { ...r, created_at: r.created_at.toISOString() };
  }

  async getUser(id: string): Promise<User | null> {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE id=$1', [id]);
    if (!rows[0]) return null;
    return { ...rows[0], created_at: rows[0].created_at.toISOString() };
  }

  async saveToken(token: Token): Promise<void> {
    await this.pool.query(
      `INSERT INTO tokens (user_id, access_token, expires_at) VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET access_token=$2, expires_at=$3`,
      [token.user_id, token.access_token, token.expires_at]
    );
  }

  async getToken(userId: string): Promise<Token | null> {
    const { rows } = await this.pool.query('SELECT * FROM tokens WHERE user_id=$1', [userId]);
    if (!rows[0]) return null;
    return { ...rows[0], expires_at: rows[0].expires_at.toISOString() };
  }

  async upsertPosts(posts: Post[]): Promise<void> {
    for (const p of posts) {
      await this.pool.query(
        `INSERT INTO posts (id, user_id, text, timestamp, media_type, permalink)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET text=$3, media_type=$5, permalink=$6`,
        [p.id, p.user_id, p.text, p.timestamp, p.media_type, p.permalink]
      );
    }
  }

  async getPosts(userId: string): Promise<Post[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM posts WHERE user_id=$1 ORDER BY timestamp DESC',
      [userId]
    );
    return rows.map((r) => ({ ...r, timestamp: r.timestamp.toISOString() }));
  }

  async saveInsights(insights: Insight[]): Promise<void> {
    for (const i of insights) {
      await this.pool.query(
        `INSERT INTO insights (post_id, views, likes, replies, reposts, quotes, fetched_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (post_id) DO UPDATE SET views=$2, likes=$3, replies=$4, reposts=$5, quotes=$6, fetched_at=$7`,
        [i.post_id, i.views, i.likes, i.replies, i.reposts, i.quotes, i.fetched_at]
      );
    }
  }

  async getInsights(userId: string): Promise<Record<string, Insight>> {
    const { rows } = await this.pool.query(
      `SELECT i.* FROM insights i JOIN posts p ON p.id=i.post_id WHERE p.user_id=$1`,
      [userId]
    );
    const out: Record<string, Insight> = {};
    for (const r of rows) out[r.post_id] = { ...r, fetched_at: r.fetched_at.toISOString() };
    return out;
  }

  async saveDna(userId: string, dna: Dna): Promise<void> {
    await this.pool.query(
      `INSERT INTO dna (user_id, version, data) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, version) DO UPDATE SET data=$3`,
      [userId, dna.version, JSON.stringify(dna)]
    );
  }

  async getLatestDna(userId: string): Promise<Dna | null> {
    const { rows } = await this.pool.query(
      'SELECT data FROM dna WHERE user_id=$1 ORDER BY version DESC LIMIT 1',
      [userId]
    );
    return rows[0]?.data ?? null;
  }

  async getDnaVersionCount(userId: string): Promise<number> {
    const { rows } = await this.pool.query('SELECT COUNT(*)::int AS c FROM dna WHERE user_id=$1', [userId]);
    return rows[0]?.c ?? 0;
  }

  async saveIdeas(ideas: Idea[]): Promise<void> {
    for (const i of ideas) {
      await this.pool.query(
        `INSERT INTO ideas (id, user_id, topic, axis, direction, created_at) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [i.id, i.user_id, i.topic, i.axis, i.direction, i.created_at]
      );
    }
  }

  async getRecentIdeas(userId: string, limit: number): Promise<Idea[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM ideas WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }));
  }

  async saveDraft(draft: Draft): Promise<void> {
    await this.pool.query(
      `INSERT INTO drafts (id, user_id, data, updated_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET data=$3, updated_at=$4`,
      [draft.id, draft.user_id, JSON.stringify(draft), draft.updated_at]
    );
  }

  async getDraft(userId: string, id: string): Promise<Draft | null> {
    const { rows } = await this.pool.query('SELECT data FROM drafts WHERE id=$1 AND user_id=$2', [id, userId]);
    return rows[0]?.data ?? null;
  }

  async getDrafts(userId: string): Promise<Draft[]> {
    const { rows } = await this.pool.query(
      'SELECT data FROM drafts WHERE user_id=$1 ORDER BY updated_at DESC',
      [userId]
    );
    return rows.map((r) => r.data);
  }

  async saveRecord(record: RecordItem): Promise<void> {
    await this.pool.query(
      `INSERT INTO records (id, user_id, text, published_at, permalink) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO NOTHING`,
      [record.id, record.user_id, record.text, record.published_at, record.permalink ?? null]
    );
  }

  async getRecords(userId: string): Promise<RecordItem[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM records WHERE user_id=$1 ORDER BY published_at DESC',
      [userId]
    );
    return rows.map((r) => ({ ...r, published_at: r.published_at.toISOString() }));
  }

  async upsertSnapshot(snap: FollowerSnapshot): Promise<void> {
    await this.pool.query(
      `INSERT INTO follower_snapshots (user_id, date, followers_count, views) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, date) DO UPDATE SET followers_count=$3, views=$4`,
      [snap.user_id, snap.date, snap.followers_count, snap.views]
    );
  }

  async getSnapshots(userId: string): Promise<FollowerSnapshot[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM follower_snapshots WHERE user_id=$1 ORDER BY date ASC',
      [userId]
    );
    return rows.map((r) => ({
      ...r,
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
    }));
  }

  async getSyncState(userId: string): Promise<SyncState | null> {
    const { rows } = await this.pool.query('SELECT data FROM sync_state WHERE user_id=$1', [userId]);
    return rows[0]?.data ?? null;
  }

  async saveSyncState(state: SyncState): Promise<void> {
    await this.pool.query(
      `INSERT INTO sync_state (user_id, data) VALUES ($1,$2)
       ON CONFLICT (user_id) DO UPDATE SET data=$2`,
      [state.user_id, JSON.stringify(state)]
    );
  }

  async getAiUsage(userId: string, date: string): Promise<AiUsage> {
    const { rows } = await this.pool.query(
      'SELECT count FROM ai_usage WHERE user_id=$1 AND date=$2',
      [userId, date]
    );
    return { user_id: userId, date, count: rows[0]?.count ?? 0 };
  }

  async incrAiUsage(userId: string, date: string): Promise<number> {
    const { rows } = await this.pool.query(
      `INSERT INTO ai_usage (user_id, date, count) VALUES ($1,$2,1)
       ON CONFLICT (user_id, date) DO UPDATE SET count = ai_usage.count + 1
       RETURNING count`,
      [userId, date]
    );
    return rows[0].count;
  }
}
