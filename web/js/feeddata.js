// Посты ленты (демо: localStorage этого браузера). Общий модуль для ленты и чатов.

import { store, uid } from './core.js';

export const posts = {
  all() { return store.getJSON('feed', []); },
  get(id) { return this.all().find((p) => p.id === id) ?? null; },
  add(post) {
    const all = this.all();
    const p = { id: uid(), at: Date.now(), reactions: {}, comments: [], forwards: 0, ...post };
    all.unshift(p);
    store.setJSON('feed', all);
    return p;
  },
  update(id, fn) {
    const all = this.all();
    const p = all.find((x) => x.id === id);
    if (!p) return null;
    fn(p);
    store.setJSON('feed', all);
    return p;
  },
  remove(id) { store.setJSON('feed', this.all().filter((p) => p.id !== id)); },
};
