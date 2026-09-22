// dsh-vitals client bundle (esbuild CJS + __ModuleLoader__ banner). Do not edit.
window.__ModuleLoader__.load({id:"dsh-vitals",factory:Pt=>{
var module={exports:{}},exports=module.exports,require=Pt;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  HARDWARE_ID: () => HARDWARE_ID,
  HARDWARE_KIND: () => HARDWARE_KIND,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/locales.ts
var zh = {
  "tab.title": "\u786C\u4EF6",
  "guide.title": "\u786C\u4EF6\u76D1\u63A7",
  "guide.description": "\u5B9E\u65F6 CPU / \u5185\u5B58 / \u6E29\u5EA6 / GPU \u8D1F\u8F7D",
  "section.cpu": "CPU",
  "section.mem": "\u5185\u5B58",
  "section.temp": "CPU \u6E29\u5EA6",
  "section.gpu": "GPU",
  "cpu.overall": "\u603B\u4F53",
  "cpu.cores": "\u6BCF\u6838",
  "mem.used": "\u5DF2\u7528",
  "temp.max": "\u6700\u9AD8",
  "temp.none": "\u65E0\u6E29\u5EA6\u4F20\u611F\u5668",
  "gpu.none": "\u672A\u68C0\u6D4B\u5230 NVIDIA GPU",
  "gpu.util": "\u8D1F\u8F7D",
  "gpu.power": "\u529F\u8017",
  "gpu.mem": "\u663E\u5B58",
  "gpu.temp": "\u6E29\u5EA6",
  "loading": "\u8BFB\u53D6\u4E2D\u2026",
  "error": "\u8BFB\u53D6\u5931\u8D25",
  "retry": "\u91CD\u8BD5"
};
var en = {
  "tab.title": "Hardware",
  "guide.title": "Hardware",
  "guide.description": "Live CPU / memory / temps / GPU load",
  "section.cpu": "CPU",
  "section.mem": "Memory",
  "section.temp": "CPU Temp",
  "section.gpu": "GPU",
  "cpu.overall": "Overall",
  "cpu.cores": "Per-core",
  "mem.used": "Used",
  "temp.max": "Max",
  "temp.none": "No temp sensors",
  "gpu.none": "No NVIDIA GPU detected",
  "gpu.util": "Load",
  "gpu.power": "Power",
  "gpu.mem": "VRAM",
  "gpu.temp": "Temp",
  "loading": "Loading\u2026",
  "error": "Read failed",
  "retry": "Retry"
};

// src/client/definition.ts
var HARDWARE_KIND = "hardware";
var HARDWARE_ID = "dsh-vitals";
function hardwareDefinition(t) {
  return {
    id: HARDWARE_ID,
    kind: HARDWARE_KIND,
    priority: "extension",
    title: () => t("tab.title"),
    guide: [
      {
        order: 1e3,
        title: () => t("guide.title"),
        description: () => t("guide.description")
      }
    ]
  };
}

// src/client/body.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var DATA_URL = "/plugins/dsh-vitals/data";
var HISTORY = 40;
var POLL_MS = 1e3;
var C = {
  bg: "#0d1117",
  panel: "#161b22",
  border: "#30363d",
  text: "#c9d1d9",
  dim: "#8b949e",
  track: "#21262d",
  ok: "#3fb950",
  warn: "#d29922",
  bad: "#f85149",
  accent: "#58a6ff"
};
var S = {
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    height: "100%",
    padding: 12,
    boxSizing: "border-box",
    overflowY: "auto",
    background: C.bg,
    color: C.text,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.4
  },
  box: {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 8
  },
  head: { display: "flex", alignItems: "baseline", justifyContent: "space-between" },
  title: { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: C.dim },
  big: { fontSize: 26, fontWeight: 700, lineHeight: 1 },
  row: { display: "flex", alignItems: "center", gap: 8, fontSize: 12 },
  dim: { color: C.dim, fontSize: 11 },
  track: { flex: 1, height: 8, background: C.track, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, transition: "width 0.3s ease" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" },
  chip: { display: "inline-block", minWidth: 18, textAlign: "right", color: C.dim, fontSize: 11 }
};
function barColor(pct) {
  if (pct >= 85) return C.bad;
  if (pct >= 60) return C.warn;
  return C.ok;
}
var gb = (kb) => (kb / 1024 / 1024).toFixed(1);
var pct1 = (n) => n == null ? "\u2014" : `${Math.round(n)}%`;
var n1 = (n) => n == null ? "\u2014" : n.toFixed(1);
var mb = (mbv) => mbv == null ? "\u2014" : `${Math.round(mbv)} MB`;
function Bar({ pct, color }) {
  const c = color != null ? color : barColor(pct);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.track, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...S.fill, width: `${Math.max(0, Math.min(100, pct))}%`, background: c } }) });
}
function Sparkline({ samples }) {
  const w = 100, h = 34;
  if (samples.length < 2) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { height: h } });
  const step = w / (HISTORY - 1);
  const pts = samples.map((v, i) => {
    const x = (samples.length - 1 - i) * step;
    const y = h - Math.max(0, Math.min(100, v)) / 100 * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "100%", height: h, viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none", style: { display: "block" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: pts, fill: "none", stroke: C.accent, strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" }) });
}
function CoreBar({ idx, v }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.row, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.chip, children: idx }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, { pct: v }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...S.chip, minWidth: 30 }, children: Math.round(v) })
  ] });
}
function GpuBox({ g, t }) {
  var _a;
  const memPct = g.memTotalMb && g.memUsedMb != null ? g.memUsedMb / g.memTotalMb * 100 : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.box, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.head, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.title, children: `GPU ${g.index}` }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.dim, children: g.name })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.dim, children: t("gpu.temp") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: g.temp == null ? "\u2014" : `${Math.round(g.temp)} \xB0C` })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...S.dim, minWidth: 40 }, children: t("gpu.util") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, { pct: (_a = g.util) != null ? _a : 0 }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...S.chip, minWidth: 30 }, children: pct1(g.util) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...S.dim, minWidth: 40 }, children: t("gpu.power") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: g.powerW == null ? "\u2014" : `${n1(g.powerW)} W` })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...S.dim, minWidth: 40 }, children: t("gpu.mem") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, { pct: memPct, color: C.accent }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...S.chip, minWidth: 70 }, children: `${mb(g.memUsedMb)} / ${mb(g.memTotalMb)}` })
    ] })
  ] });
}
function HardwareBody({ t }) {
  var _a;
  const [data, setData] = (0, import_react.useState)(null);
  const [err, setErr] = (0, import_react.useState)(null);
  const [tick, setTick] = (0, import_react.useState)(0);
  const histRef = (0, import_react.useRef)([]);
  (0, import_react.useEffect)(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(DATA_URL, { headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!alive) return;
        histRef.current = [...histRef.current.slice(-(HISTORY - 1)), json.cpu.total];
        setData(json);
        setErr(null);
      } catch (e) {
        if (alive) setErr(e.message);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tick]);
  if (err && !data) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.root, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.box, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: S.dim, children: [
        t("error"),
        "\uFF1A",
        err
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          style: { alignSelf: "flex-start", background: C.track, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" },
          onClick: () => setTick((x) => x + 1),
          children: t("retry")
        }
      )
    ] }) });
  }
  if (!data) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.root, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.dim, children: t("loading") }) });
  }
  const { cpu, mem, temp, gpus } = data;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.root, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.box, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.head, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.title, children: t("section.cpu") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.dim, children: (_a = cpu.model) != null ? _a : "" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 16, alignItems: "flex-end" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { ...S.big, color: barColor(cpu.total) }, children: [
            Math.round(cpu.total),
            "%"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.dim, children: t("cpu.overall") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { flex: 1 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkline, { samples: histRef.current }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...S.row, marginTop: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: S.dim, children: [
        t("cpu.cores"),
        " \xB7 ",
        cpu.cores.length
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.grid, children: cpu.cores.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CoreBar, { idx: i, v }, i)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.box, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.head, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.title, children: t("section.mem") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { ...S.big, fontSize: 18, color: barColor(mem.usedPct) }, children: [
          Math.round(mem.usedPct),
          "%"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.dim, children: t("mem.used") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, { pct: mem.usedPct, color: C.accent }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...S.chip, minWidth: 90 }, children: `${gb(mem.usedKb)} / ${gb(mem.totalKb)} GB` })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.box, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.head, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.title, children: t("section.temp") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...S.big, fontSize: 18, color: temp.overall == null ? C.dim : barColor((temp.overall - 40) / 1.2) }, children: temp.overall == null ? "\u2014" : `${Math.round(temp.overall)} \xB0C` })
      ] }),
      temp.zones.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.dim, children: t("temp.none") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.grid, children: temp.zones.map((z, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...S.dim, minWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: z.name }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, { pct: Math.max(0, (z.temp - 20) / 1.3) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...S.chip, minWidth: 40 }, children: `${Math.round(z.temp)}\xB0` })
      ] }, i)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.head, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.title, children: t("section.gpu") }) }),
    gpus.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.box, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.dim, children: t("gpu.none") }) }) : gpus.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GpuBox, { g, t }, g.index))
  ] });
}

// src/client/index.tsx
var inject = ["slots", "locale", "sidebarRightTabs"];
function apply(ctx) {
  const t = ctx.locale.bind("hardwareMonitor");
  ctx.effect(() => ctx.locale.register("hardwareMonitor", { zh, en }), "dsh-vitals: dictionaries");
  ctx.effect(
    () => ctx.sidebarRightTabs.register(hardwareDefinition(t)),
    "dsh-vitals: hardware type"
  );
  ctx.effect(
    () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: HARDWARE_ID, locale: "hardwareMonitor" }, HardwareBody)),
    "dsh-vitals: body seat"
  );
}

return module.exports;
}});
