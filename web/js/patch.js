// Патчи синхронизации — общий код для браузера и сервера.
// Коллекции: accounts (объект id → пользователь), chats (объект id → чат
// с массивом messages), feed и stories (массивы по id).
// Патч: { col, id, op: 'put' | 'del', set?, unset?, msgs?: { up, del }, replace? }

export const COLLECTIONS = ['accounts', 'chats', 'feed', 'stories'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- Разница между двумя версиями документа ---------- */
export function diffDoc(col, prev, next) {
  if (!next) return prev ? { col, id: prev.id, op: 'del' } : null;
  const set = {};
  const unset = [];
  for (const k of Object.keys(next)) {
    if (col === 'chats' && k === 'messages') continue;
    if (!prev || !same(prev[k], next[k])) set[k] = next[k];
  }
  if (prev) for (const k of Object.keys(prev)) if (!(k in next) && !(col === 'chats' && k === 'messages')) unset.push(k);
  const patch = { col, id: next.id, op: 'put' };
  if (Object.keys(set).length) patch.set = set;
  if (unset.length) patch.unset = unset;
  if (col === 'chats') {
    const before = new Map((prev?.messages ?? []).map((m) => [m.id, m]));
    const after = new Set();
    const up = [];
    for (const m of next.messages ?? []) {
      after.add(m.id);
      const old = before.get(m.id);
      if (!old || !same(old, m)) up.push(m);
    }
    const del = [...before.keys()].filter((id) => !after.has(id));
    if (up.length || del.length) patch.msgs = { ...(up.length ? { up } : {}), ...(del.length ? { del } : {}) };
  }
  return patch.set || patch.unset || patch.msgs ? patch : null;
}

// Все изменения коллекции целиком
export function diffCollection(col, prevValue, nextValue) {
  const toMap = (v) => (Array.isArray(v) ? new Map(v.map((d) => [d.id, d])) : new Map(Object.entries(v ?? {})));
  const a = toMap(prevValue);
  const b = toMap(nextValue);
  const out = [];
  for (const [id, doc] of b) {
    const p = diffDoc(col, a.get(id), doc);
    if (p) out.push(p);
  }
  for (const [id, doc] of a) if (!b.has(id)) out.push({ col, id, op: 'del' });
  return out;
}

/* ---------- Применить патч к одному документу ---------- */
export function applyToDoc(col, doc, patch) {
  if (patch.op === 'del') return null;
  let d = patch.replace ? { id: patch.id } : { ...(doc ?? { id: patch.id }) };
  if (col === 'chats') d.messages = patch.replace ? [] : [...(doc?.messages ?? [])];
  if (patch.set) Object.assign(d, patch.set);
  for (const k of patch.unset ?? []) delete d[k];
  if (col === 'chats') {
    if (patch.replace && patch.set?.messages) d.messages = patch.set.messages;
    if (patch.msgs?.up?.length) {
      const idx = new Map(d.messages.map((m, i) => [m.id, i]));
      for (const m of patch.msgs.up) {
        if (idx.has(m.id)) d.messages[idx.get(m.id)] = m;
        else { idx.set(m.id, d.messages.length); d.messages.push(m); }
      }
      d.messages.sort((a, b) => a.at - b.at);
    }
    if (patch.msgs?.del?.length) {
      const del = new Set(patch.msgs.del);
      d.messages = d.messages.filter((m) => !del.has(m.id));
    }
  }
  d.id = patch.id;
  return d;
}

/* ---------- Применить патч к коллекции (значению из хранилища) ---------- */
export function applyToCollection(col, value, patch) {
  if (col === 'feed' || col === 'stories') {
    const list = [...(value ?? [])];
    const i = list.findIndex((x) => x.id === patch.id);
    const next = applyToDoc(col, i >= 0 ? list[i] : null, patch);
    if (i >= 0) list.splice(i, 1);
    if (next) list.push(next);
    return col === 'feed' ? list.sort((a, b) => b.at - a.at) : list.sort((a, b) => a.at - b.at);
  }
  const map = { ...(value ?? {}) };
  const next = applyToDoc(col, map[patch.id], patch);
  if (next) map[patch.id] = next;
  else delete map[patch.id];
  return map;
}
