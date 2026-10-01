// The header mini view: CPU and GPU load as tiny bars in the session header,
// next to the "⋯" menu. Click switches to the full Hardware view tab.
//
// Uses the theme's own text colour (the header is not always dark) and only
// the bar fills carry the btop palette.

import type { ReactNode, CSSProperties, MouseEvent } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { useHardwareData } from './body'

const ok = '#3fb950', warn = '#d29922', bad = '#f85149'
const color = (pct: number): string => (pct >= 85 ? bad : pct >= 60 ? warn : ok)

const S: Record<string, CSSProperties> = {
  button: {
    display: 'inline-flex', alignItems: 'center', gap: 10, height: 26, padding: '0 8px',
    background: 'transparent', border: '1px solid transparent', borderRadius: 6,
    color: 'inherit', cursor: 'pointer', opacity: 0.85,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 11,
  },
  cell: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  label: { opacity: 0.6 },
  track: { width: 28, height: 5, borderRadius: 3, background: 'rgba(127,127,127,0.25)', overflow: 'hidden' },
  value: { minWidth: 28, textAlign: 'right' },
}

function Cell({ label, pct }: { label: string; pct: number }): ReactNode {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <span style={S.cell}>
      <span style={S.label}>{label}</span>
      <span style={S.track}><span style={{ display: 'block', height: '100%', width: `${p}%`, background: color(p), transition: 'width 0.3s ease' }} /></span>
      <span style={S.value}>{Math.round(p)}%</span>
    </span>
  )
}

// ponytail: the header only hands `selectView` to its own tab strip, not to
// utilities, so we press the Hardware tab button by its label. Breaks if dsh
// renames role="tab"; switch to a real API if ui-conversation ever exposes one.
function openHardwareTab(e: MouseEvent<HTMLElement>, label: string): void {
  const header = e.currentTarget.closest('header')
  const tabs = header?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []
  for (const tab of tabs) if (tab.textContent?.trim() === label) { tab.click(); return }
}

export function HeaderVitals({ t }: PropsLocale<'hardwareMonitor'>): ReactNode {
  const { data, cpuPct } = useHardwareData()
  if (!data) return null

  const multi = data.gpus.length > 1
  const tip = [
    `CPU ${Math.round(cpuPct)}%${data.temp.overall == null ? '' : ` · ${Math.round(data.temp.overall)}°C`}`,
    `${t('section.mem')} ${Math.round(data.mem.usedPct)}%`,
    ...data.gpus.map(g => `GPU ${g.index} ${g.name}: ${g.util ?? '—'}%${g.temp == null ? '' : ` · ${Math.round(g.temp)}°C`}`
      + (g.memUsedMb == null || g.memTotalMb == null ? '' : ` · ${Math.round(g.memUsedMb)} / ${Math.round(g.memTotalMb)} MB`)),
    t('mini.open'),
  ].join('\n')

  return (
    <button type="button" style={S.button} title={tip} aria-label={t('mini.open')} onClick={e => { openHardwareTab(e, t('tab.title')) }}>
      <Cell label="CPU" pct={cpuPct} />
      {data.gpus.map(g => <Cell key={g.index} label={multi ? `GPU${g.index}` : 'GPU'} pct={g.util ?? 0} />)}
    </button>
  )
}
