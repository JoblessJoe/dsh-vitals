// Non-Linux readers: macOS memory + Apple GPU (vm_stat / ioreg), Windows CPU
// temperature (WMI) and the nvidia-smi.exe fallback path. Linux keeps its
// /proc + /sys readers in index.ts; everything here is only reached on darwin
// or win32. Parsers are pure and exported so test/platform.test.ts can check
// them against captured output without the real OS.

import { execFile } from 'node:child_process'

/** Run a fixed command (no shell), resolve stdout or null on any failure. */
export function run(cmd: string, args: string[], timeout = 1500): Promise<string | null> {
  return new Promise(resolve => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) => {
      resolve(err ? null : String(stdout))
    })
  })
}

// --- macOS memory ------------------------------------------------------
// os.freemem() on macOS is only "Pages free", so cached files look like used
// memory and the bar sits near 100%. Available = free + inactive + speculative
// pages (vm_stat's "free" excludes speculative). Purgeable pages are left out:
// they already sit in the active/inactive counts.

/** Available bytes from `vm_stat` output, or null if it doesn't parse. */
export function parseVmStat(out: string): number | null {
  const page = Number(out.match(/page size of (\d+) bytes/)?.[1])
  if (!Number.isFinite(page) || page <= 0) return null
  const pages = (key: string): number => Number(out.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))?.[1] ?? 0)
  const avail = pages('Pages free') + pages('Pages inactive') + pages('Pages speculative')
  return avail > 0 ? avail * page : null
}

// --- macOS GPU (Apple Silicon and Intel/AMD Macs) ----------------------
export interface MacGpu { name: string; util: number | null; memUsedMb: number | null }

// ponytail: regex over `ioreg -r -d 1 -c IOAccelerator` text, not a plist
// parser. Each accelerator is one `+-o` block; keys we need are flat. Swap to
// `ioreg -a` + a plist parser if Apple changes the text layout.
/** One entry per IOAccelerator block that reports a utilisation figure. */
export function parseIoreg(out: string): MacGpu[] {
  const gpus: MacGpu[] = []
  for (const block of out.split(/^\+-o /m).slice(1)) {
    const util = block.match(/"Device Utilization %"=(\d+)/)
    if (!util) continue
    const model = block.match(/"model"\s*=\s*"([^"]+)"/)?.[1] ?? block.match(/^(\S+)/)?.[1] ?? 'GPU'
    const used = block.match(/"In use system memory"=(\d+)/)
    gpus.push({
      name: model,
      util: Number(util[1]),
      memUsedMb: used ? Math.round(Number(used[1]) / 1024 / 1024) : null,
    })
  }
  return gpus
}

// --- Windows CPU temperature -------------------------------------------
// MSAcpi_ThermalZoneTemperature reports tenths of a kelvin. Many boards don't
// expose it, or only to admins, so a failure turns the reader off for good.
// Spawning PowerShell costs ~0.5 s, so the poll path never waits on it: it
// returns the last reading and refreshes in the background every 10 s.

/** Celsius readings from the PowerShell one-liner's output (one value per line). */
export function parseWmiTemps(out: string): number[] {
  return out.split(/\r?\n/)
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n) && n > 0)
    .map(dk => Math.round((dk / 10 - 273.15) * 10) / 10)
    .filter(c => c > 0 && c < 150)
}

const WMI_TEMP = ['-NoProfile', '-NonInteractive', '-Command',
  'Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature | ForEach-Object { $_.CurrentTemperature }']
let winTemps: number[] = []
let winTempAt = 0
let winTempOff = false
let winTempBusy = false

/** Last known Windows thermal-zone temps (°C); kicks a background refresh when stale. */
export function windowsTemps(): number[] {
  if (!winTempOff && !winTempBusy && Date.now() - winTempAt > 10_000) {
    winTempBusy = true
    void run('powershell.exe', WMI_TEMP, 5000).then(out => {
      const temps = out ? parseWmiTemps(out) : []
      if (temps.length === 0) winTempOff = true
      winTemps = temps
      winTempAt = Date.now()
      winTempBusy = false
    })
  }
  return winTemps
}

// --- nvidia-smi location -----------------------------------------------
/** Where to look for nvidia-smi: PATH first, then the classic Windows install dir. */
export const NVIDIA_SMI = process.platform === 'win32'
  ? ['nvidia-smi', 'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe']
  : ['nvidia-smi']
