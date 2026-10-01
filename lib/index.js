// src/index.ts
import { readdirSync, readFileSync } from "node:fs";
import { cpus, freemem, totalmem } from "node:os";

// src/platform.ts
import { execFile } from "node:child_process";
function run(cmd, args, timeout = 1500) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) => {
      resolve(err ? null : String(stdout));
    });
  });
}
function parseVmStat(out) {
  const page = Number(out.match(/page size of (\d+) bytes/)?.[1]);
  if (!Number.isFinite(page) || page <= 0) return null;
  const pages = (key) => Number(out.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"))?.[1] ?? 0);
  const avail = pages("Pages free") + pages("Pages inactive") + pages("Pages speculative");
  return avail > 0 ? avail * page : null;
}
function parseIoreg(out) {
  const gpus = [];
  for (const block of out.split(/^\+-o /m).slice(1)) {
    const util = block.match(/"Device Utilization %"=(\d+)/);
    if (!util) continue;
    const model = block.match(/"model"\s*=\s*"([^"]+)"/)?.[1] ?? block.match(/^(\S+)/)?.[1] ?? "GPU";
    const used = block.match(/"In use system memory"=(\d+)/);
    gpus.push({
      name: model,
      util: Number(util[1]),
      memUsedMb: used ? Math.round(Number(used[1]) / 1024 / 1024) : null
    });
  }
  return gpus;
}
function parseWmiTemps(out) {
  return out.split(/\r?\n/).map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0).map((dk) => Math.round((dk / 10 - 273.15) * 10) / 10).filter((c) => c > 0 && c < 150);
}
var WMI_TEMP = [
  "-NoProfile",
  "-NonInteractive",
  "-Command",
  "Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature | ForEach-Object { $_.CurrentTemperature }"
];
var winTemps = [];
var winTempAt = 0;
var winTempOff = false;
var winTempBusy = false;
function windowsTemps() {
  if (!winTempOff && !winTempBusy && Date.now() - winTempAt > 1e4) {
    winTempBusy = true;
    void run("powershell.exe", WMI_TEMP, 5e3).then((out) => {
      const temps = out ? parseWmiTemps(out) : [];
      if (temps.length === 0) winTempOff = true;
      winTemps = temps;
      winTempAt = Date.now();
      winTempBusy = false;
    });
  }
  return winTemps;
}
var NVIDIA_SMI = process.platform === "win32" ? ["nvidia-smi", "C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe"] : ["nvidia-smi"];

