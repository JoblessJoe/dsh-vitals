<p align="center">
  <img src="https://raw.githubusercontent.com/JoblessJoe/dsh-vitals/main/.github/assets/banner.svg" alt="dsh-vitals: live CPU, memory, temperature and GPU load inside the DeepSeek Harness web GUI" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-vitals"><img src="https://img.shields.io/npm/v/dsh-vitals?color=34d399&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/dsh-vitals"><img src="https://img.shields.io/npm/dm/dsh-vitals?color=34d399" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/dependencies-0-34d399" alt="zero runtime dependencies">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/JoblessJoe/dsh-vitals?color=34d399" alt="MIT license"></a>
  <a href="https://github.com/awesome-dsh-plugin/awesome-dsh-plugin"><img src="https://img.shields.io/badge/awesome-dsh--plugin-fc60a8" alt="listed on awesome-dsh-plugin"></a>
</p>

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) web GUI plugin that shows **live hardware load** right where you work: a self-contained, dependency-free companion to `btop`. Watch your GPU while your local model thinks, without leaving the chat.

```bash
dsh plugin --profile web add dsh-vitals
```

Restart dsh: CPU and GPU load appear in the session header, and the full **Hardware** tab sits next to Chat / Trajectory. Full details under [Install](#install).

<p align="center">
  <img src="https://raw.githubusercontent.com/JoblessJoe/dsh-vitals/main/.github/assets/hardware-tab.png" alt="The Hardware tab: per-core CPU load, memory and two GPUs" width="100%">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/JoblessJoe/dsh-vitals/main/.github/assets/header-widget.png" alt="Mini CPU and GPU load widget in the session header" width="520">
  <br><sub>The mini widget in the session header: always visible while you chat. Click it to jump to the full Hardware tab.</sub>
</p>

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

- **A mini widget in the session header**, next to the "⋯" menu: CPU and
  per-GPU load as tiny bars, always visible while you chat. Hover for temps
  and VRAM; click to jump to the full tab.
- **A full `Hardware` tab** next to **Chat** / **Trajectory** at the top of
  the conversation view: per-core CPU, memory, temperatures and every GPU.

### Platform support

Linux, macOS and Windows. Each signal uses the best unprivileged source the OS
offers and hides itself when there is none:

| Signal | Linux | macOS | Windows |
| ------ | ----- | ----- | ------- |
| CPU load (overall + per core) | `/proc/stat` | `os.cpus()` | `os.cpus()` |
| Memory | `/proc/meminfo` | `vm_stat` (counts cache as available, like Activity Monitor) | `os.freemem()` |
| CPU temperature | `/sys/class/thermal` | hidden (needs root) | WMI thermal zones, when the board exposes them |
| NVIDIA GPUs | `nvidia-smi` | `nvidia-smi` | `nvidia-smi.exe` (PATH or `NVSMI` folder) |
| Apple / other GPUs | — | `ioreg` utilisation + memory in use | — |

Everything degrades gracefully: a missing source hides that panel or shows a
placeholder instead of breaking the tab. Any number of GPUs and any CPU core
count is supported.

## Install

From your dsh **web profile** (`web` below is the profile name; use whichever
profile backs your web GUI):

```bash
dsh plugin --profile web add dsh-vitals
```

This installs the package into the profile and adds it to
`dsh.profile.bundles` for you — no manual `package.json` editing. (No local
`dsh` binary? Run the equivalent by hand from the profile directory, e.g.
`~/.dsh/profiles/web/`: `pnpm add dsh-vitals`, then add `"dsh-vitals"` to
that `package.json`'s `dsh.profile.bundles` array yourself.)

The published package ships its built `lib/` output, so no build step runs
on install — nothing else to do before restarting.

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
