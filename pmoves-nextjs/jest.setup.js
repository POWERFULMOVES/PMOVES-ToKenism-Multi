/**
 * Jest Setup File
 * Configures testing environment with proper mocks and global setup
 */

require('@testing-library/jest-dom');

// Mock IntersectionObserver for charts
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {
    this.callbacks = [];
  }
  
  observe() {
    // Simulate intersection observer behavior
    setTimeout(() => {
      this.callbacks.forEach(callback => callback());
    }, 100);
  }
  
  unobserve() {
    // No-op for testing
  }
  
  disconnect() {
    this.callbacks = [];
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  
  observe() {
    // Simulate resize observer behavior
    setTimeout(() => {
      this.callback();
    }, 100);
  }
  
  unobserve() {
    // No-op for testing
  }
  
  disconnect() {
    // No-op for testing
  }
};

// Mock window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Mock localStorage
if (typeof window !== 'undefined') {
  const localStorageMock = (() => {
    let store = {};
    
    return {
      getItem: jest.fn((key) => store[key] || null),
      setItem: jest.fn((key, value) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        store = {};
      }),
      key: jest.fn((index) => Object.keys(store)[index] || null),
      get length() {
        return Object.keys(store).length;
      },
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
}

// Mock console methods for cleaner test output
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Suppress console output in tests unless explicitly needed
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore console methods
  console.error = originalError;
  console.warn = originalWarn;
});

// Suppress ResizeObserver loop errors
if (typeof global.ResizeObserver !== 'undefined') {
  const originalResizeObserverError = global.ResizeObserver.prototype.observe;
  global.ResizeObserver.prototype.observe = jest.fn(function() {
    return originalResizeObserverError.call(this, arguments);
  });
}
