export interface User {
  id: string; // 내부 id = threads_user_id
  threads_user_id: string;
  username: string;
  name?: string;
  bio?: string;
  plan: 'free' | 'pro';
  created_at: string;
}

export interface Token {
  user_id: string;
  access_token: string;
  expires_at: string; // 장기 토큰(60일) 만료 시각
}

export interface Post {
  id: string; // Threads 미디어 id
  user_id: string;
  text: string;
  timestamp: string;
  media_type: string;
  permalink: string;
}

export interface Insight {
  post_id: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  fetched_at: string;
}

export interface WinningAxis {
  axis: string;
  evidence: string;
  tip: string;
}

export interface Dna {
  version: number;
  extracted_at: string;
  post_count_analyzed: number;
  identity: string;
  tone_rules: string[];
  signature_hook: string;
  winning_axes: WinningAxis[];
  weakness: string;
  style_anchors: string[];
  user_edits: Partial<Record<'identity' | 'tone_rules' | 'signature_hook' | 'winning_axes' | 'weakness' | 'style_anchors', unknown>>;
  provisional?: boolean; // 데이터 부족 모드(글 15개 미만)로 만든 임시 DNA
}

export interface Idea {
  id: string;
  user_id: string;
  topic: string;
  axis: string;
  direction: string;
  created_at: string;
}

export interface Prediction {
  score: number;
  expected: string; // 예상 반응(예상 좋아요 범위)
  strengths: string[];
  weaknesses: string[];
  improved: string; // 개선 버전 본문
}

export interface Draft {
  id: string;
  user_id: string;
  topic: string;
  axis: string;
  text: string;
  prediction: Prediction | null;
  prediction_stale: boolean;
  improved_applied: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecordItem {
  id: string;
  user_id: string;
  text: string;
  published_at: string;
  permalink?: string;
}

export interface FollowerSnapshot {
  user_id: string;
  date: string; // YYYY-MM-DD
  followers_count: number;
  views: number;
}

export interface SyncState {
  user_id: string;
  mode: 'all' | 'posts' | 'recent' | 'insights';
  status: 'idle' | 'running' | 'done' | 'error';
  phase: 'posts' | 'insights' | 'done';
  total: number;
  done: number;
  cursor: string | null; // 글 페이지네이션 커서
  insight_offset: number; // 통계 이어하기 위치
  message?: string;
  updated_at: string;
}

export interface AiUsage {
  user_id: string;
  date: string; // YYYY-MM-DD
  count: number;
}
