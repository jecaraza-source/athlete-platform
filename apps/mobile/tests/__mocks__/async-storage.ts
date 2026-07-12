// Minimal AsyncStorage stub for the Node test environment.
// The real module requires native modules unavailable in Node.
const store: Record<string, string> = {};

export default {
  getItem:    (key: string) => Promise.resolve(store[key] ?? null),
  setItem:    (key: string, value: string) => { store[key] = value; return Promise.resolve(); },
  removeItem: (key: string) => { delete store[key]; return Promise.resolve(); },
  clear:      () => { Object.keys(store).forEach((k) => delete store[k]); return Promise.resolve(); },
  getAllKeys:  () => Promise.resolve(Object.keys(store)),
};
