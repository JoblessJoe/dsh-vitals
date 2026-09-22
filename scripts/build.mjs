// Build dsh-vitals: host ESM + client CJS wrapped in the
// window.__ModuleLoader__ banner. Run with: node scripts/build.mjs
import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const lib = join(root, 'lib')
const pkgName = (await import(join(root, 'package.json'), { with: { type: 'json' } })).default.name

// Everything @deepseek-ai/* and react is provided by the dsh runtime (module
// table for the client, host DI for the host). Keep them external; esbuild
// inlines any third-party deps (there are none here).
const commonExternals = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react-dom/client',
]

await mkdir(lib, { recursive: true })

// --- host half: plain ESM, node platform -------------------------------
await build({
  entryPoints: [join(root, 'src/index.ts')],
  outfile: join(lib, 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: false,
  // host imports only node builtins (node:*) plus the ctx API; no runtime deps
  logLevel: 'silent',
})

// --- client half: CJS, browser platform, then banner -------------------
const clientOut = join(lib, 'client.cjs.tmp')
await build({
  entryPoints: [join(root, 'src/client/index.tsx')],
  outfile: clientOut,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2019',
  jsx: 'automatic', // emits require("react/jsx-runtime"); no React global needed
  sourcemap: false,
  external: [...commonExternals, '@deepseek-ai/*'],
  logLevel: 'silent',
})

const body = await readFile(clientOut, 'utf8')
const banner =
  `// dsh-vitals client bundle (esbuild CJS + __ModuleLoader__ banner). Do not edit.\n` +
  `window.__ModuleLoader__.load({id:"${pkgName}",factory:Pt=>{\n` +
  `var module={exports:{}},exports=module.exports,require=Pt;\n` +
  body +
  `\nreturn module.exports;\n` +
  `}});\n`
await writeFile(join(lib, 'client.js'), banner)
await import('node:fs').then(fs => fs.unlinkSync(clientOut))

console.log('built lib/index.js + lib/client.js for', pkgName)
