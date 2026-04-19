import { useState, useRef, useEffect } from "react";

// ── API ───────────────────────────────────────────────────────────────────────
// Text-only call (with web search tools)
async function askClaude(system, userMsg) {
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1500, system,
      messages: [{ role: "user", content: userMsg }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "API error");
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}

// Image call — NO tools (Anthropic API does not support tools + images together)
async function askClaudeWithImage(system, userMsg, imageBase64, imageMediaType) {
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1500, system,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imageMediaType, data: imageBase64 } },
          { type: "text", text: userMsg },
        ],
      }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "API error");
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}

// Simple, reliable image reader using FileReader (works on all browsers and formats)
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (!dataUrl || !dataUrl.includes(",")) {
        reject(new Error("Could not read file"));
        return;
      }
      const base64 = dataUrl.split(",")[1];
      // Always send as jpeg-compatible type — use image/jpeg for unknown types
      const mediaType = file.type && file.type.startsWith("image/") && file.type !== "image/heic" && file.type !== "image/heif"
        ? file.type
        : "image/jpeg";
      resolve({ base64, mediaType });
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

// ── PALETTE & FONTS ───────────────────────────────────────────────────────────
const C = {
  choco:   "#45151B",
  mauve:   "#EA9DAE",
  caramel: "#FBDE9C",
  royal:   "#F99256",
  cherry:  "#C74E51",
  white:   "#FFF8EE",
  cream:   "#FFF0E0",
  black:   "#2A0A0E",
};
const DISPLAY = "'Fredoka One', cursive";
const BODY    = "'Nunito', sans-serif";

const YARN_WEIGHTS = [
  { name: "Lace", hook: "1.5–2.25", sts10: "32–42", rows10: "40–52" },
  { name: "Fingering", hook: "2.25–3.5", sts10: "28–36", rows10: "36–44" },
  { name: "Sport", hook: "3.5–4.5", sts10: "22–28", rows10: "28–36" },
  { name: "DK", hook: "4.5–5.5", sts10: "18–22", rows10: "22–28" },
  { name: "Worsted", hook: "5.5–6.5", sts10: "14–18", rows10: "18–22" },
  { name: "Aran", hook: "6.5–7", sts10: "12–15", rows10: "14–18" },
  { name: "Bulky", hook: "7–9", sts10: "9–12", rows10: "11–14" },
  { name: "Super Bulky", hook: "9–15", sts10: "6–9", rows10: "8–11" },
];

const gridBg = (base) => `repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(69,21,27,0.05) 27px,rgba(69,21,27,0.05) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(69,21,27,0.05) 27px,rgba(69,21,27,0.05) 28px),${base}`;
const card = { background: gridBg(C.white), border: `2.5px solid ${C.black}`, borderRadius: 24, boxShadow: `6px 6px 0 ${C.black}` };
const btn = (bg, fg = C.black) => ({ background: bg, color: fg, border: `2.5px solid ${C.black}`, boxShadow: `4px 4px 0 ${C.black}`, borderRadius: 50, fontFamily: DISPLAY, fontWeight: 400, cursor: "pointer", transition: "all 0.12s", letterSpacing: "0.5px" });

