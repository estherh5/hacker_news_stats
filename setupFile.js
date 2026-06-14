import { readFileSync } from 'node:fs';

const html = readFileSync('src/index.html', 'utf8');

document.documentElement.innerHTML = html;
window.open = vi.fn();
