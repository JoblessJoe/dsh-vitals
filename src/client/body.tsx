// The `hardware` tab body: a btop-style live panel.
//
// Polls the host route (~1s) and draws rounded, bordered boxes for CPU (overall
// + per-core + sparkline), DRAM, CPU temperatures, and one box per GPU (temp /
// load / power / VRAM). All styling is inline (no CSS pipeline) so the package
// ships as a single client bundle with no assets.

import { useEffect, useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'

export interface HwCpu { total: number; cores: number[]; model: string | null }
export interface HwMem { totalKb: number; availKb: number; usedKb: number; usedPct: number }
export interface HwTemp { overall: number | null; zones: { name: string; temp: number }[] }
export interface HwGpu {
  index: number; name: string; temp: number | null; util: number | null
  powerW: number | null; memUsedMb: number | null; memTotalMb: number | null
}
export interface HwData {
  ok: true; ts: number; cpu: HwCpu; mem: HwMem; temp: HwTemp
  gpus: HwGpu[]; gpuError: string | null; errors: string[]
}

const DATA_URL = '/plugins/dsh-vitals/data'
const HISTORY = 120
const POLL_MS = 500

// --- btop-ish palette --------------------------------------------------
const C = {
  bg: '#0d1117',
  panel: '#161b22',
  border: '#30363d',
  text: '#c9d1d9',
  dim: '#8b949e',
  track: '#21262d',
  ok: '#3fb950',
  warn: '#d29922',
  bad: '#f85149',
  accent: '#58a6ff',
}

const S: Record<string, CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', gap: 10, height: '100%',
    padding: 12, boxSizing: 'border-box', overflowY: 'auto',
    background: C.bg, color: C.text,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13, lineHeight: 1.4,
  },
  box: {
    background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
  },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: C.dim },
  big: { fontSize: 26, fontWeight: 700, lineHeight: 1 },
  row: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 },
  dim: { color: C.dim, fontSize: 11 },
  track: { flex: 1, height: 8, background: C.track, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, transition: 'width 0.3s ease' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' },
  chip: { display: 'inline-block', minWidth: 18, textAlign: 'right', color: C.dim, fontSize: 11 },
}

function barColor(pct: number): string {
  if (pct >= 85) return C.bad
  if (pct >= 60) return C.warn
  return C.ok
}
// Maps a raw Celsius reading onto the same 0-100 scale barColor() grades,
// so "warn"/"bad" actually land near real CPU warning/throttle points
// (~69°C / ~85°C) instead of only tripping past 110-140°C.
const TEMP_LO = 30, TEMP_HI = 95
const tempPct = (c: number): number => Math.max(0, Math.min(100, ((c - TEMP_LO) / (TEMP_HI - TEMP_LO)) * 100))
const gb = (kb: number): string => (kb / 1024 / 1024).toFixed(1)
const pct1 = (n: number | null): string => (n == null ? '—' : `${Math.round(n)}%`)
const n1 = (n: number | null): string => (n == null ? '—' : n.toFixed(1))
const mb = (mbv: number | null): string => (mbv == null ? '—' : `${Math.round(mbv)} MB`)

function Bar({ pct, color }: { pct: number; color?: string }): ReactNode {
  const c = color ?? barColor(pct)
  return (
    <div style={S.track}>
      <div style={{ ...S.fill, width: `${Math.max(0, Math.min(100, pct))}%`, background: c }} />
    </div>
  )
}

