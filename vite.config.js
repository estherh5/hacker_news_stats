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
  ];

  return {
    name: 'copy-static-files',
    async closeBundle() {
      await mkdir(resolve(projectRoot, 'dist'), { recursive: true });
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
