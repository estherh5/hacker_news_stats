import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const projectRoot = import.meta.dirname;

function copyStaticFiles() {
  const files = [
    ['src/favicon.ico', 'dist/favicon.ico'],
    ['src/assets/humans.txt', 'dist/humans.txt'],
    ['src/assets/robots.txt', 'dist/robots.txt'],
    ['src/assets/sitemap.xml', 'dist/sitemap.xml'],
    // The manifest is emitted into assets/ and names its icons relatively
    ['src/icon-192.png', 'dist/assets/icon-192.png'],
    ['src/icon-512.png', 'dist/assets/icon-512.png'],
  ];

  return {
    name: 'copy-static-files',
    async closeBundle() {
      await mkdir(resolve(projectRoot, 'dist/assets'), { recursive: true });
      await Promise.all(
        files.map(([source, destination]) =>
          copyFile(
            resolve(projectRoot, source),
            resolve(projectRoot, destination),
          ),
        ),
      );
    },
  };
}

export default defineConfig({
  root: 'src',
  publicDir: false,
  plugins: [copyStaticFiles()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'all.min.js',
        assetFileNames: ({ names }) =>
          names?.some((name) => name.endsWith('.css'))
            ? 'style.min.css'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: {
    // Half the cores, not vitest's default of all-but-one: on 2026-10-26 parallel
    // suites across sessions pushed the 16GB Mac to 6.4/7.2GB swap and paged out
    // the always-on launchd servers. Fleet-wide cap; see vitals a331032.
    maxWorkers: "50%",
    root: projectRoot,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./setupFile.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
