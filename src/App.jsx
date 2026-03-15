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
// YARN SCANNER — no external libraries, works on iPhone natively
// ══════════════════════════════════════════════════════════════════════════════
function YarnScanner() {
  const [imgUrl,  setImgUrl]  = useState(null);
  const [imgFile, setImgFile] = useState(null);
  const [imgName, setImgName] = useState("");
  const [notes,   setNotes]   = useState("");
  const [phase,   setPhase]   = useState("upload");
  const [converting, setConverting] = useState(false);
  const [yarnInfo,  setYarnInfo]  = useState(null);
  const [projects,  setProjects]  = useState([]);
  const [patterns,  setPatterns]  = useState(null);
  const [chosen,    setChosen]    = useState(null);
  const [error,     setError]     = useState("");
  const [drag,      setDrag]      = useState(false);
  const fRef = useRef(null);
  const rRef = useRef(null);

  // Convert any image file to base64 JPEG safe for the Anthropic API.
  // Strategy:
  //   1. Try canvas.toBlob — works for jpg/png/webp/gif everywhere,
  //      and for HEIC on iOS (iOS decodes HEIC at OS level) and macOS Safari.
  //   2. If canvas fails (HEIC on desktop Chrome) → reject with helpful message.
  const toJpegBase64 = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const MAX = 1200;
        let w = img.naturalWidth  || 800;
        let h = img.naturalHeight || 600;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Canvas returned empty blob")); return; }
          const reader = new FileReader();
          reader.onload = (e) => {
            const data = e.target.result;
            if (!data || !data.includes(",")) { reject(new Error("Could not read converted image")); return; }
            resolve({ base64: data.split(",")[1], mediaType: "image/jpeg" });
          };
          reader.onerror = () => reject(new Error("Could not read converted image"));
          reader.readAsDataURL(blob);
        }, "image/jpeg", 0.85);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const n = file.name.toLowerCase();
      const isHeic = file.type === "image/heic" || file.type === "image/heif"
        || n.endsWith(".heic") || n.endsWith(".heif");
      if (isHeic) {
        reject(new Error(
          "HEIC_DESKTOP: Your browser cannot process HEIC files. " +
          "Please open the photo on your iPhone, tap Share → Save to Files, " +
          "then upload that file — or take a screenshot instead (screenshots are always JPG)."
        ));
      } else {
        reject(new Error("Could not decode this image. Please try a JPG or PNG."));
      }
    };
    img.src = url;
  });

  const handleFile = async (f) => {
    if (!f) return;
    setError(""); setConverting(false);
    const n = f.name.toLowerCase();
    const ok = f.type.startsWith("image/")
      || n.endsWith(".heic") || n.endsWith(".heif")
      || n.endsWith(".jpg")  || n.endsWith(".jpeg")
      || n.endsWith(".png")  || n.endsWith(".webp");
    if (!ok) { setError("Please upload a photo — jpg, png, webp, or heic."); return; }

    // Show preview immediately
    setImgUrl(URL.createObjectURL(f));
    setImgName(f.name);
    setYarnInfo(null); setProjects([]); setPatterns(null);
    setChosen(null); setPhase("upload"); setConverting(true);

    // Convert to JPEG in background
    try {
      const { base64, mediaType } = await toJpegBase64(f);
      // Store a Blob so we can read it cleanly at scan time
      const jpegBlob = await fetch("data:image/jpeg;base64," + base64).then(r => r.blob());
      setImgFile(new File([jpegBlob], n.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"), { type: "image/jpeg" }));
      setConverting(false);
    } catch (e) {
      setConverting(false);
      if (e.message.startsWith("HEIC_DESKTOP")) {
        setError(e.message.replace("HEIC_DESKTOP: ", ""));
        setImgUrl(null); setImgName("");
      } else {
        // Still set file — scan will try again and show error if needed
        setImgFile(f);
      }
    }
  };

  const scan = async () => {
    if (!imgFile) { setError("Please upload a photo first!"); return; }
    setError(""); setPhase("scanning");
    setTimeout(() => rRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

    // Read the (already-converted) file as base64
    let base64, mediaType;
    try {
      const result = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = e.target.result;
          if (!data || !data.includes(",")) { reject(new Error("Empty file")); return; }
          resolve({ base64: data.split(",")[1], mediaType: imgFile.type || "image/jpeg" });
        };
        reader.onerror = () => reject(new Error("FileReader failed"));
        reader.readAsDataURL(imgFile);
      });
      base64 = result.base64; mediaType = result.mediaType;
    } catch (e) {
      setError("Could not read your photo — please try again.");
      setPhase("upload"); return;
    }

    const SYS = `You are a crochet yarn expert. Look at the yarn in this photo and respond with ONLY a JSON object — no other text, no markdown, no code fences.

Return exactly this structure:
{"colours":["colour1","colour2"],"weight":"Worsted","amount":"medium","amountLabel":"roughly half a skein, good for a small amigurumi or accessories","projects":[{"emoji":"🐢","title":"Crochet Turtle","why":"The earthy green suits a turtle body and shell perfectly","difficulty":"Beginner"},{"emoji":"🌿","title":"Succulent Plant","why":"Deep green yarn makes a lifelike plant","difficulty":"Beginner"},{"emoji":"🧤","title":"Fingerless Gloves","why":"Neutral tones make stylish everyday gloves","difficulty":"Intermediate"},{"emoji":"🎀","title":"Bow Keyring","why":"This colour makes a charming bow accessory","difficulty":"Beginner"}]}

Rules:
- colours: every distinct colour you can see
- weight: Lace / Fingering / Sport / DK / Worsted / Aran / Bulky / Super Bulky
- amount: tiny / small / medium / large / full
- projects: exactly 4, matched to the colours and amount you actually see
- mention actual colours in each "why"`;

    try {
      const raw = await askClaudeWithImage(SYS,
        `Describe this yarn and suggest 4 projects. Reply with ONLY the JSON.${notes ? " Note: " + notes : ""}`,
        base64, mediaType);
      const cleaned = raw.replace(/\`\`\`json|\`\`\`/gi, "").trim();
      const s = cleaned.indexOf("{"); const e2 = cleaned.lastIndexOf("}");
      if (s === -1 || e2 === -1) throw new Error("No JSON in response");
      const parsed = JSON.parse(cleaned.slice(s, e2 + 1));
      if (!Array.isArray(parsed.colours) || !Array.isArray(parsed.projects)) throw new Error("Missing fields in response");
      setYarnInfo({ colours: parsed.colours, weight: parsed.weight || "Unknown", amount: parsed.amount, amountLabel: parsed.amountLabel || "" });
      setProjects(parsed.projects.slice(0, 4));
      setPhase("suggestions");
    } catch (e) {
      console.error("Scan error:", e.message);
      setError("Scan failed: " + e.message);
      setPhase("upload");
    }
  };

  const findPatterns = async (project) => {
    setChosen(project); setPatterns(null); setPhase("fetching");
    setTimeout(() => rRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    const colours = yarnInfo?.colours?.join(", ") || "mixed colours";
    const SYS2 = `You are a crochet pattern expert. Find 3 free patterns for "${project.title}" using ${colours} ${yarnInfo?.weight || "worsted"} yarn. If exact colours aren't available, suggest similar patterns with a colour swap tip. Reply with ONLY this JSON — no other text:
{"patterns":[{"title":"Pattern name","source":"Ravelry","difficulty":"Beginner","description":"One sentence about what you make","colourNote":"How ${colours} works with this pattern"}],"encouragement":"A warm 1-2 sentence note"}`;
    try {
      const raw = await askClaude(SYS2, `Find 3 free crochet patterns for: ${project.title}. User has ${colours} ${yarnInfo?.weight || ""} yarn.`);
      const cleaned = raw.replace(/\`\`\`json|\`\`\`/gi, "").trim();
      const s = cleaned.indexOf("{"); const e2 = cleaned.lastIndexOf("}");
      if (s === -1 || e2 === -1) throw new Error("No JSON");
      setPatterns(JSON.parse(cleaned.slice(s, e2 + 1)));
      setPhase("patterns");
    } catch (e) {
      setError("Could not load patterns — please try again.");
      setPhase("suggestions");
    }
  };

  const reset = () => {
    setImgUrl(null); setImgFile(null); setImgName("");
    setPhase("upload"); setYarnInfo(null); setProjects([]);
    setPatterns(null); setChosen(null); setError(""); setNotes(""); setConverting(false);
  };

  const bord = (col) => `2px solid ${col}`;
  const shadow = (col) => `3px 3px 0 ${col}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...card, padding: "28px 30px" }}>
        <CardHeader bg={C.royal} text="🪄 Leftover Yarn Scanner" />

        <div onClick={() => !converting && fRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
          style={{ border: bord(drag ? C.royal : imgUrl ? C.royal : C.black), borderRadius: 18, cursor: converting ? "default" : "pointer", transition: "all 0.2s", overflow: "hidden", marginBottom: 16, background: drag ? C.royal+"18" : imgUrl ? C.royal+"0C" : gridBg(C.cream), padding: imgUrl || converting ? 0 : "44px 24px", textAlign: "center", boxShadow: shadow(drag ? C.royal : C.black) }}>
          <input ref={fRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => { if (e.target.files[0]) { handleFile(e.target.files[0]); e.target.value = ""; } }} />
          {converting ? (
            <div style={{ padding: "32px 24px" }}>
              <div style={{ fontSize: 36, animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</div>
              <p style={{ margin: "10px 0 0", fontFamily: DISPLAY, fontSize: 16, color: C.royal }}>Processing photo…</p>
            </div>
          ) : imgUrl ? (
            <div>
              <img src={imgUrl} alt="yarn" style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block" }} />
              <div style={{ padding: "10px 16px", background: C.royal+"22", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>✅</span>
                  <span style={{ fontFamily: BODY, fontSize: 13.5, color: C.choco, fontWeight: 700 }}>Photo ready!</span>
                  <span style={{ fontFamily: BODY, fontSize: 12, color: "#888" }}>{imgName.slice(0, 28)}</span>
                </div>
                <button onClick={e => { e.stopPropagation(); fRef.current?.click(); }} style={{ ...btn(C.white), padding: "5px 12px", fontSize: 12 }}>📷 Change</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🧶</div>
              <p style={{ margin: "0 0 6px", fontSize: 18, fontFamily: DISPLAY, color: C.choco }}>Drop your yarn photo here</p>
              <p style={{ margin: 0, fontSize: 13.5, color: "#999", fontFamily: BODY }}>Click to browse — jpg, png, or any iPhone photo</p>
            </>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <Lbl color={C.choco}>Anything extra I should know? — optional</Lbl>
          <div style={{ marginTop: 6 }}><Txa value={notes} onChange={setNotes} rows={2} placeholder="e.g. It's acrylic worsted, roughly half a skein..." /></div>
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: "12px 16px", background: C.cherry+"18", border: bord(C.cherry), borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ flexShrink: 0, fontSize: 18 }}>⚠️</span>
            <p style={{ margin: 0, color: C.cherry, fontSize: 13.5, fontFamily: BODY, flex: 1, lineHeight: 1.6 }}>{error}</p>
            <button onClick={() => setError("")} style={{ ...btn(C.cherry, C.white), padding: "3px 10px", fontSize: 12, flexShrink: 0 }}>✕</button>
          </div>
        )}

        <button onClick={scan} disabled={!imgFile || converting || phase === "scanning"}
          style={{ ...btn(!imgFile || converting || phase === "scanning" ? "#ddd" : C.royal, !imgFile || converting || phase === "scanning" ? "#aaa" : C.white), width: "100%", padding: 16, fontSize: 17, boxShadow: imgFile && !converting && phase !== "scanning" ? `5px 5px 0 ${C.black}` : "none", cursor: imgFile && !converting && phase !== "scanning" ? "pointer" : "not-allowed" }}
          onMouseEnter={e => { if (imgFile && !converting && phase !== "scanning") { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `7px 7px 0 ${C.black}`; }}}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = imgFile && !converting && phase !== "scanning" ? `5px 5px 0 ${C.black}` : "none"; }}>
          {phase === "scanning" ? "Analysing your yarn…" : converting ? "Processing photo…" : !imgFile ? "Upload a photo to get started" : "🔍 What Can I Make With This?"}
        </button>
      </div>

      {phase === "scanning" && (
        <div ref={rRef} style={{ ...card, padding: "50px 32px", textAlign: "center" }} className="fadeUp">
          <div style={{ fontSize: 48, animation: "spin 1.4s linear infinite", display: "inline-block" }}>🔍</div>
          <h3 style={{ margin: "16px 0 6px", color: C.royal, fontFamily: DISPLAY, fontSize: 24 }}>Looking at your yarn…</h3>
          <p style={{ margin: 0, color: "#666", fontSize: 14, fontFamily: BODY }}>Reading the colours and matching project ideas</p>
          <Dots cols={[C.royal, C.caramel, C.cherry]} />
        </div>
      )}

      {(phase === "suggestions" || phase === "fetching" || phase === "patterns") && yarnInfo && (
        <div ref={rRef} className="fadeUp" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, padding: "18px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            {imgUrl && <img src={imgUrl} alt="yarn" style={{ height: 60, width: 80, objectFit: "cover", border: bord(C.black), borderRadius: 10 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>{yarnInfo.colours?.map((col, i) => <span key={i} style={{ display: "inline-block", background: C.caramel+"88", border: bord(C.black), borderRadius: 50, padding: "2px 10px", fontSize: 13, fontFamily: BODY, marginRight: 5, marginBottom: 3 }}>{col}</span>)}</div>
              <p style={{ margin: 0, fontSize: 13.5, color: "#555", fontFamily: BODY }}><strong>{yarnInfo.weight}</strong> · {yarnInfo.amountLabel}</p>
            </div>
            <button onClick={reset} style={{ ...btn(C.white), padding: "7px 14px", fontSize: 12 }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `5px 5px 0 ${C.black}`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>🔄 New scan</button>
          </div>

          <div style={{ ...card, padding: "28px 30px" }}>
            <CardHeader bg={C.royal} text="✨ Here's what you could make!" />
            <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {projects.map((p, i) => (
                <div key={i} style={{ padding: 18, borderRadius: 16, border: bord(chosen?.title === p.title ? C.royal : C.black), background: chosen?.title === p.title ? C.royal+"15" : gridBg(C.white), boxShadow: shadow(chosen?.title === p.title ? C.royal : C.black), transition: "all 0.15s" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{p.emoji}</div>
                  <p style={{ margin: "0 0 4px", fontFamily: DISPLAY, fontSize: 16, color: C.choco }}>{p.title}</p>
                  <p style={{ margin: "0 0 10px", fontSize: 13, color: "#555", lineHeight: 1.6, fontFamily: BODY }}>{p.why}</p>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.royal, fontFamily: BODY, letterSpacing: "0.8px", textTransform: "uppercase" }}>{p.difficulty}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 22, padding: "16px 20px", background: C.caramel+"66", border: bord(C.black), borderRadius: 16, textAlign: "center" }}>
              <p style={{ margin: "0 0 14px", fontFamily: DISPLAY, fontSize: 17, color: C.choco }}>🧶 Would you like free patterns for any of these?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                {projects.map((p, i) => (
                  <button key={i} onClick={() => findPatterns(p)} disabled={phase === "fetching"}
                    style={{ ...btn(C.white), padding: "9px 18px", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `5px 5px 0 ${C.black}`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>
                    {p.emoji} {p.title.split(" ").slice(0, 3).join(" ")}…
                  </button>
                ))}
              </div>
            </div>
          </div>

          {phase === "fetching" && (
            <div style={{ ...card, padding: "44px 32px", textAlign: "center" }} className="fadeUp">
              <div style={{ fontSize: 44, animation: "spin 1.4s linear infinite", display: "inline-block" }}>🔗</div>
              <h3 style={{ margin: "14px 0 6px", color: C.royal, fontFamily: DISPLAY, fontSize: 22 }}>Finding free patterns for {chosen?.title}…</h3>
              <p style={{ margin: 0, color: "#666", fontSize: 14, fontFamily: BODY }}>Searching Ravelry, YouTube, AllFreeCrochet and more</p>
            </div>
          )}

          {phase === "patterns" && patterns && (
            <div style={{ ...card, padding: "28px 30px" }} className="fadeUp">
              <CardHeader bg={C.choco} text={`${chosen?.emoji} Free Patterns — ${chosen?.title}`} fg={C.caramel} />
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {(patterns.patterns || []).map((pat, i) => (
                  <div key={i} style={{ borderRadius: 16, border: bord(C.black), overflow: "hidden", boxShadow: shadow(C.black) }}>
                    <div style={{ background: i % 2 === 0 ? C.choco : C.cherry, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <span style={{ fontFamily: DISPLAY, fontSize: 16, color: C.caramel }}>{pat.title}</span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ background: C.caramel, color: C.black, padding: "2px 10px", borderRadius: 50, fontSize: 11, fontWeight: 700, fontFamily: BODY, border: bord(C.black) }}>{pat.difficulty}</span>
                        <span style={{ background: "rgba(255,255,255,0.15)", color: C.white, padding: "2px 10px", borderRadius: 50, fontSize: 11, fontFamily: BODY }}>📍 {pat.source}</span>
                      </div>
                    </div>
                    <div style={{ padding: "14px 16px", background: gridBg(C.white) }}>
                      <p style={{ margin: "0 0 10px", fontSize: 14, color: C.black, lineHeight: 1.65, fontFamily: BODY }}>{pat.description}</p>
                      <div style={{ padding: "9px 14px", background: C.caramel+"55", borderRadius: 10, border: bord(C.black), marginBottom: 12 }}>
                        <p style={{ margin: 0, fontSize: 13, color: C.choco, fontFamily: BODY, lineHeight: 1.6 }}>🎨 <strong>Colour tip:</strong> {pat.colourNote}</p>
                      </div>
                      <a href={`https://www.google.com/search?q=${encodeURIComponent("free crochet " + pat.title + " pattern")}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 50, background: C.royal, color: C.white, border: bord(C.black), boxShadow: shadow(C.black), fontFamily: DISPLAY, fontSize: 14, textDecoration: "none", transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `5px 5px 0 ${C.black}`; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = shadow(C.black); }}>
                        🔍 Find this pattern
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              {patterns.encouragement && (
                <div style={{ marginTop: 18, padding: "13px 18px", background: C.mauve+"44", border: bord(C.mauve), borderRadius: 14 }}>
                  <p style={{ margin: 0, fontSize: 14.5, color: C.choco, fontFamily: BODY, lineHeight: 1.7 }}>🧶 {patterns.encouragement}</p>
                </div>
              )}
              <button onClick={() => setPhase("suggestions")} style={{ ...btn(C.white), marginTop: 16, padding: "10px 22px", fontSize: 14 }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `5px 5px 0 ${C.black}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>← Back to all suggestions</button>
            </div>
          )}
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
    { emoji: "🔍", title: "Yarn Scanner", color: C.royal, bg: C.royal + "15", desc: "Got leftover yarn with nowhere to go? Upload a photo and Fluffle will scan the colours, estimate how much you have, and suggest projects perfectly matched to what you've got.", cta: "Try Yarn Scanner", page: "scanner" },
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
            <button onClick={() => goTo("scanner")} style={{ ...btn(C.royal, C.white), padding: "16px 32px", fontSize: 18 }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = `6px 6px 0 ${C.black}`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `4px 4px 0 ${C.black}`; }}>🔍 Scan My Yarn</button>
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
              <div key={i} style={{ display: "flex", gap: 22, alignItems: "flex-start" }}
                className="fadeUp" style={{ animation: `fadeUp 0.4s ${i * 0.12}s both` }}>
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
          { title: "What Fluffle does 🧶", bg: C.royal + "15", border: C.royal, content: "The Pattern Rewriter takes any crochet pattern and completely rewrites it for your yarn and hook — every row, every stitch count, every design detail like amigurumi eyes or colourwork, all scaled to your exact gauge. The Yarn Scanner looks at a photo of your leftover yarn, figures out what colours and how much you have, and suggests projects perfectly matched to what's sitting in your stash." },
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
  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 18px 60px" }}>
      {/* Tool switcher */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, justifyContent: "center", flexWrap: "wrap" }}>
        {[{ id: "rewriter", label: "Pattern Rewriter", color: C.cherry }, { id: "scanner", label: "Yarn Scanner", color: C.royal }].map(t => (
          <button key={t.id} onClick={() => setTool(t.id)} style={{
            padding: "10px 24px", borderRadius: 50, border: `2.5px solid ${tool === t.id ? t.color : "#ccc"}`,
            background: tool === t.id ? t.color : C.white, color: tool === t.id ? C.white : "#999",
            fontFamily: DISPLAY, fontSize: 16, cursor: "pointer",
            boxShadow: tool === t.id ? `4px 4px 0 ${C.black}` : "none",
            transition: "all 0.18s",
          }}>{t.label}</button>
        ))}
      </div>
      {/* Banner */}
      <div style={{ background: tool === "rewriter" ? C.cherry : C.royal, border: `2.5px solid ${C.black}`, borderRadius: 18, boxShadow: `4px 4px 0 ${C.black}`, padding: "13px 20px", marginBottom: 24 }}>
        {tool === "rewriter"
          ? <p style={{ margin: 0, fontSize: 14.5, color: C.white, lineHeight: 1.75, fontFamily: BODY }}>Ever found a tutorial you loved but your yarn is a different weight or size? Instead of spending a whole day doing the maths yourself, <strong style={{ color: C.caramel }}>paste the original pattern, tell me your yarn and hook, and I'll rewrite the entire pattern for you</strong> — every row, every stitch count, every design detail.</p>
          : <p style={{ margin: 0, fontSize: 14.5, color: C.white, lineHeight: 1.75, fontFamily: BODY }}>Every crocheter has that stash of leftover yarn with nowhere to go. <strong style={{ color: C.caramel }}>Upload a photo of your leftover yarn and I'll estimate how much you have, suggest everything you could make with it</strong> — and find you free patterns to get started.</p>}
      </div>
      <div key={tool} className="fadeUp">
        {tool === "rewriter" ? <PatternRewriter /> : <YarnScanner />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP SHELL
// ══════════════════════════════════════════════════════════════════════════════
const NAV_LINKS = [
  { id: "home",     label: "Home" },
  { id: "rewriter", label: "Pattern Rewriter" },
  { id: "scanner",  label: "Yarn Scanner" },
  { id: "about",    label: "About" },
  { id: "contact",  label: "Contact" },
];

export default function App() {
  const [page, setPage] = useState("home");
  const [mobileOpen, setMobileOpen] = useState(false);

  const goTo = (p) => { setPage(p); setMobileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const isToolPage = page === "rewriter" || page === "scanner";

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
