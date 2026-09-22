# dsh-vitals

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) Web-GUI plugin that shows **live hardware load** right in the web GUI — a self-contained, dependency-free companion to `btop`. Opens as a full tab next to Chat/Trajectory, or docked beside a session in the right sidebar.

## What it shows

- **CPU** — overall utilisation, a live 60s sparkline, highest temperature reading, and per-core load (every physical core, any count) — with per-thermal-zone detail when there's more than one sensor
- **Memory** — used / available / total with utilisation %
- **GPUs** — one card each: name, temperature, utilisation, power draw, and VRAM (used / total)

Data is sampled host-side on every poll (~0.5 s) and rendered live.

## How it works

- **Host** — a `GET`-only route registered on the dsh web server
  (`/plugins/dsh-vitals/data`) that reads the OS's own sources
  with **no privileged access** and returns JSON.
- **Client** — a single self-contained bundle that polls the route and draws
  the panels with inline styles (no CSS pipeline, no assets).

### Where it shows up

Two access points, both live the moment the plugin is bundled — no setup:

- **A full `Hardware` tab** next to **Chat** / **Trajectory** at the top of
  the conversation view. The dedicated way to watch the box while you're not
  actively chatting.
- **Docked in the right sidebar**, alongside a session: open the right
  sidebar, click **+** (add tab), pick **Hardware** from the Guide list. Lets
  you chat and watch load at the same time. (Every dsh "page type" plugin
  opens this way — nothing dsh-vitals-specific about the click path.)

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

Not on the npm registry (yet) — install straight from GitHub. From your dsh
**web profile** (the pnpm workspace that backs your web GUI, e.g.
`~/.dsh/profiles/web/`):

```bash
pnpm add github:JoblessJoe/dsh-vitals
```

Then add it to the profile's bundle list so the host loads it:

```jsonc
// package.json
{
  "dependencies": { "dsh-vitals": "github:JoblessJoe/dsh-vitals" },
  "dsh": { "profile": { "bundles": [ /* …existing… */ "dsh-vitals" ] } }
}
```

The repo ships its built `lib/` output committed, so no build step runs on
install — `pnpm add` alone is enough.

Restart your dsh web service and open the web GUI — see
[Where it shows up](#where-it-shows-up) above for how to find it.

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
