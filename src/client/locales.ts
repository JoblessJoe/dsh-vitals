// `hardwareMonitor` namespace dictionaries (bilingual). Units (°C, GB, W, %)
// are rendered inline in the body; only the human labels are localized.

/** Simplified Chinese dictionary and key-set source of truth. */
export const zh = {
  'tab.title': '硬件',
  'guide.title': '硬件监控',
  'guide.description': '实时 CPU / 内存 / 温度 / GPU 负载',
  'section.cpu': 'CPU',
  'section.mem': '内存',
  'section.temp': 'CPU 温度',
  'section.gpu': 'GPU',
  'cpu.overall': '总体',
  'cpu.cores': '每核',
  'mem.used': '已用',
  'temp.max': '最高',
  'temp.none': '无温度传感器',
  'gpu.none': '未检测到 NVIDIA GPU',
  'gpu.util': '负载',
  'gpu.power': '功耗',
  'gpu.mem': '显存',
  'gpu.temp': '温度',
  'loading': '读取中…',
  'error': '读取失败',
  'retry': '重试',
} satisfies Record<string, string>

/** English dictionary. */
export const en = {
  'tab.title': 'Hardware',
  'guide.title': 'Hardware',
  'guide.description': 'Live CPU / memory / temps / GPU load',
  'section.cpu': 'CPU',
  'section.mem': 'Memory',
  'section.temp': 'CPU Temp',
  'section.gpu': 'GPU',
  'cpu.overall': 'Overall',
  'cpu.cores': 'Per-core',
  'mem.used': 'Used',
  'temp.max': 'Max',
  'temp.none': 'No temp sensors',
  'gpu.none': 'No NVIDIA GPU detected',
  'gpu.util': 'Load',
  'gpu.power': 'Power',
  'gpu.mem': 'VRAM',
  'gpu.temp': 'Temp',
  'loading': 'Loading…',
  'error': 'Read failed',
  'retry': 'Retry',
} satisfies typeof zh

export type HardwareMonitorKey = keyof typeof zh
