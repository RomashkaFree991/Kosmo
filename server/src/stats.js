// Статистика сервиса — только для аккаунта с ID 1 (владелец / официальный Kosmo).
// Содержимое зашифрованных чатов сервер не видит: по ним только счётчики.

import { sql, users, chats, posts, stories } from './db.js';
import { connectedUsers } from './realtime.js';
import { ApiError } from './auth.js';

const sealed = (s) => typeof s === 'string' && s.startsWith('e1:');
const DAY = 86_400_000;

export function assertStatsAccess(uid) {
  if (String(users.get(uid)?.publicId) !== '1') throw new ApiError(403, 'forbidden', 'Only ID 1 can see statistics');
}

function countReactions(map, into) {
  let n = 0;
  for (const [k, list] of Object.entries(map ?? {})) {
    const c = Array.isArray(list) ? list.length : 0;
    n += c;
    into.set(k, (into.get(k) ?? 0) + c);
  }
  return n;
}

export function serviceStats() {
  const now = Date.now();
  const all = users.all();
  const byId = new Map(all.map((u) => [u.id, u]));
  const pid = (id) => byId.get(id)?.publicId ?? '';
  const online = new Set(connectedUsers());
  const lastActive = new Map(sql.prepare('SELECT user_id, MAX(last_active) AS t, COUNT(*) AS n FROM sessions GROUP BY user_id').all().map((r) => [r.user_id, { t: r.t, n: r.n }]));
  const people = all.filter((u) => !u.bot);
  const reactTop = new Map();

  const list = chats.all();
  const kinds = { dm: 0, secret: 0, saved: 0, group: 0, channel: 0, publicRooms: 0 };
  let messages = 0;
  let encrypted = 0;
  let msgReactions = 0;
  const msgsToday = { n: 0 };
  const rooms = [];
  for (const c of list) {
    const msgs = c.messages ?? [];
    messages += msgs.length;
    for (const m of msgs) {
      if (sealed(m.text) || m.mk) encrypted++;
      if (m.at > now - DAY) msgsToday.n++;
      msgReactions += countReactions(m.reactions, reactTop);
    }
    if (c.type === 'group' || c.type === 'channel') {
      kinds[c.type]++;
      if (c.username) kinds.publicRooms++;
      rooms.push({
        type: c.type,
        name: sealed(c.name) ? null : String(c.name ?? ''),
        username: c.username ?? '',
        members: (c.members ?? []).length,
        messages: msgs.length,
        owner: pid(c.owner),
        createdAt: c.createdAt ?? msgs[0]?.at ?? null,
      });
    } else if (c.saved || c.id.startsWith('saved_')) kinds.saved++;
    else if (c.id.startsWith('secret_')) kinds.secret++;
    else kinds.dm++;
  }

  const feed = posts.all();
  let postReactions = 0;
  let comments = 0;
  for (const p of feed) {
    postReactions += countReactions(p.reactions, reactTop);
    comments += (p.comments ?? []).length;
    for (const cm of p.comments ?? []) postReactions += countReactions(cm.reactions, reactTop);
  }
  const media = sql.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS s FROM media').get();

  return {
    at: now,
    totals: {
      users: people.length,
      bots: all.length - people.length,
      newToday: people.filter((u) => u.createdAt > now - DAY).length,
      newWeek: people.filter((u) => u.createdAt > now - 7 * DAY).length,
      online: people.filter((u) => online.has(u.id)).length,
      activeToday: people.filter((u) => (lastActive.get(u.id)?.t ?? 0) > now - DAY).length,
      premium: people.filter((u) => u.premium).length,
      withUsername: people.filter((u) => u.username).length,
      sessions: sql.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,
      chats: list.length,
      ...kinds,
      messages,
      messagesToday: msgsToday.n,
      encrypted,
      reactions: msgReactions + postReactions,
      posts: feed.length,
      comments,
      stories: stories.all().filter((s) => (s.at ?? 0) > now - DAY).length,
      files: media.n,
      filesSize: media.s,
    },
    topReactions: [...reactTop.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([key, n]) => ({ key, n })),
    users: all
      .map((u) => ({
        publicId: u.publicId ?? '',
        name: String(u.name ?? ''),
        username: u.username ?? '',
        email: u.email ?? '',
        bot: Boolean(u.bot),
        premium: Boolean(u.premium),
        official: Boolean(u.official),
        createdAt: u.createdAt ?? null,
        lastActive: lastActive.get(u.id)?.t ?? null,
        sessions: lastActive.get(u.id)?.n ?? 0,
        online: online.has(u.id),
      }))
      .sort((a, b) => Number(a.publicId) - Number(b.publicId)),
    rooms: rooms.sort((a, b) => b.members - a.members),
  };
}