function Sparkline({ samples }: { samples: number[] }): ReactNode {
  const w = 100, h = 40
  if (samples.length < 2) return <div style={{ height: h }} />
  const step = w / (HISTORY - 1)
  const n = samples.length
  // samples is oldest→newest; anchor the newest sample to the right edge
  // (x=w) so the graph scrolls right-to-left like btop's, not backwards.
  const pts = samples.map((v, i) => {
    const x = w - (n - 1 - i) * step
    const y = h - (Math.max(0, Math.min(100, v)) / 100) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const line = pts.join(' ')
  const firstX = pts[0]!.split(',')[0]
  const lastX = pts[pts.length - 1]!.split(',')[0]
  const area = `${firstX},${h} ${line} ${lastX},${h}`
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polygon points={area} fill={C.accent} fillOpacity={0.15} stroke="none" />
      <polyline points={line} fill="none" stroke={C.accent} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function CoreBar({ idx, v }: { idx: number; v: number }): ReactNode {
  return (
    <div style={S.row}>
      <span style={S.chip}>{idx}</span>
      <Bar pct={v} />
      <span style={{ ...S.chip, minWidth: 34 }}>{Math.round(v)}%</span>
    </div>
  )
}

function GpuBox({ g, t }: { g: HwGpu; t: TranslateNS<'hardwareMonitor'> }): ReactNode {
  const memPct = g.memTotalMb && g.memUsedMb != null ? (g.memUsedMb / g.memTotalMb) * 100 : 0
  return (
    <div style={S.box}>
      <div style={S.head}>
        <span style={S.title}>{`GPU ${g.index}`}</span>
        <span style={S.dim}>{g.name}</span>
      </div>
      <div style={S.row}>
        <span style={S.dim}>{t('gpu.temp')}</span>
        <span>{g.temp == null ? '—' : `${Math.round(g.temp)} °C`}</span>
      </div>
      <div style={S.row}>
        <span style={{ ...S.dim, minWidth: 40 }}>{t('gpu.util')}</span>
        <Bar pct={g.util ?? 0} />
        <span style={{ ...S.chip, minWidth: 30 }}>{pct1(g.util)}</span>
      </div>
      <div style={S.row}>
        <span style={{ ...S.dim, minWidth: 40 }}>{t('gpu.power')}</span>
        <span>{g.powerW == null ? '—' : `${n1(g.powerW)} W`}</span>
      </div>
      <div style={S.row}>
        <span style={{ ...S.dim, minWidth: 40 }}>{t('gpu.mem')}</span>
        <Bar pct={memPct} color={C.accent} />
        <span style={{ ...S.chip, minWidth: 70 }}>{`${mb(g.memUsedMb)} / ${mb(g.memTotalMb)}`}</span>
      </div>
    </div>
  )
}

// A raw 0.5s sample swings a lot (single-core bursts, scheduler noise); average
// the last ~10s of samples so the headline number and per-core bars settle
// instead of jumping every poll. The sparkline plots this same smoothed series.
const AVG_SAMPLES = Math.round(10_000 / POLL_MS)
const avg = (xs: readonly number[]): number => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

/** Polls the host route at POLL_MS, smooths CPU total + per-core over the last ~10s. Shared by every view. */
export function useHardwareData(): {
  data: HwData | null; err: string | null; retry: () => void
  history: number[]; cpuPct: number; corePcts: number[]
} {
  const [data, setData] = useState<HwData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const totalHistRef = useRef<number[]>([])
  const smoothedHistRef = useRef<number[]>([])
  const coreHistRef = useRef<number[][]>([])
  const [corePcts, setCorePcts] = useState<number[]>([])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(DATA_URL, { headers: { accept: 'application/json' } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as HwData
        if (!alive) return

        totalHistRef.current = [...totalHistRef.current.slice(-(HISTORY - 1)), json.cpu.total]
        const smoothedTotal = avg(totalHistRef.current.slice(-AVG_SAMPLES))
        smoothedHistRef.current = [...smoothedHistRef.current.slice(-(HISTORY - 1)), smoothedTotal]

        coreHistRef.current = [...coreHistRef.current.slice(-(AVG_SAMPLES - 1)), json.cpu.cores]
        setCorePcts(json.cpu.cores.map((_, i) => avg(coreHistRef.current.map(snap => snap[i] ?? 0))))

        setData(json)
        setErr(null)
      } catch (e) {
        if (alive) setErr((e as Error).message)
      }
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [tick])

  return {
    data, err, retry: () => setTick(x => x + 1),
    history: smoothedHistRef.current,
    cpuPct: smoothedHistRef.current.at(-1) ?? 0,
    corePcts,
  }
}

export function HardwareBody({ t }: PropsLocale<'hardwareMonitor'>): ReactNode {
  const { data, err, retry, history, cpuPct, corePcts } = useHardwareData()

  if (err && !data) {
    return (
      <div style={S.root}>
        <div style={S.box}>
          <span style={S.dim}>{t('error')}：{err}</span>
          <button
            style={{ alignSelf: 'flex-start', background: C.track, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
            onClick={retry}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }
  if (!data) {
    return <div style={S.root}><span style={S.dim}>{t('loading')}</span></div>
  }

  const { cpu, mem, temp, gpus } = data
  return (
    <div style={S.root}>
      {/* CPU */}
      <div style={S.box}>
        <div style={S.head}>
          <span style={S.title}>{t('section.cpu')}</span>
          <span style={S.dim}>{cpu.model ?? ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <span style={{ ...S.big, color: barColor(cpuPct) }}>{Math.round(cpuPct)}%</span>
            <div style={S.dim}>{t('cpu.overall')}</div>
          </div>
          <div>
            <span style={{ ...S.big, fontSize: 20, color: temp.overall == null ? C.dim : barColor(tempPct(temp.overall)) }}>
              {temp.overall == null ? '—' : `${Math.round(temp.overall)}°`}
            </span>
            <div style={S.dim}>{t('temp.max')}</div>
          </div>
          <div style={{ flex: 1 }}><Sparkline samples={history} /></div>
        </div>
        <div style={{ ...S.row, marginTop: 4 }}><span style={S.dim}>{t('cpu.cores')} · {cpu.cores.length}</span></div>
        <div style={S.grid}>
          {corePcts.map((v, i) => <CoreBar key={i} idx={i} v={v} />)}
        </div>
        {temp.zones.length > 1 && (
          <>
            <div style={{ ...S.row, marginTop: 4 }}><span style={S.dim}>{t('section.temp')} · {temp.zones.length}</span></div>
            <div style={S.grid}>
              {temp.zones.map((z, i) => (
                <div key={i} style={S.row}>
                  <span style={{ ...S.dim, minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.name}</span>
                  <Bar pct={tempPct(z.temp)} />
                  <span style={{ ...S.chip, minWidth: 40 }}>{`${Math.round(z.temp)}°`}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Memory */}
      <div style={S.box}>
        <div style={S.head}>
          <span style={S.title}>{t('section.mem')}</span>
          <span style={{ ...S.big, fontSize: 18, color: barColor(mem.usedPct) }}>{Math.round(mem.usedPct)}%</span>
        </div>
        <div style={S.row}>
          <span style={S.dim}>{t('mem.used')}</span>
          <Bar pct={mem.usedPct} color={C.accent} />
          <span style={{ ...S.chip, minWidth: 90 }}>{`${gb(mem.usedKb)} / ${gb(mem.totalKb)} GB`}</span>
        </div>
      </div>

      {/* GPUs */}
      <div style={S.head}><span style={S.title}>{t('section.gpu')}</span></div>
      {gpus.length === 0
        ? <div style={S.box}><span style={S.dim}>{t('gpu.none')}</span></div>
        : gpus.map(g => <GpuBox key={g.index} g={g} t={t} />)}
    </div>
  )
}
