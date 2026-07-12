import { getSessionUserId } from './session';
import { getStore } from './store';
import type { Token, User } from './types';

export async function getCurrentUser(): Promise<User | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const store = await getStore();
  return store.getUser(userId);
}

export async function getCurrentUserWithToken(): Promise<{ user: User; token: Token } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const store = await getStore();
  const token = await store.getToken(user.id);
  if (!token) return null;
  return { user, token };
}

export function unauthorized() {
  return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
}