// ── SHARED FORM COMPONENTS ────────────────────────────────────────────────────
function Lbl({ children, color = C.choco }) {
  return <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color, fontFamily: BODY }}>{children}</span>;
}
function Inp({ value, onChange, placeholder, unit, type = "text" }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onFocus={() => setF(true)} onBlur={() => setF(false)}
        style={{ width: "100%", padding: unit ? "10px 42px 10px 14px" : "10px 14px", border: `2px solid ${f ? C.cherry : C.black}`, borderRadius: 12, fontFamily: BODY, fontSize: 15, color: C.black, background: f ? "#FFF0E8" : C.white, outline: "none", transition: "all 0.15s", boxShadow: f ? `3px 3px 0 ${C.cherry}` : `2px 2px 0 ${C.black}` }} />
      {unit && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 700, color: C.choco, fontFamily: BODY, pointerEvents: "none" }}>{unit}</span>}
    </div>
  );
}
function Txa({ value, onChange, placeholder, rows = 4 }) {
  const [f, setF] = useState(false);
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} onFocus={() => setF(true)} onBlur={() => setF(false)}
    style={{ width: "100%", padding: "12px 14px", border: `2px solid ${f ? C.cherry : C.black}`, borderRadius: 16, fontFamily: BODY, fontSize: 14.5, color: C.black, background: f ? "#FFF0E8" : C.white, outline: "none", resize: "vertical", lineHeight: 1.7, transition: "all 0.15s", boxShadow: f ? `4px 4px 0 ${C.cherry}` : `3px 3px 0 ${C.black}` }} />;
}
function GaugeBox({ label, accent, sts, setSts, rows, setRows, over, setOver, hint }) {
  return (
    <div style={{ padding: 16, background: accent + "18", border: `2px dashed ${accent}`, borderRadius: 16, boxShadow: `3px 3px 0 ${accent}` }}>
      <p style={{ margin: "0 0 6px", fontSize: 10.5, fontWeight: 800, color: accent, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: BODY }}>{label}</p>
      {hint && <p style={{ margin: "0 0 10px", fontSize: 13, color: C.black, lineHeight: 1.5, fontFamily: BODY }}>{hint}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[{ l: "Stitches", v: sts, s: setSts, p: "e.g. 14" }, { l: "Rows", v: rows, s: setRows, p: "e.g. 18" }, { l: "Over", v: over, s: setOver, p: "10", u: "cm" }].map(f => (
          <div key={f.l} style={{ display: "flex", flexDirection: "column", gap: 4 }}><Lbl color={accent}>{f.l}</Lbl><Inp value={f.v} onChange={f.s} placeholder={f.p} unit={f.u} type="number" /></div>
        ))}
      </div>
    </div>
  );
}
function YarnFill({ onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ ...btn(C.caramel), padding: "7px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `6px 6px 0 ${C.black}`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>🧶 Quick-fill gauge</button>
      {open && (
        <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 300, minWidth: 310, background: C.white, border: `2.5px solid ${C.black}`, borderRadius: 16, boxShadow: `6px 6px 0 ${C.black}`, overflow: "hidden" }}>
          <div style={{ padding: "8px 16px", background: C.choco, color: C.caramel, fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: BODY }}>↓ Pick your yarn weight</div>
          {YARN_WEIGHTS.map((w, i) => (
            <button key={w.name} onClick={() => { onSelect(w); setOpen(false); }}
              style={{ width: "100%", padding: "10px 16px", border: "none", borderBottom: `1.5px solid ${C.black}`, background: i % 2 === 0 ? C.white : C.cream, textAlign: "left", cursor: "pointer", fontFamily: BODY, display: "grid", gridTemplateColumns: "100px 90px 1fr", gap: 8, alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = C.caramel}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.white : C.cream}>
              <span style={{ fontWeight: 700, color: C.black, fontSize: 14 }}>{w.name}</span>
              <span style={{ fontSize: 12, color: C.choco }}>Hook {w.hook}mm</span>
              <span style={{ fontSize: 12, color: C.cherry }}>{w.sts10} sts/10cm</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PATTERN DISPLAY ───────────────────────────────────────────────────────────
function PatternDisplay({ raw }) {
  const lines = raw.split("\n"); const els = []; let k = 0;
  for (const line of lines) {
    const t = line.trim(); if (!t) { els.push(<div key={k++} style={{ height: 10 }} />); continue; }
    // Match: Round 1 / Row 1 / Rnd 1 / R1 / R.1 — with : ) . after number
    if (/^(rounds?|rows?|rnds?|r\.?)\s*\d+[-–]?\d*[\s:.)]/i.test(t)) {
      const m = t.match(/^((?:rounds?|rows?|rnds?|r\.?)\s*\d+[-–]?\d*)\s*[:.)\s]\s*(.*)/i);
      if (m) {
        // stitch count: (18 sts) or (18) or (18 dc) or (18 sc)
        const cm = m[2].match(/\((\d+)\s*(?:sts?|stitches?|dc|sc|hdc|tr)?\)/i);
        const cnt = cm ? cm[1] : null;
        const content = m[2].replace(/\(\d+\s*(?:sts?|stitches?|dc|sc|hdc|tr)?\)/i, "").trim();
        els.push(<div key={k++} style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: 12, padding: "10px 16px", background: C.white, border: `2px solid ${C.black}`, borderLeft: `6px solid ${C.cherry}`, borderRadius: 12, marginBottom: 6, alignItems: "start" }}>
          <span style={{ fontWeight: 800, color: C.cherry, fontSize: 13, fontFamily: DISPLAY, paddingTop: 2 }}>{m[1]}</span>
          <span style={{ color: C.black, fontSize: 14.5, lineHeight: 1.6, fontFamily: BODY }} dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>") }} />
          {cnt && <span style={{ padding: "3px 12px", background: C.caramel, color: C.black, border: `2px solid ${C.black}`, borderRadius: 50, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", fontFamily: BODY }}>{cnt} sts</span>}
        </div>); continue;
      }
    }
    if (/^#{1,3}\s/.test(t) || /^\*\*[^*]+\*\*$/.test(t)) { els.push(<div key={k++} style={{ background: C.choco, color: C.caramel, padding: "9px 16px", margin: "18px 0 10px", fontWeight: 400, fontSize: 15, fontFamily: DISPLAY, border: `2px solid ${C.black}`, borderRadius: 12 }}>{t.replace(/^#{1,3}\s/, "").replace(/\*\*/g, "")}</div>); continue; }
    if (/^(💡|note:|tip:)/i.test(t)) { els.push(<div key={k++} style={{ padding: "11px 16px", marginBottom: 7, background: C.caramel, border: `2px solid ${C.black}`, borderRadius: 14, boxShadow: `3px 3px 0 ${C.black}`, color: C.black, fontSize: 14, lineHeight: 1.65, fontFamily: BODY }} dangerouslySetInnerHTML={{ __html: t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />); continue; }
    if (/^🎨/.test(t)) { els.push(<div key={k++} style={{ padding: "11px 16px", marginBottom: 7, background: C.mauve + "55", border: `2px solid ${C.mauve}`, borderRadius: 14, boxShadow: `3px 3px 0 ${C.mauve}`, color: C.choco, fontSize: 14, lineHeight: 1.65, fontFamily: BODY }} dangerouslySetInnerHTML={{ __html: t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />); continue; }
    els.push(<p key={k++} style={{ margin: "0 0 8px", fontSize: 14.5, color: C.black, lineHeight: 1.75, fontFamily: BODY }} dangerouslySetInnerHTML={{ __html: t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />);
  }
  return <div>{els}</div>;
}

// ── DOTS SPINNER ──────────────────────────────────────────────────────────────
function Dots({ cols = [C.cherry, C.caramel, C.royal] }) {
  return <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 18 }}>
    {cols.map((col, i) => <div key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: col, border: `2px solid ${C.black}`, animation: `dot 1.1s ease-in-out ${i * 0.18}s infinite` }} />)}
  </div>;
}

// ── CARD HEADER STRIP ─────────────────────────────────────────────────────────
function CardHeader({ bg, text, fg = C.white, extra }) {
  return <div style={{ background: bg, padding: "10px 22px", margin: "-28px -30px 22px", borderBottom: `2.5px solid ${C.black}`, borderRadius: "22px 22px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
    <h2 style={{ margin: 0, color: fg, fontFamily: DISPLAY, fontSize: 20, letterSpacing: "1px" }}>{text}</h2>
    {extra}
  </div>;
}

// ══════════════════════════════════════════════════════════════════════════════
// PATTERN REWRITER TOOL
// ══════════════════════════════════════════════════════════════════════════════
function PatternRewriter() {
  const [op, setOp] = useState(""); const [oy, setOy] = useState(""); const [oh, setOh] = useState("");
  const [ogs, setOgs] = useState(""); const [ogr, setOgr] = useState(""); const [ogo, setOgo] = useState("10");
  const [ow, setOw] = useState(""); const [oht, setOht] = useState("");
  const [my, setMy] = useState(""); const [mh, setMh] = useState("");
  const [mgs, setMgs] = useState(""); const [mgr, setMgr] = useState(""); const [mgo, setMgo] = useState("10");
  const [mtw, setMtw] = useState(""); const [mth, setMth] = useState("");
  const [result, setResult] = useState(""); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); const [step, setStep] = useState(1);
  const ref = useRef(null);
  const ok1 = op.trim().length > 20; const ok2 = mgs && mgr;
  const hp = w => { setOy(w.name); setOh(w.hook.split("–")[0]); setOgs(w.sts10.split("–")[0]); setOgr(w.rows10.split("–")[0]); };
  const hm = w => { setMy(w.name); setMh(w.hook.split("–")[0]); setMgs(w.sts10.split("–")[0]); setMgr(w.rows10.split("–")[0]); };

  const rewrite = async () => {
    if (!ok2) { setError("I need your gauge — stitches and rows per 10cm!"); return; }
    setError(""); setLoading(true); setResult(""); setStep(3);
    setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    const oi = [oy && `Original yarn: ${oy}`, oh && `Original hook: ${oh}mm`, ogs && ogr && `Original gauge: ${ogs} sts × ${ogr} rows per ${ogo}cm`, ow && `Finished width: ${ow}cm`, oht && `Finished height: ${oht}cm`].filter(Boolean).join("\n");
    const mi = [my && `My yarn: ${my}`, mh && `My hook: ${mh}mm`, `My gauge: ${mgs} sts × ${mgr} rows per ${mgo}cm`, mtw && `Target width: ${mtw}cm`, mth && `Target height: ${mth}cm`].filter(Boolean).join("\n");
    try {
      const text = await askClaude(`You are an expert crochet pattern writer. Rewrite the ENTIRE pattern for the crocheter's materials.

MATHS:
- Stitch scale factor = (my_sts/my_over) / (orig_sts/orig_over)
- Row scale factor = (my_rows/my_over) / (orig_rows/orig_over)
- Apply BOTH scale factors to every stitch count and row count in the pattern
- Rounding rules (IMPORTANT):
  * Amigurumi worked in rounds of 6: round to nearest multiple of 6
  * Granny squares (dc clusters of 3): round to nearest multiple of 3
  * Flat pieces (rows): round to nearest even number
  * Pattern repeats like *sc X, inc* x6: keep the x6 repeat, adjust X only
- Scale ALL design elements proportionally (eyes, muzzle, ears, motifs, stripes, colour changes)
- Eye placement: scale the stitch gap between eyes proportionally

OUTPUT FORMAT:
- Start with: ## Materials & Gauge (list my yarn, hook, gauge)
- Write EVERY row/round. Format: "Round N: [instructions] (X sts)"
- Add 💡 tip after any tricky step (stuffing, colour change, shaping)
- Mark design elements with 🎨 (eyes, embroidery, colour panels)
- Use section headers: ## Head, ## Body, ## Ears, etc.
- End with: ## Finishing (assembly, weaving in ends)
- Tone: warm, encouraging, beginner-friendly explanations`,
        `ORIGINAL PATTERN:\n${op}\n\n${oi ? `ORIGINAL MATERIALS:\n${oi}\n\n` : ""}MY MATERIALS:\n${mi}\n\nRewrite the complete pattern for my yarn and hook.`);      setResult(text);
    } catch { setError("Something went wrong — please try again!"); setStep(2); }
    setLoading(false);
  };

  const StepPill = ({ n, label }) => (
    <div style={{ display: "flex", alignItems: "center" }}>
      <button onClick={() => n < step && setStep(n)} style={{ padding: "7px 18px", background: step === n ? C.cherry : step > n ? C.cherry + "44" : C.white, color: step === n ? C.white : step > n ? C.cherry : "#aaa", border: `2px solid ${step >= n ? C.cherry : "#ccc"}`, borderRadius: 50, fontFamily: DISPLAY, fontSize: 13, cursor: n < step ? "pointer" : "default", transition: "all 0.15s", boxShadow: step === n ? `3px 3px 0 ${C.black}` : "none" }}>{n}. {label}</button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <StepPill n={1} label="The Pattern" />
        <div style={{ width: 20, height: 3, background: step > 1 ? C.black : "#ddd", borderRadius: 2 }} />
        <StepPill n={2} label="My Materials" />
        <div style={{ width: 20, height: 3, background: step > 2 ? C.black : "#ddd", borderRadius: 2 }} />
        <StepPill n={3} label="My Rewrite" />
      </div>

      {step === 1 && (
        <div style={{ ...card, padding: "28px 30px" }} className="fadeUp">
          <CardHeader bg={C.cherry} text="📋 Step 1 — Paste the Original Pattern" />
          <p style={{ margin: "0 0 16px", fontSize: 15, color: C.black, lineHeight: 1.75, fontFamily: BODY }}>Copy the pattern text from a tutorial, website, or your notes. Every row you include makes the rewrite more accurate.</p>
          <Txa value={op} onChange={setOp} rows={10} placeholder={"Paste pattern here, e.g.\n\nMaterials: Worsted weight yarn, 5mm hook\nGauge: 14 sc x 18 rows = 10cm\n\nRound 1: sc in each ch (72 sts)\nRound 2: *sc 10, inc* x6 (78 sts)\n..."} />
          <div style={{ marginTop: 18, padding: 16, background: C.cream, border: `2px dashed ${C.choco}`, borderRadius: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <Lbl color={C.choco}>Original materials — optional</Lbl><YarnFill onSelect={hp} />
            </div>
            <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><Lbl>Yarn weight</Lbl><Inp value={oy} onChange={setOy} placeholder="e.g. Worsted" /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><Lbl>Hook size</Lbl><Inp value={oh} onChange={setOh} placeholder="e.g. 5.0" unit="mm" type="number" /></div>
            </div>
            <GaugeBox label="Their gauge swatch" accent={C.choco} sts={ogs} setSts={setOgs} rows={ogr} setRows={setOgr} over={ogo} setOver={setOgo} />
            <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><Lbl>Finished width</Lbl><Inp value={ow} onChange={setOw} placeholder="e.g. 20" unit="cm" type="number" /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><Lbl>Finished height</Lbl><Inp value={oht} onChange={setOht} placeholder="e.g. 22" unit="cm" type="number" /></div>
            </div>
          </div>
          <button onClick={() => ok1 && setStep(2)} disabled={!ok1} style={{ ...btn(ok1 ? C.caramel : "#ddd"), width: "100%", marginTop: 20, padding: 16, fontSize: 17, boxShadow: ok1 ? `5px 5px 0 ${C.black}` : "none", cursor: ok1 ? "pointer" : "not-allowed" }}
            onMouseEnter={e => ok1 && (e.currentTarget.style.transform = "translate(-2px,-2px)", e.currentTarget.style.boxShadow = `7px 7px 0 ${C.black}`)}
            onMouseLeave={e => (e.currentTarget.style.transform = "none", e.currentTarget.style.boxShadow = ok1 ? `5px 5px 0 ${C.black}` : "none")}>
            {ok1 ? "Next: My Materials →" : "Paste a pattern above to continue"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ ...card, padding: "28px 30px" }} className="fadeUp">
          <CardHeader bg={C.choco} text="🧶 Step 2 — Your Yarn & Hook" fg={C.caramel} />
          <div style={{ padding: "11px 14px", background: C.mauve + "33", border: `2px solid ${C.mauve}`, borderRadius: 12, marginBottom: 16, fontSize: 13.5, color: C.choco, fontFamily: BODY, lineHeight: 1.7 }}>⭐ <strong>Your swatch gauge is the most important part.</strong> It makes every stitch count accurate for YOUR hands.</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}><YarnFill onSelect={hm} /></div>
          <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><Lbl>My yarn weight</Lbl><Inp value={my} onChange={setMy} placeholder="e.g. Aran, DK" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><Lbl>My hook size</Lbl><Inp value={mh} onChange={setMh} placeholder="e.g. 4.5" unit="mm" type="number" /></div>
          </div>
          <GaugeBox label="⭐ My gauge swatch — crochet a small square & measure!" accent={C.royal} sts={mgs} setSts={setMgs} rows={mgr} setRows={setMgr} over={mgo} setOver={setMgo} hint="Crochet ~15×15 sts, lay flat, count how many sts and rows fit in 10cm." />
          <div style={{ marginTop: 14, padding: "14px 16px", background: C.caramel + "66", border: `2px dashed ${C.black}`, borderRadius: 14 }}>
            <Lbl>Target size — optional</Lbl>
            <p style={{ margin: "6px 0 12px", fontSize: 13, color: C.black, lineHeight: 1.5, fontFamily: BODY }}>Leave blank to match the original, or enter a custom size.</p>
            <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><Lbl>Target width</Lbl><Inp value={mtw} onChange={setMtw} placeholder="e.g. 21" unit="cm" type="number" /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><Lbl>Target height</Lbl><Inp value={mth} onChange={setMth} placeholder="e.g. 24" unit="cm" type="number" /></div>
            </div>
          </div>
          {error && <div style={{ marginTop: 12, padding: "11px 14px", background: C.cherry + "22", border: `2px solid ${C.cherry}`, borderRadius: 12, color: C.cherry, fontSize: 13, fontWeight: 700, fontFamily: BODY }}>⚠️ {error}</div>}
          <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
            <button onClick={() => setStep(1)} style={{ ...btn(C.white), padding: "14px 20px", fontSize: 14 }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `6px 6px 0 ${C.black}`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>← Back</button>
            <button onClick={rewrite} disabled={!ok2} style={{ ...btn(ok2 ? C.cherry : "#ddd", ok2 ? C.white : "#aaa"), flex: 1, padding: 16, fontSize: 16, boxShadow: ok2 ? `5px 5px 0 ${C.black}` : "none", cursor: ok2 ? "pointer" : "not-allowed" }}
              onMouseEnter={e => ok2 && (e.currentTarget.style.transform = "translate(-2px,-2px)", e.currentTarget.style.boxShadow = `7px 7px 0 ${C.black}`)}
              onMouseLeave={e => (e.currentTarget.style.transform = "none", e.currentTarget.style.boxShadow = ok2 ? `5px 5px 0 ${C.black}` : "none")}>✨ Rewrite My Pattern</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div ref={ref} className="fadeUp">
          {loading ? (
            <div style={{ ...card, padding: "56px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 48, animation: "spin 1.5s linear infinite", display: "inline-block" }}>🧶</div>
              <h3 style={{ margin: "16px 0 6px", color: C.cherry, fontFamily: DISPLAY, fontSize: 26 }}>Rewriting your pattern…</h3>
              <p style={{ margin: 0, color: C.choco, fontSize: 14, fontFamily: BODY }}>Translating every row for your yarn — hold tight!</p>
              <Dots />
            </div>
          ) : result ? (
            <>
              <div style={{ ...card, padding: "28px 30px" }}>
                <CardHeader bg={C.royal} text="✨ Your Rewritten Pattern" extra={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {my && <span style={{ background: C.caramel, color: C.black, padding: "3px 10px", border: `2px solid ${C.black}`, borderRadius: 50, fontSize: 11, fontWeight: 700, fontFamily: BODY }}>{my}</span>}
                    {mh && <span style={{ background: C.mauve, color: C.black, padding: "3px 10px", border: `2px solid ${C.black}`, borderRadius: 50, fontSize: 11, fontWeight: 700, fontFamily: BODY }}>{mh}mm</span>}
                    <button onClick={() => navigator.clipboard?.writeText(result)} style={{ ...btn(C.white), padding: "5px 14px", fontSize: 12 }}>📋 Copy</button>
                  </div>
                } />
                <PatternDisplay raw={result} />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                <button onClick={() => setStep(2)} style={{ ...btn(C.white), flex: 1, padding: 14, fontSize: 14 }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `6px 6px 0 ${C.black}`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>← Change Materials</button>
                <button onClick={() => { setStep(1); setResult(""); setOp(""); }} style={{ ...btn(C.choco, C.caramel), flex: 1, padding: 14, fontSize: 14 }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `6px 6px 0 ${C.black}`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>🔄 New Pattern</button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ══════════════════════════════════════════════════════════════════════════════
function HomePage({ goTo }) {
  const features = [
    { emoji: "✍️", title: "Pattern Rewriter", color: C.cherry, bg: C.cherry + "15", desc: "Found a tutorial you love but your yarn is different? Paste the pattern, enter your gauge, and get the entire thing rewritten for your exact materials — every row, every stitch count.", cta: "Try Pattern Rewriter", page: "rewriter" },
  ];
  const howItWorks = [
    { n: "01", title: "Paste or Upload", desc: "Drop in your crochet pattern as text, or upload a photo of your leftover yarn — even HEIC from your iPhone works." },
    { n: "02", title: "Tell Fluffle about your materials", desc: "Enter your yarn weight, hook size, and the gauge from your swatch. That's all Fluffle needs to do the maths." },
    { n: "03", title: "Get your custom result", desc: "Receive a fully rewritten pattern for your materials, or 4 project ideas matched to your yarn colours — with free patterns to start straight away." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── HERO ── */}
      <section style={{ background: C.choco, padding: "80px 24px 90px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* decorative blobs */}
        {[["-8%","10%",180,C.cherry],[" 90%","5%",140,C.royal],["5%","75%",100,C.mauve],["85%","80%",120,C.caramel]].map(([l,t,s,c],i) => (
          <div key={i} style={{ position: "absolute", left: l, top: t, width: s, height: s, borderRadius: "50%", background: c, opacity: 0.15, filter: "blur(40px)", pointerEvents: "none" }} />
        ))}
        <div style={{ position: "relative", maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "inline-block", background: C.caramel, border: `2px solid ${C.black}`, borderRadius: 50, padding: "6px 20px", fontSize: 13, fontWeight: 800, color: C.choco, fontFamily: BODY, letterSpacing: "1px", marginBottom: 20 }}>
            ✨ FREE AI CROCHET TOOLS
          </div>
          <h1 style={{ margin: "0 0 18px", fontFamily: DISPLAY, fontSize: "clamp(44px, 8vw, 78px)", color: C.white, lineHeight: 1.05, letterSpacing: "2px" }}>
            Never lose a day<br />
            <span style={{ color: C.caramel }}>to crochet maths</span><br />
            again
          </h1>
          <p style={{ margin: "0 0 36px", fontSize: 18, color: "rgba(255,248,238,0.8)", lineHeight: 1.7, fontFamily: BODY, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
            Fluffle rewrites crochet patterns for your yarn and turns leftover scraps into project ideas — all in seconds.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => goTo("rewriter")} style={{ ...btn(C.caramel), padding: "16px 32px", fontSize: 18 }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `6px 6px 0 ${C.black}`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>✍️ Rewrite a Pattern</button>
          </div>
        </div>
      </section>

      {/* ── TOOLS ── */}
      <section style={{ padding: "72px 24px", background: `radial-gradient(ellipse at 30% 0%, ${C.cherry}12,transparent 50%), radial-gradient(ellipse at 80% 100%, ${C.royal}10,transparent 50%), #FFF0E0` }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ margin: "0 0 12px", fontFamily: DISPLAY, fontSize: "clamp(30px,5vw,46px)", color: C.choco }}>Two tools. Zero stress.</h2>
            <p style={{ margin: 0, fontSize: 17, color: "#7A4A40", fontFamily: BODY }}>Built for real crocheters with real yarn problems</p>
          </div>
          <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {features.map((f, i) => (
              <div key={i} style={{ ...card, padding: 0, overflow: "hidden", transition: "transform 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                <div style={{ background: f.color, padding: "22px 24px" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>{f.emoji}</div>
                  <h3 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 24, color: C.white }}>{f.title}</h3>
                </div>
                <div style={{ padding: "22px 24px", background: gridBg(C.white) }}>
                  <p style={{ margin: "0 0 22px", fontSize: 15, color: "#4A2A20", lineHeight: 1.75, fontFamily: BODY }}>{f.desc}</p>
                  <button onClick={() => goTo(f.page)} style={{ ...btn(f.color, C.white), padding: "11px 22px", fontSize: 15 }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `6px 6px 0 ${C.black}`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>{f.cta} →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: "72px 24px", background: C.choco }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ margin: "0 0 12px", fontFamily: DISPLAY, fontSize: "clamp(28px,5vw,44px)", color: C.caramel }}>How Fluffle works</h2>
            <p style={{ margin: 0, fontSize: 16, color: "rgba(251,222,156,0.7)", fontFamily: BODY }}>From yarn stash to finished project in minutes</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {howItWorks.map((h, i) => (
              <div key={i} style={{ display: "flex", gap: 22, alignItems: "flex-start", animation: `fadeUp 0.4s ${i * 0.12}s both` }}
                className="fadeUp">
                <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 16, background: i === 0 ? C.cherry : i === 1 ? C.royal : C.mauve, border: `2.5px solid ${C.black}`, boxShadow: `3px 3px 0 ${C.black}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: DISPLAY, fontSize: 20, color: C.white }}>{h.n}</div>
                <div style={{ paddingTop: 4 }}>
                  <h3 style={{ margin: "0 0 6px", fontFamily: DISPLAY, fontSize: 20, color: C.caramel }}>{h.title}</h3>
                  <p style={{ margin: 0, fontSize: 15, color: "rgba(255,248,238,0.75)", lineHeight: 1.7, fontFamily: BODY }}>{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 52 }}>
            <button onClick={() => goTo("rewriter")} style={{ ...btn(C.caramel), padding: "16px 40px", fontSize: 18 }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `6px 6px 0 ${C.black}`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>Get Started — it's free ✨</button>
          </div>
        </div>
      </section>

      {/* ── QUOTE ── */}
      <section style={{ padding: "64px 24px", background: C.mauve + "33", borderTop: `3px solid ${C.black}`, borderBottom: `3px solid ${C.black}` }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧶</div>
          <p style={{ margin: "0 0 16px", fontFamily: DISPLAY, fontSize: "clamp(22px,4vw,32px)", color: C.choco, lineHeight: 1.4 }}>"Made for every crocheter who has ever lost a whole day to yarn maths"</p>
          <p style={{ margin: 0, fontSize: 15, color: "#8A5A50", fontFamily: BODY }}>— the problem that started Fluffle</p>
        </div>
      </section>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABOUT PAGE
// ══════════════════════════════════════════════════════════════════════════════
function AboutPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🐰</div>
        <h1 style={{ margin: "0 0 12px", fontFamily: DISPLAY, fontSize: "clamp(34px,6vw,56px)", color: C.choco }}>About Fluffle</h1>
        <p style={{ margin: 0, fontSize: 17, color: "#7A4A40", fontFamily: BODY, fontStyle: "italic" }}>fluffy little fixes for cozy projects</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {[
          { title: "Where it started 🕷️", bg: C.cherry + "15", border: C.cherry, content: "Fluffle started with a Spider-Man beanie. I found a tutorial I loved, but my yarn was a completely different weight to the one in the video. I spent an entire day manually calculating every stitch count, every row, trying to make my version turn out the same size as hers. By the end I was exhausted — and I hadn't even started crocheting yet. There had to be a better way." },
          { title: "The idea 💡", bg: C.caramel + "55", border: C.caramel, content: "I realised this wasn't just my problem. Every crocheter has experienced it — you find a pattern you love, but your yarn is thicker, your tension is tighter, or you just want it a size bigger. The maths isn't hard, but it's tedious, and it gets in the way of the actual creative joy of making something. Fluffle does that maths for you, instantly." },
          { title: "What Fluffle does 🧶", bg: C.royal + "15", border: C.royal, content: "The Pattern Rewriter takes any crochet pattern and completely rewrites it for your yarn and hook — every row, every stitch count, every design detail like amigurumi eyes or colourwork, all scaled to your exact gauge. The Pixel Grid Generator turns any image into a numbered crochet chart, with serpentine numbering ready to follow stitch by stitch." },
          { title: "Who it's for 🌸", bg: C.mauve + "33", border: C.mauve, content: "Fluffle is for anyone who crochets — total beginners who get confused when a pattern doesn't specify their yarn weight, intermediate makers who want to scale up a cute amigurumi pattern, or experienced crafters who want to finally use up that mystery ball of leftover yarn. If you've ever stared at a pattern wondering how to make it work with what you have, Fluffle is for you." },
        ].map((s, i) => (
          <div key={i} style={{ padding: "22px 26px", background: s.bg, border: `2px solid ${s.border}`, borderRadius: 20, boxShadow: `4px 4px 0 ${s.border}` }}>
            <h2 style={{ margin: "0 0 12px", fontFamily: DISPLAY, fontSize: 22, color: C.choco }}>{s.title}</h2>
            <p style={{ margin: 0, fontSize: 15.5, color: "#3A1A15", lineHeight: 1.85, fontFamily: BODY }}>{s.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTACT PAGE
// ══════════════════════════════════════════════════════════════════════════════
function ContactPage() {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [msg, setMsg] = useState(""); const [sent, setSent] = useState(false);
  const submit = () => { if (name && email && msg) setSent(true); };
  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "56px 24px 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>💌</div>
        <h1 style={{ margin: "0 0 12px", fontFamily: DISPLAY, fontSize: "clamp(30px,6vw,50px)", color: C.choco }}>Say hello!</h1>
        <p style={{ margin: 0, fontSize: 16, color: "#7A4A40", fontFamily: BODY }}>Got feedback, a bug to report, or just want to share what you made? I'd love to hear from you 🧶</p>
      </div>

      {sent ? (
        <div style={{ ...card, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
          <h2 style={{ margin: "0 0 10px", fontFamily: DISPLAY, fontSize: 28, color: C.cherry }}>Message sent!</h2>
          <p style={{ margin: 0, fontSize: 16, color: "#5A3A30", fontFamily: BODY, lineHeight: 1.7 }}>Thanks for reaching out! I'll get back to you soon. Happy crocheting in the meantime 🐰</p>
        </div>
      ) : (
        <div style={{ ...card, padding: "32px 30px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Lbl>Your name</Lbl>
              <Inp value={name} onChange={setName} placeholder="e.g. Sarah" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Lbl>Email address</Lbl>
              <Inp value={email} onChange={setEmail} placeholder="e.g. sarah@example.com" type="email" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Lbl>Message</Lbl>
              <Txa value={msg} onChange={setMsg} rows={5} placeholder="Tell me what you think, what's broken, what you'd love to see, or just share your latest project! 🧶" />
            </div>
            <div style={{ padding: "12px 16px", background: C.caramel + "55", border: `1.5px dashed ${C.black}`, borderRadius: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: C.choco, fontFamily: BODY, lineHeight: 1.6 }}>
                💡 <strong>Bug reports</strong> are especially helpful — if something didn't work as expected, describe what you did and what happened and I'll fix it!
              </p>
            </div>
            <button onClick={submit} disabled={!name || !email || !msg} style={{ ...btn(!name || !email || !msg ? "#ddd" : C.cherry, !name || !email || !msg ? "#aaa" : C.white), padding: "15px", fontSize: 17, boxShadow: name && email && msg ? `5px 5px 0 ${C.black}` : "none", cursor: name && email && msg ? "pointer" : "not-allowed" }}
              onMouseEnter={e => name && email && msg && (e.currentTarget.style.transform = "translate(-2px,-2px)", e.currentTarget.style.boxShadow = `7px 7px 0 ${C.black}`)}
              onMouseLeave={e => (e.currentTarget.style.transform = "none", e.currentTarget.style.boxShadow = name && email && msg ? `5px 5px 0 ${C.black}` : "none")}>
              Send Message 💌
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TOOLS PAGE WRAPPER
// ══════════════════════════════════════════════════════════════════════════════
function ToolsPage({ defaultTool }) {
  const [tool, setTool] = useState(defaultTool || "rewriter");
  const [sharedPixelImg, setSharedPixelImg] = useState(null);
  const tools = [
    { id: "rewriter",  label: "Pattern Rewriter", color: C.cherry },
    { id: "pixel",     label: "Pixel Grid",        color: C.mauve  },
    { id: "pixelart",  label: "Pixel Art",          color: C.royal  },
  ];
  const banners = {
    rewriter:  { bg: C.cherry, text: <>Ever found a tutorial you loved but your yarn is a different weight or size? Instead of spending a whole day doing the maths yourself, <strong style={{ color: C.caramel }}>paste the original pattern, tell me your yarn and hook, and I'll rewrite the entire pattern for you</strong> — every row, every stitch count, every design detail.</> },
    pixel:     { bg: C.mauve,  text: <><strong style={{ color: C.choco }}>Turn any image into a crochet pixel chart</strong> — upload a photo, set your rows and columns, and get a full serpentine-numbered colour grid ready to follow stitch by stitch. Export it as a PNG to use anywhere.</> },
    pixelart:  { bg: C.royal,  text: <><strong style={{ color: C.caramel }}>Convert any photo into pixel art</strong> — adjust the block size to control how chunky the pixels are, then export the result as a PNG. Perfect for planning crochet colour charts or C2C graphs.</> },
  };
  const b = banners[tool] || banners.rewriter;

  const handleExportToGrid = (payload) => {
    setSharedPixelImg(payload);
    setTool("pixel");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 18px 60px" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 28, justifyContent: "center", flexWrap: "wrap" }}>
        {tools.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)} style={{
            padding: "10px 24px", borderRadius: 50, border: `2.5px solid ${tool === t.id ? t.color : "#ccc"}`,
            background: tool === t.id ? t.color : C.white, color: tool === t.id ? (t.id === "pixel" ? C.choco : C.white) : "#999",
            fontFamily: DISPLAY, fontSize: 16, cursor: "pointer",
            boxShadow: tool === t.id ? `4px 4px 0 ${C.black}` : "none",
            transition: "all 0.18s",
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ background: b.bg, border: `2.5px solid ${C.black}`, borderRadius: 18, boxShadow: `4px 4px 0 ${C.black}`, padding: "13px 20px", marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 14.5, color: tool === "pixel" ? C.choco : C.white, lineHeight: 1.75, fontFamily: BODY }}>{b.text}</p>
      </div>
      <div key={tool} className="fadeUp">
        {tool === "rewriter" && <PatternRewriter />}
        {tool === "pixel"    && <PixelGridGenerator sharedImg={sharedPixelImg} onSharedImgUsed={() => setSharedPixelImg(null)} />}
        {tool === "pixelart" && <PixelConverter onExportToGrid={handleExportToGrid} />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PIXEL CONVERTER
// ══════════════════════════════════════════════════════════════════════════════
function PixelConverter({ onExportToGrid }) {
  const [imgData,   setImgData]   = useState(null);
  const [pixelSize, setPixelSize] = useState(10);
  const [numColors, setNumColors] = useState(6);
  const [zoom,      setZoom]      = useState(1);
  const [drag,      setDrag]      = useState(false);
  const fRef        = useRef(null);
  const canvasRef   = useRef(null);
  const gridMetaRef = useRef(null); // exact block counts set after each render

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setImgData(e.target.result);
    reader.readAsDataURL(file);
  };

  // k-means++ initialization + clustering — proper spread prevents patchy snapping
  const kMeans = (colorList, k, iterations = 20) => {
    if (!colorList || colorList.length === 0) return [[0,0,0]];
    k = Math.min(k, colorList.length);
    // k-means++: pick first center randomly, then each next center biased toward farthest point
    const centers = [colorList[Math.floor(colorList.length / 2)].slice()];
    while (centers.length < k) {
      const dists = colorList.map(([r,g,b]) => {
        let minD = Infinity;
        for (const [cr,cg,cb] of centers) {
          const d = (r-cr)**2 + (g-cg)**2 + (b-cb)**2;
          if (d < minD) minD = d;
        }
        return minD;
      });
      const total = dists.reduce((a,b) => a+b, 0);
      let rand = Math.random() * total, chosen = 0;
      for (let i = 0; i < dists.length; i++) { rand -= dists[i]; if (rand <= 0) { chosen = i; break; } }
      centers.push(colorList[chosen].slice());
    }
    for (let iter = 0; iter < iterations; iter++) {
      const sums   = Array.from({ length: k }, () => [0, 0, 0]);
      const counts = new Array(k).fill(0);
      for (const [r, g, b] of colorList) {
        let best = 0, bestD = Infinity;
        for (let ci = 0; ci < k; ci++) {
          const [cr, cg, cb] = centers[ci];
          const d = (r-cr)**2 + (g-cg)**2 + (b-cb)**2;
          if (d < bestD) { bestD = d; best = ci; }
        }
        sums[best][0] += r; sums[best][1] += g; sums[best][2] += b; counts[best]++;
      }
      for (let ci = 0; ci < k; ci++) {
        if (counts[ci] > 0) {
          centers[ci] = [Math.round(sums[ci][0]/counts[ci]), Math.round(sums[ci][1]/counts[ci]), Math.round(sums[ci][2]/counts[ci])];
        }
      }
    }
    return centers;
  };

  const nearestCenter = (r, g, b, centers) => {
    let best = 0, bestD = Infinity;
    for (let ci = 0; ci < centers.length; ci++) {
      const [cr, cg, cb] = centers[ci];
      const d = (r-cr)**2 + (g-cg)**2 + (b-cb)**2;
      if (d < bestD) { bestD = d; best = ci; }
    }
    return centers[best];
  };

  useEffect(() => {
    if (!imgData) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      const maxDisplay = 800;
      const scale  = maxDisplay / Math.max(img.naturalWidth, img.naturalHeight);
      const displayW = Math.round(img.naturalWidth  * scale);
      const displayH = Math.round(img.naturalHeight * scale);

      const blocksW = Math.max(1, Math.round(displayW / pixelSize));
      const blocksH = Math.max(1, Math.round(displayH / pixelSize));

      // Step 1: draw full image at display size into offscreen canvas
      const src = document.createElement("canvas");
      src.width  = displayW;
      src.height = displayH;
      const sctx = src.getContext("2d");
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = "high";
      sctx.drawImage(img, 0, 0, displayW, displayH);
      const srcPx = sctx.getImageData(0, 0, displayW, displayH).data;

      // Step 2: adaptive sampling per block
      // Small blocks (≤15px): sample a 3x3 center grid — fast and accurate
      // Large blocks (>15px): sample inner 60% of the block zone, pick the most frequent color
      // Both approaches avoid edge pixels / grid lines that contaminate averages
      const blockColors = new Array(blocksH * blocksW);
      const bW = displayW / blocksW;
      const bH = displayH / blocksH;
      const isLarge = pixelSize > 15;

      for (let r = 0; r < blocksH; r++) {
        for (let c = 0; c < blocksW; c++) {
          const x0 = c * bW, x1 = (c + 1) * bW;
          const y0 = r * bH, y1 = (r + 1) * bH;

          let samples = [];

          if (!isLarge) {
            // Small blocks: just sample 3×3 points centered in block
            for (let sy = 0; sy < 3; sy++) {
              for (let sx = 0; sx < 3; sx++) {
                const px = Math.min(displayW - 1, Math.round(x0 + bW * (sx + 1) / 4));
                const py = Math.min(displayH - 1, Math.round(y0 + bH * (sy + 1) / 4));
                const i  = (py * displayW + px) * 4;
                samples.push([srcPx[i], srcPx[i+1], srcPx[i+2]]);
              }
            }
          } else {
            // Large blocks: sample inner 60% zone on a regular grid (5×5 points)
            const margin = 0.2; // skip outer 20% on each side
            for (let sy = 0; sy < 5; sy++) {
              for (let sx = 0; sx < 5; sx++) {
                const fx = margin + (sx / 4) * (1 - 2 * margin);
                const fy = margin + (sy / 4) * (1 - 2 * margin);
                const px = Math.min(displayW - 1, Math.round(x0 + bW * fx));
                const py = Math.min(displayH - 1, Math.round(y0 + bH * fy));
                const i  = (py * displayW + px) * 4;
                samples.push([srcPx[i], srcPx[i+1], srcPx[i+2]]);
              }
            }
          }

          // Pick most frequent color among samples (binned to nearest 32 to handle minor variation)
          const freq = {};
          let bestKey = null, bestCount = 0;
          for (const [sr, sg, sb] of samples) {
            const key = `${sr >> 5},${sg >> 5},${sb >> 5}`;
            freq[key] = (freq[key] || { count: 0, r: sr, g: sg, b: sb });
            freq[key].count++;
            if (freq[key].count > bestCount) { bestCount = freq[key].count; bestKey = key; }
          }
          const best = freq[bestKey];
          blockColors[r * blocksW + c] = [best.r, best.g, best.b];
        }
      }

      // Step 3: k-means quantize — snap every block to one of N solid palette colors
      const palette = kMeans(blockColors, Math.min(numColors, blocksW * blocksH));

      // Step 4: layout — display block size uses zoom
      const HEADER       = 28;
      const BLOCK_SCREEN = Math.max(18, pixelSize) * zoom;
      const blockW       = BLOCK_SCREEN;
      const blockH       = BLOCK_SCREEN;
      const dpr          = window.devicePixelRatio || 1;
      const totalW       = HEADER + blocksW * blockW;
      const totalH       = HEADER + blocksH * blockH;

      // Store exact counts so exportToGrid can use them
      gridMetaRef.current = { blocksW, blocksH, HEADER, blockW, blockH };

      canvas.width  = totalW * dpr;
      canvas.height = totalH * dpr;
      canvas.style.width  = totalW + "px";
      canvas.style.height = totalH + "px";

      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;

      // Fill entire canvas white first — no transparent gaps ever show through
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, totalW, totalH);

      // Step 5: draw each block as a 100% opaque solid color — no rgba, no blending
      for (let r = 0; r < blocksH; r++) {
        for (let c = 0; c < blocksW; c++) {
          const [R, G, B] = nearestCenter(...blockColors[r * blocksW + c], palette);
          ctx.fillStyle = `rgb(${R},${G},${B})`;
          ctx.fillRect(HEADER + c * blockW, HEADER + r * blockH, blockW, blockH);
        }
      }

      // Step 6: grid lines
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      for (let c = 0; c <= blocksW; c++) {
        const x = HEADER + c * blockW;
        ctx.beginPath(); ctx.moveTo(x, HEADER); ctx.lineTo(x, HEADER + blocksH * blockH); ctx.stroke();
      }
      for (let r = 0; r <= blocksH; r++) {
        const y = HEADER + r * blockH;
        ctx.beginPath(); ctx.moveTo(HEADER, y); ctx.lineTo(HEADER + blocksW * blockW, y); ctx.stroke();
      }

      // Step 7: column headers
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const colFs = Math.max(7, Math.min(blockW * 0.55, HEADER - 4));
      ctx.font = `bold ${colFs}px Arial, sans-serif`;
      for (let c = 0; c < blocksW; c++) {
        ctx.fillStyle = c % 2 === 0 ? "rgba(251,222,156,0.9)" : "rgba(251,222,156,0.55)";
        ctx.fillRect(HEADER + c * blockW, 0, blockW, HEADER);
        ctx.fillStyle = "#2A0A0E";
        ctx.fillText(String(c + 1), HEADER + c * blockW + blockW / 2, HEADER / 2);
      }

      // Step 8: row headers
      const rowFs = Math.max(7, Math.min(blockH * 0.55, HEADER - 4));
      ctx.font = `bold ${rowFs}px Arial, sans-serif`;
      for (let r = 0; r < blocksH; r++) {
        ctx.fillStyle = r % 2 === 0 ? "rgba(234,157,174,0.9)" : "rgba(234,157,174,0.55)";
        ctx.fillRect(0, HEADER + r * blockH, HEADER, blockH);
        ctx.fillStyle = "#2A0A0E";
        ctx.fillText(String(r + 1), HEADER / 2, HEADER + r * blockH + blockH / 2);
      }

      // Corner
      ctx.fillStyle = "#45151B";
      ctx.fillRect(0, 0, HEADER, HEADER);
    };
    img.src = imgData;
  }, [imgData, pixelSize, numColors, zoom]);

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `pixel-art-${pixelSize}px-${numColors}colors.png`;
    a.href = canvas.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportToGrid = () => {
    const canvas  = canvasRef.current;
    const meta    = gridMetaRef.current;
    if (!canvas || !meta || !onExportToGrid) return;
    const { blocksW, blocksH, HEADER, blockW, blockH } = meta;
    const dpr = window.devicePixelRatio || 1;

    // Strip the header — create a clean canvas with ONLY the pixel art blocks
    const clean = document.createElement("canvas");
    clean.width  = blocksW * blockW * dpr;
    clean.height = blocksH * blockH * dpr;
    const cctx = clean.getContext("2d");
    // Copy just the block area (skip the HEADER px of labels)
    cctx.drawImage(
      canvas,
      HEADER * dpr, HEADER * dpr,                  // source x,y (skip header)
      blocksW * blockW * dpr, blocksH * blockH * dpr, // source w,h
      0, 0,                                          // dest x,y
      blocksW * blockW * dpr, blocksH * blockH * dpr  // dest w,h
    );
    onExportToGrid({ dataUrl: clean.toDataURL("image/png"), blocksW, blocksH });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ ...card, padding: "28px 30px" }}>
        <div style={{ background: C.royal, padding: "10px 22px", margin: "-28px -30px 22px", borderBottom: `2.5px solid ${C.black}`, borderRadius: "22px 22px 0 0" }}>
          <h2 style={{ margin: 0, color: C.white, fontFamily: DISPLAY, fontSize: 20 }}>🖼️ Image to Pixel Art</h2>
        </div>

        <p style={{ margin: "0 0 16px", fontSize: 14.5, color: C.black, lineHeight: 1.7, fontFamily: BODY }}>
          Upload any photo and convert it into a <strong>pixel art version</strong> — great for planning crochet colour charts or C2C graphs.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => fRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
          style={{ border: `2.5px dashed ${drag ? C.royal : imgData ? C.royal : C.black}`, borderRadius: 18, cursor: "pointer", overflow: "hidden", marginBottom: 20, background: drag ? C.royal+"18" : imgData ? C.royal+"0C" : gridBg(C.cream), padding: imgData ? 0 : "40px 24px", textAlign: "center", boxShadow: `3px 3px 0 ${drag ? C.royal : C.black}`, transition: "all 0.2s" }}>
          <input ref={fRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) { handleFile(e.target.files[0]); e.target.value = ""; } }} />
          {imgData ? (
            <div>
              <img src={imgData} alt="preview" style={{ width: "100%", maxHeight: 180, objectFit: "contain", display: "block" }} />
              <div style={{ padding: "8px 16px", background: C.royal+"22", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: BODY, fontSize: 13, color: C.choco, fontWeight: 700 }}>✅ Image loaded</span>
                <button onClick={e => { e.stopPropagation(); fRef.current?.click(); }} style={{ ...btn(C.white), padding: "4px 12px", fontSize: 12 }}>Change</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🖼️</div>
              <p style={{ margin: "0 0 4px", fontSize: 18, fontFamily: DISPLAY, color: C.choco }}>Drop your image here</p>
              <p style={{ margin: 0, fontSize: 13, color: "#999", fontFamily: BODY }}>Any photo — jpg, png, etc.</p>
            </>
          )}
        </div>

        {/* Pixel size slider */}
        <div style={{ padding: "16px 18px", background: C.caramel+"44", border: `1.5px dashed ${C.black}`, borderRadius: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Lbl>Pixel Block Size</Lbl>
            <span style={{ fontFamily: DISPLAY, fontSize: 18, color: C.choco }}>{pixelSize}px</span>
          </div>
          <input type="range" min={1} max={25} step={1} value={pixelSize} onChange={e => setPixelSize(Number(e.target.value))}
            style={{ width: "100%", accentColor: C.royal, cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "#999", fontFamily: BODY }}>1px — very detailed</span>
            <span style={{ fontSize: 11, color: "#999", fontFamily: BODY }}>25px — chunky blocks</span>
          </div>
        </div>

        {/* Colour count slider */}
        <div style={{ padding: "16px 18px", background: C.mauve+"33", border: `1.5px dashed ${C.mauve}`, borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Lbl color={C.choco}>Number of Colours</Lbl>
            <span style={{ fontFamily: DISPLAY, fontSize: 18, color: C.choco }}>{numColors}</span>
          </div>
          <input type="range" min={2} max={16} step={1} value={numColors} onChange={e => setNumColors(Number(e.target.value))}
            style={{ width: "100%", accentColor: C.mauve, cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "#999", fontFamily: BODY }}>2 — two flat colours</span>
            <span style={{ fontSize: 11, color: "#999", fontFamily: BODY }}>16 — rich palette</span>
          </div>
        </div>
      </div>

      {/* Output */}
      {imgData && (
        <div style={{ ...card, padding: "28px 30px" }} className="fadeUp">
          <div style={{ background: C.royal, padding: "10px 22px", margin: "-28px -30px 18px", borderBottom: `2.5px solid ${C.black}`, borderRadius: "22px 22px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0, color: C.white, fontFamily: DISPLAY, fontSize: 18 }}>Pixel Art Preview</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {/* Zoom buttons */}
              <div style={{ display: "flex", border: `2px solid ${C.black}`, borderRadius: 50, overflow: "hidden", boxShadow: `3px 3px 0 ${C.black}` }}>
                <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} style={{ padding: "5px 12px", background: C.white, border: "none", cursor: "pointer", fontFamily: DISPLAY, fontSize: 15, borderRight: `1px solid ${C.black}` }}>−</button>
                <span style={{ padding: "5px 10px", background: C.caramel, fontFamily: DISPLAY, fontSize: 12, color: C.choco }}>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} style={{ padding: "5px 12px", background: C.white, border: "none", cursor: "pointer", fontFamily: DISPLAY, fontSize: 15, borderLeft: `1px solid ${C.black}` }}>+</button>
              </div>
              <button onClick={exportPNG}
                style={{ ...btn(C.choco, C.caramel), padding: "5px 14px", fontSize: 13 }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `5px 5px 0 ${C.black}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>
                ⬇️ Export PNG
              </button>
              <button onClick={exportToGrid}
                style={{ ...btn(C.mauve), padding: "5px 14px", fontSize: 13 }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `5px 5px 0 ${C.black}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>
                🧩 Send to Pixel Grid →
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "82vh", border: `2px solid ${C.black}`, borderRadius: 10, background: "#111" }}>
            <canvas ref={canvasRef} style={{ display: "block" }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
function generateSerpentine(rows, cols, reversed = false) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const ltr = reversed ? r % 2 !== 0 : r % 2 === 0;
    const row = ltr
      ? Array.from({ length: cols }, (_, c) => c + 1)
      : Array.from({ length: cols }, (_, c) => cols - c);
    grid.push(row);
  }
  return grid;
}

// ══════════════════════════════════════════════════════════════════════════════
// PIXEL GRID GENERATOR
// ══════════════════════════════════════════════════════════════════════════════
function PixelGridGenerator({ sharedImg, onSharedImgUsed }) {
  const [imgData,   setImgData]   = useState(null);
  const [rows,      setRows]      = useState("");
  const [cols,      setCols]      = useState("");
  const [reversed,  setReversed]  = useState(false);
  const [zoom,      setZoom]      = useState(1);
  const [detecting, setDetecting] = useState(false);
  const [autoMsg,   setAutoMsg]   = useState("");
  const [drag,      setDrag]      = useState(false);
  const [linesFracX, setLinesFracX] = useState(null);
  const [linesFracY, setLinesFracY] = useState(null);
  const fRef      = useRef(null);
  const canvasRef = useRef(null);

  // Auto-load image sent from Pixel Art tool
  useEffect(() => {
    if (!sharedImg) return;
    // sharedImg is either a plain dataUrl (old path) or { dataUrl, blocksW, blocksH }
    const isObj   = typeof sharedImg === "object";
    const dataUrl = isObj ? sharedImg.dataUrl : sharedImg;
    setImgData(dataUrl);
    setAutoMsg("");
    setLinesFracX(null);
    setLinesFracY(null);
    if (isObj && sharedImg.blocksW && sharedImg.blocksH) {
      // Exact counts from pixel art — no detection needed, perfect alignment guaranteed
      setCols(String(sharedImg.blocksW));
      setRows(String(sharedImg.blocksH));
      setAutoMsg(`✅ ${sharedImg.blocksW} columns × ${sharedImg.blocksH} rows from Pixel Art`);
      setDetecting(false);
    } else {
      setRows(""); setCols("");
      autoDetect(dataUrl);
    }
    if (onSharedImgUsed) onSharedImgUsed();
  }, [sharedImg]);

  const numRows = Math.max(1, Math.min(500, Number(rows) || 1));
  const numCols = Math.max(1, Math.min(500, Number(cols) || 1));

  // ── Auto-detect: autocorrelation finds the TRUE cell period ─────────────────
  const autoDetect = (dataUrl) => {
    setDetecting(true);
    setAutoMsg("Scanning image for grid lines…");
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const off = document.createElement("canvas");
      off.width = W; off.height = H;
      const ctx = off.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, W, H).data;

      // Average brightness per column and row
      const colVal = Array.from({ length: W }, (_, x) => {
        let s = 0, n = 0;
        const step = Math.max(1, Math.floor(H / 100));
        for (let y = 0; y < H; y += step) { const i=(y*W+x)*4; s+=(px[i]+px[i+1]+px[i+2])/3; n++; }
        return s / n;
      });
      const rowVal = Array.from({ length: H }, (_, y) => {
        let s = 0, n = 0;
        const step = Math.max(1, Math.floor(W / 100));
        for (let x = 0; x < W; x += step) { const i=(y*W+x)*4; s+=(px[i]+px[i+1]+px[i+2])/3; n++; }
        return s / n;
      });

      // Normalised autocorrelation — finds the dominant PERIOD of the signal
      // This works regardless of grid color (dark lines, light lines, any pattern)
      const findPeriod = (signal, size) => {
        const mean = signal.reduce((a,b)=>a+b,0)/signal.length;
        const c    = signal.map(v => v - mean);
        const var0 = c.reduce((a,v)=>a+v*v,0);
        if (var0 < 1) return null;

        let bestLag = 0, bestCorr = -Infinity;
        const maxLag = Math.floor(size / 2);
        for (let lag = 3; lag <= maxLag; lag++) {
          let corr = 0;
          for (let i = 0; i < signal.length - lag; i++) corr += c[i] * c[i+lag];
          corr /= var0;
          if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
        }
        // Must be meaningfully periodic — correlation above 0.15
        return bestCorr > 0.15 ? Math.max(2, Math.round(size / Math.round(size / bestLag))) : null;
      };

      const detectedCols = findPeriod(colVal, W);
      const detectedRows = findPeriod(rowVal, H);

      if (detectedCols && detectedRows) {
        setCols(String(detectedCols));
        setRows(String(detectedRows));
        setAutoMsg(`✅ Detected ${detectedCols} columns × ${detectedRows} rows`);
      } else {
        setCols(""); setRows("");
        setAutoMsg("⚠️ Could not detect grid — enter rows and columns manually");
      }
      setDetecting(false);
    };
    img.onerror = () => { setAutoMsg("Could not scan image"); setDetecting(false); };
    img.src = dataUrl;
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setImgData(dataUrl);
      setRows(""); setCols(""); setAutoMsg(""); setLinesFracX(null); setLinesFracY(null);
      autoDetect(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // ── Canvas: image untouched, clean even grid overlay ─────────────────────
  useEffect(() => {
    if (!imgData || !rows || !cols || detecting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const baseScale = Math.min(1, 900 / Math.max(naturalW, naturalH));
      const displayW  = Math.round(naturalW * baseScale * zoom);
      const displayH  = Math.round(naturalH * baseScale * zoom);
      const LABEL_W   = 36;
      const dpr       = window.devicePixelRatio || 1;

      canvas.width  = (displayW + LABEL_W) * dpr;
      canvas.height = displayH * dpr;
      canvas.style.width  = (displayW + LABEL_W) + "px";
      canvas.style.height = displayH + "px";

      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // 1. Draw image — never distorted
      ctx.drawImage(img, 0, 0, displayW, displayH);

      // 2. Always even spacing
      const cellW = displayW / numCols;
      const cellH = displayH / numRows;

      // 3. Grid lines — draw twice: white then black so they're visible on ANY background
      ctx.lineWidth = 1;
      for (let c = 0; c <= numCols; c++) {
        const x = Math.round(c * cellW) + 0.5;
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath(); ctx.moveTo(x - 0.5, 0); ctx.lineTo(x - 0.5, displayH); ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, displayH); ctx.stroke();
      }
      for (let r = 0; r <= numRows; r++) {
        const y = Math.round(r * cellH) + 0.5;
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath(); ctx.moveTo(0, y - 0.5); ctx.lineTo(displayW, y - 0.5); ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(displayW, y); ctx.stroke();
      }

      // 4. Serpentine numbers — visible at any cell size
      const grid = generateSerpentine(numRows, numCols, reversed);
      const fs   = Math.max(9, Math.min(cellW * 0.55, cellH * 0.55, 20));

      if (cellW >= 8 && cellH >= 8) {
        ctx.save();
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.font         = `bold ${fs}px Arial, sans-serif`;
        ctx.lineJoin     = "round";
        ctx.lineWidth    = Math.max(2, fs * 0.22);
        for (let r = 0; r < numRows; r++) {
          for (let c = 0; c < numCols; c++) {
            const cx  = Math.round(c * cellW) + cellW / 2;
            const cy  = Math.round(r * cellH) + cellH / 2;
            const num = String(grid[r][c]);
            ctx.strokeStyle = "rgba(0,0,0,0.95)";
            ctx.strokeText(num, cx, cy);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(num, cx, cy);
          }
        }
        ctx.restore();
      }

      // 5. Direction strip: caramel = L→R, mauve = R←L
      for (let r = 0; r < numRows; r++) {
        const ltr = reversed ? r % 2 !== 0 : r % 2 === 0;
        const y   = Math.round(r * cellH);
        const h   = Math.round(cellH);
        ctx.fillStyle = ltr ? "rgba(251,222,156,0.95)" : "rgba(234,157,174,0.95)";
        ctx.fillRect(displayW, y, LABEL_W, h);
        ctx.strokeStyle = "rgba(69,21,27,0.3)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(displayW, y, LABEL_W, h);
        const lfs = Math.max(9, Math.min(h - 2, 16));
        ctx.font = `bold ${lfs}px Arial, sans-serif`;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.strokeText(ltr ? "→" : "←", displayW + LABEL_W / 2, y + h / 2);
        ctx.fillStyle = "#45151B";
        ctx.fillText(ltr ? "→" : "←", displayW + LABEL_W / 2, y + h / 2);
      }
    };
    img.src = imgData;
  }, [imgData, numRows, numCols, zoom, reversed, detecting]);

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `pixel-grid-${numRows}x${numCols}.png`;
    a.href = canvas.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── UPLOAD + SETTINGS ── */}
      <div style={{ ...card, padding: "28px 30px" }}>
        <div style={{ background: C.mauve, padding: "10px 22px", margin: "-28px -30px 22px", borderBottom: `2.5px solid ${C.black}`, borderRadius: "22px 22px 0 0" }}>
          <h2 style={{ margin: 0, color: C.choco, fontFamily: DISPLAY, fontSize: 20 }}>🎨 Pixel Grid Generator</h2>
        </div>

        <p style={{ margin: "0 0 16px", fontSize: 14.5, color: C.black, lineHeight: 1.7, fontFamily: BODY }}>
          Upload your pixel grid image — rows and columns are <strong>auto-detected from the grid lines</strong>. Numbers are then overlaid in serpentine order automatically.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => fRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
          style={{ border: `2.5px dashed ${drag ? C.mauve : imgData ? C.mauve : C.black}`, borderRadius: 18, cursor: "pointer", overflow: "hidden", marginBottom: 16, background: drag ? C.mauve+"18" : imgData ? C.mauve+"0C" : gridBg(C.cream), padding: imgData ? 0 : "40px 24px", textAlign: "center", boxShadow: `3px 3px 0 ${drag ? C.mauve : C.black}`, transition: "all 0.2s" }}>
          <input ref={fRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) { handleFile(e.target.files[0]); e.target.value = ""; } }} />
          {imgData ? (
            <div>
              <img src={imgData} alt="preview" style={{ width: "100%", maxHeight: 200, objectFit: "contain", display: "block" }} />
              <div style={{ padding: "8px 16px", background: detecting ? C.caramel+"88" : C.mauve+"33", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: BODY, fontSize: 13, color: C.choco, fontWeight: 700 }}>
                  {detecting ? "🔍 Scanning for grid lines…" : autoMsg || "✅ Image loaded"}
                </span>
                <button onClick={e => { e.stopPropagation(); fRef.current?.click(); }} style={{ ...btn(C.white), padding: "4px 12px", fontSize: 12, flexShrink: 0 }}>Change</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🖼️</div>
              <p style={{ margin: "0 0 4px", fontSize: 18, fontFamily: DISPLAY, color: C.choco }}>Drop your pixel grid image here</p>
              <p style={{ margin: 0, fontSize: 13, color: "#999", fontFamily: BODY }}>Grid lines are detected automatically — jpg or png</p>
            </>
          )}
        </div>

        {/* Auto-detected values — editable if wrong */}
        <div style={{ marginBottom: 16, padding: "14px 16px", background: C.caramel+"44", border: `1.5px dashed ${C.black}`, borderRadius: 14 }}>
          <p style={{ margin: "0 0 10px", fontFamily: DISPLAY, fontSize: 14, color: C.choco }}>
            Grid size — auto-detected, edit if needed
          </p>
          <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <Lbl>Rows</Lbl>
              <Inp value={rows} onChange={setRows} placeholder="auto-detecting…" type="number" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <Lbl>Columns</Lbl>
              <Inp value={cols} onChange={setCols} placeholder="auto-detecting…" type="number" />
            </div>
          </div>
          {rows && cols && !detecting && (
            <p style={{ margin: "10px 0 0", fontFamily: BODY, fontSize: 12, color: C.choco }}>
              {numRows} × {numCols} = {numRows * numCols} stitches total
            </p>
          )}
        </div>

        {/* Zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Lbl>Zoom</Lbl>
          <div style={{ display: "flex", border: `2px solid ${C.black}`, borderRadius: 50, overflow: "hidden", boxShadow: `3px 3px 0 ${C.black}` }}>
            <button onClick={() => setZoom(z => Math.max(0.2, +(z-0.1).toFixed(1)))} style={{ padding: "5px 14px", background: C.white, border: "none", cursor: "pointer", fontFamily: DISPLAY, fontSize: 16, borderRight: `1px solid ${C.black}` }}>−</button>
            <span style={{ padding: "5px 12px", background: C.caramel, fontFamily: DISPLAY, fontSize: 13 }}>{Math.round(zoom*100)}%</span>
            <button onClick={() => setZoom(z => Math.min(5, +(z+0.1).toFixed(1)))} style={{ padding: "5px 14px", background: C.white, border: "none", cursor: "pointer", fontFamily: DISPLAY, fontSize: 16, borderLeft: `1px solid ${C.black}` }}>+</button>
          </div>
        </div>

        {/* Reverse direction toggle */}
        <div onClick={() => setReversed(r => !r)}
          style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 14, border: `2px solid ${reversed ? C.mauve : C.black}`, background: reversed ? C.mauve+"22" : C.white, cursor: "pointer", boxShadow: `2px 2px 0 ${reversed ? C.mauve : C.black}`, userSelect: "none" }}>
          <div style={{ width: 38, height: 22, borderRadius: 11, background: reversed ? C.mauve : "#ccc", border: `2px solid ${C.black}`, position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: reversed ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: C.white, border: `1.5px solid ${C.black}`, transition: "left 0.2s" }} />
          </div>
          <div>
            <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 14, color: C.choco }}>Reverse Direction</p>
            <p style={{ margin: 0, fontFamily: BODY, fontSize: 11, color: "#888" }}>Row 1 starts right → left</p>
          </div>
        </div>
      </div>

      {/* ── CANVAS OUTPUT ── */}
      {imgData && rows && cols && !detecting && (
        <div style={{ ...card, padding: "28px 30px" }} className="fadeUp">
          <div style={{ background: C.mauve, padding: "10px 22px", margin: "-28px -30px 18px", borderBottom: `2.5px solid ${C.black}`, borderRadius: "22px 22px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0, color: C.choco, fontFamily: DISPLAY, fontSize: 18 }}>
              {numRows} × {numCols} grid · {numRows * numCols} stitches
            </h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ padding: "4px 12px", background: C.caramel + "88", border: `1.5px dashed ${C.black}`, borderRadius: 8, fontFamily: BODY, fontSize: 12, color: C.choco }}>
                🟨 Caramel = left→right
              </span>
              <span style={{ padding: "4px 12px", background: C.mauve + "44", border: `1.5px dashed ${C.mauve}`, borderRadius: 8, fontFamily: BODY, fontSize: 12, color: C.choco }}>
                🌸 Mauve = right←left
              </span>
              <button onClick={exportPNG}
                style={{ ...btn(C.choco, C.caramel), padding: "5px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `5px 5px 0 ${C.black}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>
                ⬇️ Export PNG
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "82vh", border: `2px solid ${C.black}`, borderRadius: 10, background: "#111" }}>
            <canvas
              ref={canvasRef}
              style={{ display: "block" }}
            />
          </div>

          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#999", fontFamily: BODY, textAlign: "center" }}>
            Numbers follow serpentine order · if alignment is off, adjust rows/cols above · use Export PNG to save
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP SHELL
// ══════════════════════════════════════════════════════════════════════════════
const NAV_LINKS = [
  { id: "home",      label: "Home" },
  { id: "rewriter",  label: "Pattern Rewriter" },
  { id: "pixel",     label: "Pixel Grid" },
  { id: "pixelart",  label: "Pixel Art" },
  { id: "about",     label: "About" },
  { id: "contact",   label: "Contact" },
];

export default function App() {
  const [page, setPage] = useState("home");
  const [mobileOpen, setMobileOpen] = useState(false);

  const goTo = (p) => { setPage(p); setMobileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const isToolPage = page === "rewriter" || page === "pixel" || page === "pixelart";

  return (
    <div style={{ minHeight: "100vh", fontFamily: BODY, background: "#FFF0E0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap');
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0;transform:translateY(18px); } to { opacity:1;transform:translateY(0); } }
        @keyframes dot    { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        @keyframes wiggle { 0%,100%{transform:rotate(-3deg)} 50%{transform:rotate(3deg)} }
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: #c9a898; font-family: 'Nunito', sans-serif; }
        .fadeUp { animation: fadeUp 0.38s cubic-bezier(0.16,1,0.3,1) both; }
        @media(max-width:600px){ .two-col { grid-template-columns: 1fr !important; } }
        a { color: inherit; text-decoration: none; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ background: C.choco, borderBottom: `4px solid ${C.black}`, padding: "0 28px", position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        {/* Logo */}
        <button onClick={() => goTo("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 0 }}>
          <span style={{ fontSize: 22, animation: "wiggle 3s ease-in-out infinite", display: "inline-block" }}>✨</span>
          <span style={{ fontFamily: DISPLAY, fontSize: 26, color: C.white, letterSpacing: "1px" }}>Fluffle</span>
          <span style={{ fontSize: 22, animation: "wiggle 3s ease-in-out 1.5s infinite", display: "inline-block" }}>✨</span>
        </button>

        {/* Desktop nav */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }} className="desktop-nav">
          {NAV_LINKS.map(l => (
            <button key={l.id} onClick={() => goTo(l.id)} style={{
              background: page === l.id ? C.caramel : "transparent",
              color: page === l.id ? C.choco : "rgba(251,222,156,0.75)",
              border: page === l.id ? `2px solid ${C.black}` : "2px solid transparent",
              borderRadius: 50, padding: "7px 16px", fontFamily: DISPLAY, fontSize: 14,
              cursor: "pointer", transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (page !== l.id) e.currentTarget.style.color = C.caramel; }}
              onMouseLeave={e => { if (page !== l.id) e.currentTarget.style.color = "rgba(251,222,156,0.75)"; }}
            >{l.label}</button>
          ))}
        </div>
      </nav>

      {/* ── PAGE CONTENT ── */}
      <main key={page} className="fadeUp">
        {page === "home"    && <HomePage goTo={goTo} />}
        {isToolPage         && <ToolsPage defaultTool={page} />}
        {page === "about"   && <AboutPage />}
        {page === "contact" && <ContactPage />}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ background: C.choco, borderTop: `4px solid ${C.black}`, padding: "36px 28px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>✨</span>
          <span style={{ fontFamily: DISPLAY, fontSize: 22, color: C.white }}>Fluffle</span>
          <span style={{ fontSize: 20 }}>✨</span>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "rgba(251,222,156,0.6)", fontFamily: BODY }}>fluffy little fixes for cozy projects</p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          {NAV_LINKS.map(l => (
            <button key={l.id} onClick={() => goTo(l.id)} style={{ background: "none", border: "none", color: "rgba(251,222,156,0.5)", fontFamily: BODY, fontSize: 13, cursor: "pointer", padding: 0, transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = C.caramel}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(251,222,156,0.5)"}>{l.label}</button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(251,222,156,0.3)", fontFamily: BODY }}>Made with 🧶 for every crocheter who has ever lost a day to maths</p>
      </footer>
    </div>
  );
}
