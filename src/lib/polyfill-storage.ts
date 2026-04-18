// This file patches the environment to handle broken localStorage implementations
// in Node.js (SSR) environments, specifically addressing the "localStorage.getItem is not a function" error
// caused by experimental localStorage support in newer Node.js versions or misconfigured environments.

if (typeof window === 'undefined' && typeof global !== 'undefined') {
  try {
    // Check if localStorage is defined but broken (e.g. getItem is missing)
    // or simply define a mock for libraries that expect it to exist
    const isBroken = 
      typeof global.localStorage !== 'undefined' && 
      (typeof global.localStorage.getItem !== 'function');

    if (isBroken || typeof global.localStorage === 'undefined') {
      const storageMock = {
        getItem: (_key: string) => null,
        setItem: (_key: string, _value: string) => {},
        removeItem: (_key: string) => {},
        clear: () => {},
        length: 0,
        key: (_index: number) => null,
      };

      Object.defineProperty(global, 'localStorage', {
        value: storageMock,
        writable: true,
        configurable: true
      });
    }
  } catch (e) {
    // Ignore errors during polyfill
  }
}