// src/index.ts
var inject = ["webServer"];
function parseStat(raw) {
  const cores = [];
  for (const line of raw.split("\n")) {
    if (!line.startsWith("cpu")) break;
    const f = line.trim().split(/\s+/).slice(1).map(Number);
    if (f.some(Number.isNaN)) continue;
    cores.push(f);
  }
  return { cores };
}
function pct(prev, now) {
  const dTotal = now.reduce((a, b, i) => a + (b - (prev[i] ?? b)), 0);
  const idle = (now[3] ?? 0) - (prev[3] ?? now[3] ?? 0);
  if (dTotal <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - idle / dTotal) * 100));
}
var prevStat = null;
var prevCpuTimes = null;
var cpuModel = null;
function cpuModelOnce() {
  if (cpuModel !== null) return cpuModel;
  try {
    const m = readFileSync("/proc/cpuinfo", "utf8").match(/model name\s*:\s*(.+)/);
    if (m) {
      cpuModel = m[1].trim();
      return cpuModel;
    }
  } catch {
  }
  try {
    cpuModel = cpus()[0]?.model ?? null;
  } catch {
    cpuModel = null;
  }
  return cpuModel;
}
function corePct(prev, now) {
  if (!prev) return 0;
  const dTotal = now.reduce((a, b, i) => a + (b - (prev[i] ?? b)), 0);
  const dIdle = (now[3] ?? 0) - (prev[3] ?? 0);
  if (dTotal <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - dIdle / dTotal) * 100));
}
function sampleCpu() {
  try {
    const now = parseStat(readFileSync("/proc/stat", "utf8"));
    const total = pct(prevStat?.cores[0] ?? now.cores[0], now.cores[0]);
    const cores = now.cores.slice(1).map((c, i) => pct(prevStat?.cores[i + 1] ?? c, c));
    prevStat = now;
    return { total, cores, model: cpuModelOnce() };
  } catch {
    const now = cpus().map((c) => {
      const t = [c.times.user, c.times.nice, c.times.sys, c.times.idle, c.times.irq];
      return { t, idle: t[3] };
    });
    const prev = prevCpuTimes;
    const cores = now.map((c, i) => corePct(prev?.total[i], c.t));
    const total = cores.length ? cores.reduce((a, b) => a + b, 0) / cores.length : 0;
    prevCpuTimes = { total: now.map((c) => c.t), idle: now.map((c) => c.idle) };
    return { total, cores, model: cpuModelOnce() };
  }
}
async function sampleMem() {
  let totalKb = null, availKb = null;
  try {
    const g = {};
    for (const line of readFileSync("/proc/meminfo", "utf8").split("\n")) {
      const m = line.match(/^(\w+):\s+(\d+)\s*kB/);
      if (m) g[m[1]] = Number(m[2]);
    }
    totalKb = g.MemTotal ?? null;
    availKb = g.MemAvailable ?? (g.MemFree ?? 0) + (g.Buffers ?? 0) + (g.Cached ?? 0);
  } catch {
    const mac = process.platform === "darwin" ? parseVmStat(await run("vm_stat", []) ?? "") : null;
    totalKb = Math.round(totalmem() / 1024);
    availKb = Math.round((mac ?? freemem()) / 1024);
  }
  if (totalKb == null || totalKb <= 0 || availKb == null) {
    return { totalKb: 0, availKb: 0, usedKb: 0, usedPct: 0 };
  }
  const usedKb = Math.max(0, totalKb - availKb);
  const usedPct = Math.min(100, usedKb / totalKb * 100);
  return { totalKb, availKb, usedKb, usedPct };
}
async function sampleTemp() {
  const zones = [];
  try {
    for (const z of readdirSync("/sys/class/thermal")) {
      if (!z.startsWith("thermal_zone")) continue;
      try {
        const type = readFileSync(`/sys/class/thermal/${z}/type`, "utf8").trim();
        const raw = Number(readFileSync(`/sys/class/thermal/${z}/temp`, "utf8").trim());
        if (!Number.isFinite(raw)) continue;
        const temp = raw / 1e3;
        if (temp < 0 || temp > 200) continue;
        zones.push({ name: type || z, temp: Math.round(temp * 10) / 10 });
      } catch {
      }
    }
  } catch {
  }
  if (process.platform === "win32") windowsTemps().forEach((temp, i) => zones.push({ name: `zone ${i}`, temp }));
  const overall = zones.length ? Math.max(...zones.map((z) => z.temp)) : null;
  return { overall, zones };
}
var SMI_ARGS = [
  "--query-gpu=index,name,temperature.gpu,utilization.gpu,power.draw,memory.used,memory.total",
  "--format=csv,noheader,nounits"
];
var smiPath = null;
async function nvidiaSmi() {
  for (const cmd of smiPath ? [smiPath] : NVIDIA_SMI) {
    const out = await run(cmd, SMI_ARGS, 800);
    if (out !== null) {
      smiPath = cmd;
      return out.trim();
    }
  }
  return null;
}
async function macGpus() {
  const out = await run("ioreg", ["-r", "-d", "1", "-c", "IOAccelerator"]);
  return (out ? parseIoreg(out) : []).map((g, index) => ({
    index,
    name: g.name,
    temp: null,
    util: g.util,
    powerW: null,
    memUsedMb: g.memUsedMb,
    memTotalMb: null
  }));
}
async function sampleGpus() {
  const out = await nvidiaSmi();
  if ((out === null || out.length === 0) && process.platform === "darwin") return { gpus: await macGpus(), gpuError: null };
  if (out === null || out.length === 0) return { gpus: [], gpuError: null };
  const gpus = [];
  for (const line of out.split("\n")) {
    const [index, name, temp, util, power, memUsed, memTotal] = line.split(",").map((s) => s.trim());
    const num = (s) => {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    gpus.push({
      index: num(index) ?? 0,
      name,
      temp: num(temp),
      util: num(util),
      powerW: num(power),
      memUsedMb: num(memUsed),
      memTotalMb: num(memTotal)
    });
  }
  return { gpus, gpuError: null };
}
async function sample() {
  const errors = [];
  let cpu, mem;
  let temp;
  let gpus = [], gpuError = null;
  try {
    cpu = sampleCpu();
  } catch (e) {
    errors.push(`cpu: ${e.message}`);
  }
  try {
    mem = await sampleMem();
  } catch (e) {
    errors.push(`mem: ${e.message}`);
  }
  try {
    temp = await sampleTemp();
  } catch (e) {
    errors.push(`temp: ${e.message}`);
  }
  try {
    ({ gpus, gpuError } = await sampleGpus());
  } catch (e) {
    gpuError = e.message;
  }
  return {
    ok: true,
    ts: Date.now(),
    cpu: cpu ?? { total: 0, cores: [], model: null },
    mem: mem ?? { totalKb: 0, availKb: 0, usedKb: 0, usedPct: 0 },
    temp: temp ?? { overall: null, zones: [] },
    gpus,
    gpuError,
    errors
  };
}
var SAMPLE_TTL_MS = 400;
var last = null;
function sharedSample() {
  if (!last || Date.now() - last.at > SAMPLE_TTL_MS) last = { at: Date.now(), data: sample() };
  return last.data;
}
var DATA_ENDPOINT = "/plugins/dsh-vitals/data";
function send(res, code, body) {
  res.writeHead(code, {
    "content-type": "application/json",
    "cache-control": "no-store"
  });
  res.end(body);
}
function apply(ctx, _config) {
  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: "exact",
      path: DATA_ENDPOINT,
      handler: async (req, res) => {
        if (req.headers["sec-fetch-site"] === "cross-site") {
          send(res, 403, JSON.stringify({ ok: false, error: "forbidden" }));
          return;
        }
        if (req.method !== "GET" && req.method !== "HEAD") {
          send(res, 405, JSON.stringify({ ok: false, error: "method not allowed" }));
          return;
        }
        const data = await sharedSample();
        send(res, 200, JSON.stringify(data));
      }
    });
    return () => {
      dispose();
    };
  }, "vitals: /plugins/dsh-vitals/data");
}
export {
  apply,
  inject
};
