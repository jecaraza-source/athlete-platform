import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // "server-only" throws when imported outside a Next.js Server Component
      // context. In the Vitest Node environment we replace it with an empty
      // stub so server-side utilities can be imported freely in unit tests.
      'server-only': path.resolve(__dirname, 'tests/__mocks__/server-only.ts'),
    },
  },
  test: {
    // Run tests in Node.js — no browser DOM needed for server-side auth logic
    environment: 'node',
    // Inject describe/it/expect/vi globals so we don't import them everywhere
    globals: true,
    // Isolate each test file in its own module scope so vi.mock state never leaks
    isolate: true,
  },
});
