// Node 26 exposes an undefined global localStorage placeholder. Supply the
// browser Storage surface explicitly for jsdom tests.
const values = new Map<string, string>();
const localStorageMock: Storage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => [...values.keys()][index] ?? null,
  removeItem: (key) => { values.delete(key); },
  setItem: (key, value) => { values.set(key, String(value)); }
};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageMock
});
