// src/index.ts
import { readdirSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { cpus, freemem, totalmem } from "node:os";
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
  const dIdle = (now[4] ?? 0) - (prev[4] ?? 0);
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
      const t = [c.user, c.nice, c.sys, c.idle, c.irq];
      return { t, idle: t[3] };
    });
    const prev = prevCpuTimes;
    const cores = now.map((c, i) => corePct(prev?.total[i], c.t));
    const total = cores.length ? cores.reduce((a, b) => a + b, 0) / cores.length : 0;
    prevCpuTimes = { total: now.map((c) => c.t), idle: now.map((c) => c.idle) };
    return { total, cores, model: cpuModelOnce() };
  }
}
function sampleMem() {
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
    const t = totalmem(), f = freemem();
    totalKb = Math.round(t / 1024);
    availKb = Math.round(f / 1024);
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
        const temp = raw > 1e4 ? raw / 1e3 : raw / 100;
        if (temp < 0 || temp > 200) continue;
        zones.push({ name: type || z, temp: Math.round(temp * 10) / 10 });
      } catch {
      }
    }
  } catch {
  }
  const overall = zones.length ? Math.max(...zones.map((z) => z.temp)) : null;
  return { overall, zones };
}
function nvidiaSmi() {
  return new Promise((resolve) => {
    const args = [
      "--query-gpu=index,name,temperature.gpu,utilization.gpu,power.draw,memory.used,memory.total",
      "--format=csv,noheader,nounits"
    ];
    execFile("nvidia-smi", args, { timeout: 800 }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      resolve(stdout.trim());
    });
  });
}
async function sampleGpus() {
  const out = await nvidiaSmi();
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
    mem = sampleMem();
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
var DATA_ENDPOINT = "/plugins/dsh-hardware-monitor/data";
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
        const data = await sample();
        send(res, 200, JSON.stringify(data));
      }
    });
    return () => {
      dispose();
    };
  }, "hardware-monitor: /plugins/dsh-hardware-monitor/data");
}
export {
  apply,
  inject
};
