# dsh-vitals

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) Web-GUI plugin that shows **live hardware load** in a dedicated right-sidebar tab — a self-contained, dependency-free companion to `btop`.

## What it shows

- **CPU** — overall utilisation, a live sparkline, and per-core load (every physical core, any count)
- **Memory** — used / available / total with utilisation %
- **CPU temperature** — highest reading plus per-thermal-zone values
- **GPUs** — one card each: name, temperature, utilisation, power draw, and VRAM (used / total)

Data is sampled host-side on every poll (~1 s) and rendered live in the tab.

## How it works

- **Host** — a `GET`-only route registered on the dsh web server
  (`/plugins/dsh-vitals/data`) that reads the OS's own sources
  with **no privileged access** and returns JSON.
- **Client** — a single self-contained bundle that polls the route and draws
  the panels with inline styles (no CSS pipeline, no assets).

### Platform support

| Signal | Primary source | Fallback |
| ------ | -------------- | -------- |
| CPU load | `/proc/stat` (Linux) | `os.cpus()` deltas (macOS / other) |
| Memory | `/proc/meminfo` (Linux) | `os.totalmem()` / `os.freemem()` |
| CPU temp | `/sys/class/thermal` | hidden when absent |
| GPUs | `nvidia-smi` (any count) | hidden when absent |

Everything degrades gracefully: a missing source simply hides that panel or
shows a placeholder rather than breaking the tab. Any number of GPUs is
supported; any CPU (core count and vendor) is handled.

## Install

The plugin ships as an npm package. From your dsh **web profile** (the pnpm
workspace that backs your web GUI, e.g. `~/.dsh/profiles/web/`):

```bash
pnpm add dsh-vitals
```

Then add it to the profile's bundle list so the host loads it:

```jsonc
// package.json
{
  "dependencies": { "dsh-vitals": "^0.1.0" },
  "dsh": { "profile": { "bundles": [ /* …existing… */ "dsh-vitals" ] } }
}
```

Restart your dsh web service and open the web GUI — the **Hardware** tab appears
in the right sidebar.

> New bundles are registered from the profile's `bundles` array, so a one-time
> service restart is required the first time you add it.

## Building from source

Requires Node 20+. Dependencies are dev-only (esbuild); the published package
has **zero runtime npm dependencies**.

```bash
git clone https://github.com/JoblessJoe/dsh-vitals.git
cd dsh-vitals
pnpm install
node scripts/build.mjs     # emits lib/index.js + lib/client.js
```

`package.json` declares a `build` script, so `pnpm build` works too.

## Configuration

None. The plugin reads whatever the host exposes; there is no config surface.

## Security

The data route sits outside the dsh web server's `/api` trust fence, so it
enforces that fence itself: `Sec-Fetch-Site: cross-site` requests are rejected
(403) and only `GET`/`HEAD` are served (405 otherwise). All sources are read-only.

## License

MIT
