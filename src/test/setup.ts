/// <reference types="vitest/globals" />
import '@testing-library/jest-dom';

// Mock Firebase to avoid real network calls in tests
vi.mock('../firebase', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  db: {},
  default: {},
}));

// Mock import.meta.env for tests
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_FIREBASE_API_KEY: 'test-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'test-project',
    VITE_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123456',
    VITE_FIREBASE_APP_ID: '1:123456:web:abc',
    VITE_FIREBASE_DATABASE_ID: '(default)',
    VITE_MAIN_ADMIN_EMAIL: 'admin@test.com',
  },
  writable: true,
});
