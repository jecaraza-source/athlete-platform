import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Run tests in Node.js — no browser DOM needed for server-side auth logic
    environment: 'node',
    // Inject describe/it/expect/vi globals so we don't import them everywhere
    globals: true,
    // Isolate each test file in its own module scope so vi.mock state never leaks
    isolate: true,
  },
});
