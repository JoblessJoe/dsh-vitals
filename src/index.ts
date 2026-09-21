// dsh-hardware-monitor — host half.
//
// Registers a GET-only route on the dsh web server that reports live hardware
// load, polled by the client tab at ~1s. Reads /proc and /sys (no privileged
// access) and, when present, `nvidia-smi` for per-GPU figures. The CPU sampler
// keeps the previous /proc/stat sample in memory so each poll returns deltas.
//
// This file only touches the ctx API + Node builtins — no dsh runtime packages.

import { readdirSync, readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { cpus, freemem, loadavg, totalmem } from 'node:os'
import type { ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
// Type-only imports carry the webServer Context merge; erased at build.
import type {} from '@deepseek-ai/dsh-host-webserver'

export const inject = ['webServer']

// --- wire types (mirrored by the client) -------------------------------
export interface CpuStat { total: number; cores: number[]; model: string | null }
export interface MemStat { totalKb: number; availKb: number; usedKb: number; usedPct: number }
export interface TempStat { overall: number | null; zones: { name: string; temp: number }[] }
export interface GpuStat {
  index: number; name: string; temp: number | null; util: number | null
  powerW: number | null; memUsedMb: number | null; memTotalMb: number | null
}
export interface HwData {
  ok: true
  ts: number
  cpu: CpuStat
  mem: MemStat
  temp: TempStat
  gpus: GpuStat[]
  gpuError: string | null
  errors: string[]
}

// --- /proc parsing -----------------------------------------------------
// A /proc/stat "cpu" line: cpu user nice system idle iowait irq softirq steal ...
// Jiffies are already absolute since boot; load = 1 - dIdle/dTotal across all fields.
interface StatSample { cores: number[][] } // [core][user,nice,system,idle,iowait,irq,softirq,steal]

function parseStat(raw: string): StatSample {
  const cores: number[][] = []
  for (const line of raw.split('\n')) {
    if (!line.startsWith('cpu')) break
    const f = line.trim().split(/\s+/).slice(1).map(Number)
    if (f.some(Number.isNaN)) continue
    cores.push(f)
  }
  return { cores }
}

function pct(prev: number[], now: number[]): number {
  const dTotal = now.reduce((a, b, i) => a + (b - (prev[i] ?? b)), 0)
  const idle = (now[3] ?? 0) - (prev[3] ?? now[3] ?? 0)
  if (dTotal <= 0) return 0
  return Math.max(0, Math.min(100, (1 - idle / dTotal) * 100))
}

let prevStat: StatSample | null = null
let prevCpuTimes: { total: number[]; idle: number[] } | null = null
let cpuModel: string | null = null

/** CPU model string; Linux /proc/cpuinfo, else node:os. */
function cpuModelOnce(): string | null {
  if (cpuModel !== null) return cpuModel
  try {
    const m = readFileSync('/proc/cpuinfo', 'utf8').match(/model name\s*:\s*(.+)/)
    if (m) { cpuModel = m[1].trim(); return cpuModel }
  } catch { /* not Linux */ }
  try { cpuModel = cpus()[0]?.model ?? null } catch { cpuModel = null }
  return cpuModel
}

/** One core's busy fraction between two node:os snapshots (ms). */
function corePct(prev: number[] | undefined, now: number[]): number {
  if (!prev) return 0
  const dTotal = now.reduce((a, b, i) => a + (b - (prev[i] ?? b)), 0)
  const dIdle = (now[4] ?? 0) - (prev[4] ?? 0)
  if (dTotal <= 0) return 0
  return Math.max(0, Math.min(100, (1 - dIdle / dTotal) * 100))
}

/**
 * CPU: Linux reads /proc/stat (jiffies deltas, per-core + aggregate); other
 * platforms fall back to node:os cpuTimes() deltas. Either way cores[0] is
 * the first physical core, never the aggregate.
 */
function sampleCpu(): CpuStat {
  try {
    const now = parseStat(readFileSync('/proc/stat', 'utf8'))
    const total = pct(prevStat?.cores[0] ?? now.cores[0], now.cores[0])
    const cores = now.cores.slice(1).map((c, i) => pct(prevStat?.cores[i + 1] ?? c, c))
    prevStat = now
    return { total, cores, model: cpuModelOnce() }
  } catch {
    // Non-Linux fallback: node:os per-core time deltas.
    const now = cpus().map(c => {
      const t = [c.user, c.nice, c.sys, c.idle, c.irq]
      return { t, idle: t[3] }
    })
    const prev = prevCpuTimes
    const cores = now.map((c, i) => corePct(prev?.total[i], c.t))
    const total = cores.length ? cores.reduce((a, b) => a + b, 0) / cores.length : 0
    prevCpuTimes = { total: now.map(c => c.t), idle: now.map(c => c.idle) }
    return { total, cores, model: cpuModelOnce() }
  }
}

/** Memory: Linux /proc/meminfo, else node:os total/free. */
function sampleMem(): MemStat {
  let totalKb: number | null = null, availKb: number | null = null
  try {
    const g: Record<string, number> = {}
    for (const line of readFileSync('/proc/meminfo', 'utf8').split('\n')) {
      const m = line.match(/^(\w+):\s+(\d+)\s*kB/)
      if (m) g[m[1]] = Number(m[2])
    }
    totalKb = g.MemTotal ?? null
    availKb = g.MemAvailable ?? (g.MemFree ?? 0) + (g.Buffers ?? 0) + (g.Cached ?? 0)
  } catch {
    const t = totalmem(), f = freemem()
    totalKb = Math.round(t / 1024)
    availKb = Math.round(f / 1024)
  }
  if (totalKb == null || totalKb <= 0 || availKb == null) {
    return { totalKb: 0, availKb: 0, usedKb: 0, usedPct: 0 }
  }
  const usedKb = Math.max(0, totalKb - availKb)
  const usedPct = Math.min(100, (usedKb / totalKb) * 100)
  return { totalKb, availKb, usedKb, usedPct }
}

// --- temperatures ------------------------------------------------------
async function sampleTemp(): Promise<TempStat> {
  const zones: { name: string; temp: number }[] = []
  try {
    for (const z of readdirSync('/sys/class/thermal')) {
      if (!z.startsWith('thermal_zone')) continue
      try {
        const type = readFileSync(`/sys/class/thermal/${z}/type`, 'utf8').trim()
        const raw = Number(readFileSync(`/sys/class/thermal/${z}/temp`, 'utf8').trim())
        if (!Number.isFinite(raw)) continue
        // Most zones report millidegrees; some report 1/10 deg or deg. Heuristic.
        const temp = raw > 10000 ? raw / 1000 : raw / 100
        if (temp < 0 || temp > 200) continue
        zones.push({ name: type || z, temp: Math.round(temp * 10) / 10 })
      } catch { /* skip unreadable zone */ }
    }
  } catch { /* no thermal sysfs */ }
  const overall = zones.length ? Math.max(...zones.map(z => z.temp)) : null
  return { overall, zones }
}

// --- GPUs (nvidia-smi) -------------------------------------------------
function nvidiaSmi(): Promise<string | null> {
  return new Promise(resolve => {
    const args = [
      '--query-gpu=index,name,temperature.gpu,utilization.gpu,power.draw,memory.used,memory.total',
      '--format=csv,noheader,nounits',
    ]
    execFile('nvidia-smi', args, { timeout: 800 }, (err, stdout) => {
      if (err) { resolve(null); return }
      resolve(stdout.trim())
    })
  })
}

async function sampleGpus(): Promise<{ gpus: GpuStat[]; gpuError: string | null }> {
  const out = await nvidiaSmi()
  if (out === null || out.length === 0) return { gpus: [], gpuError: null }
  const gpus: GpuStat[] = []
  for (const line of out.split('\n')) {
    const [index, name, temp, util, power, memUsed, memTotal] = line.split(',').map(s => s.trim())
    const num = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : null }
    gpus.push({
      index: num(index) ?? 0,
      name,
      temp: num(temp),
      util: num(util),
      powerW: num(power),
      memUsedMb: num(memUsed),
      memTotalMb: num(memTotal),
    })
  }
  return { gpus, gpuError: null }
}

async function sample(): Promise<HwData> {
  const errors: string[] = []
  let cpu: CpuStat | undefined, mem: MemStat | undefined
  let temp: TempStat | undefined
  let gpus: GpuStat[] = [], gpuError: string | null = null
  try { cpu = sampleCpu() } catch (e) { errors.push(`cpu: ${(e as Error).message}`) }
  try { mem = sampleMem() } catch (e) { errors.push(`mem: ${(e as Error).message}`) }
  try { temp = await sampleTemp() } catch (e) { errors.push(`temp: ${(e as Error).message}`) }
  try { ({ gpus, gpuError } = await sampleGpus()) } catch (e) { gpuError = (e as Error).message }
  return {
    ok: true,
    ts: Date.now(),
    cpu: cpu ?? { total: 0, cores: [], model: null },
    mem: mem ?? { totalKb: 0, availKb: 0, usedKb: 0, usedPct: 0 },
    temp: temp ?? { overall: null, zones: [] },
    gpus,
    gpuError,
    errors,
  }
}

// --- HTTP wiring -------------------------------------------------------
const DATA_ENDPOINT = '/plugins/dsh-hardware-monitor/data'

function send(res: ServerResponse, code: number, body: string): void {
  res.writeHead(code, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  })
  res.end(body)
}

export function apply(ctx: Context, _config?: unknown): void {
  // webServer routes sit outside the /api trust fence, so enforce it here:
  // reject cross-site (CSRF / tabnabbing) requests and non-GET methods.
  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'exact',
      path: DATA_ENDPOINT,
      handler: async (req, res) => {
        if (req.headers['sec-fetch-site'] === 'cross-site') { send(res, 403, JSON.stringify({ ok: false, error: 'forbidden' })); return }
        if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, JSON.stringify({ ok: false, error: 'method not allowed' })); return }
        const data = await sample()
        send(res, 200, JSON.stringify(data))
      },
    })
    return () => { dispose() }
  }, 'hardware-monitor: /plugins/dsh-hardware-monitor/data')
}
