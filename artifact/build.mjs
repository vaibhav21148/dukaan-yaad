// Builds artifact/dist/dukaan-yaad.html: one self-contained page for publishing as a Claude Artifact.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const core = await build({ entryPoints: ['artifact/core.ts'], bundle: true, format: 'iife', globalName: 'DY', minify: true, target: 'es2020', write: false });
const css = readFileSync('src/styles.css', 'utf8') + '\n' + readFileSync('artifact/extra.css', 'utf8');
const app = readFileSync('artifact/app.js', 'utf8');
const page = `<title>Dukaan Yaad</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;500;600;700&family=Mukta+Vaani:wght@400;600&display=swap">
<style>
${css}
</style>
<div id="app"></div>
<script>
${core.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}
</script>
<script>
${app}
</script>
`;
mkdirSync('artifact/dist', { recursive: true });
writeFileSync('artifact/dist/dukaan-yaad.html', page);
console.log('artifact/dist/dukaan-yaad.html', Math.round(page.length / 1024), 'KB');
