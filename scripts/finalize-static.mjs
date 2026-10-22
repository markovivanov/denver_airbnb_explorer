import { copyFile, mkdir, stat } from 'node:fs/promises';

// Vinext's trailingSlash redirect currently prevents nested pages from being
// prerendered. Keep its default routing and also provide directory indexes for
// the plain local static server. Missing exports must fail the build.
const output = new URL('../dist/client/', import.meta.url);
await stat(new URL('index.html', output));
await stat(new URL('explore.html', output));
await stat(new URL('explore.rsc', output));
await mkdir(new URL('explore/', output), { recursive: true });
await copyFile(new URL('explore.html', output), new URL('explore/index.html', output));
console.log('Local static routes ready: / and /explore/');
