import { defineConfig, type Plugin } from 'vite';

// Inline the bundled JS and CSS into index.html. The page is tiny, so this saves
// two requests, avoids a flash of unstyled content, and lets dist/index.html
// work when opened straight from disk (file:// blocks external module scripts).
const inlineAssets = (): Plugin => ({
  name: 'inline-assets',
  enforce: 'post',
  generateBundle(_, bundle) {
    const page = bundle['index.html'];
    if (page.type !== 'asset') return;
    let html = String(page.source);

    for (const [name, file] of Object.entries(bundle)) {
      const base = name.split('/').pop()!;
      const tag = (open: string, close: string) =>
        new RegExp(`${open}[^>]*${base.replace('.', '\\.')}"[^>]*${close}`);
      if (file.type === 'chunk') {
        html = html.replace(tag('<script[^>]*src="[^"]*', '></script>'), () =>
          `<script type="module">${file.code}</script>`);
        delete bundle[name];
      } else if (name.endsWith('.css')) {
        html = html.replace(tag('<link[^>]*href="[^"]*', '>'), () =>
          `<style>${file.source}</style>`);
        delete bundle[name];
      }
    }
    page.source = html;
  },
});

// Relative base so the build works on GitHub Pages project sites (user.github.io/repo/)
export default defineConfig({
  base: './',
  plugins: [inlineAssets()],
  build: { modulePreload: false },
});
