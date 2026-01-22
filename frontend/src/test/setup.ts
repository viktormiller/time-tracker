import '@testing-library/jest-dom';

// Mock localStorage with actual storage
const storage = new Map<string, string>();

const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) || null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() { return storage.size; },
  key: vi.fn((index: number) => Array.from(storage.keys())[index] || null),
};

global.localStorage = localStorageMock as any;
