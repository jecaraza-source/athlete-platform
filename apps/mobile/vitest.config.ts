import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // react-native-url-polyfill adds side effects at module load time that
      // break in Node. Since we mock @/lib/supabase entirely in tests, this
      // stub prevents the polyfill from loading in the test environment.
      'react-native-url-polyfill/auto': path.resolve(
        __dirname,
        'tests/__mocks__/url-polyfill.ts'
      ),
      // AsyncStorage requires native modules — stub it out for unit tests.
      '@react-native-async-storage/async-storage': path.resolve(
        __dirname,
        'tests/__mocks__/async-storage.ts'
      ),
    },
  },
  test: {
    // Run in Node — no DOM or native modules required for service/store tests.
    environment: 'node',
    // Inject describe/it/expect/vi globals so imports aren't needed everywhere.
    globals: true,
    // Isolate each file so vi.mock state never leaks between test files.
    isolate: true,
  },
});
