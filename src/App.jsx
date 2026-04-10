import { useState, useRef, useCallback } from "react";

/* ── nouri. Brand Tokens ── */
const B = {
  teal: "#1DB9A0", tealDark: "#17A68E",
  charcoal: "#2D2D2D", warmWhite: "#FAFAF8",
  sage: "#E8F0EC", sand: "#F5F1ED",
  warmGray: "#9A9A9A", lightGray: "#F2F0ED",
  white: "#FFFFFF",
  ok: "#2EBD6B", okBg: "#EDFAF2", okBd: "#C2EDCF",
  warn: "#E8960C", warnBg: "#FFF7E8", warnBd: "#FFE4A8",
  bad: "#E5453A", badBg: "#FFF0EF", badBd: "#FECCC9",
  radius: 16, radiusSm: 12,
  font: "SF Pro Display, -apple-system, 'Helvetica Neue', sans-serif",
};
const colorOf = l => l === "low" ? B.ok : l === "moderate" ? B.warn : B.bad;
const bgOf = l => l === "low" ? B.okBg : l === "moderate" ? B.warnBg : B.badBg;
const categoryLabel = c => {
  if (!c || c === "keine") return null;
  const map = { "Fructose": "Fruchtzucker", "Lactose": "Milchzucker", "Fructane": "Schwer verdauliche Ballaststoffe", "GOS": "Hülsenfrucht-Zucker", "Polyole": "Zuckeralkohole", "GOS/Fructane": "Ballaststoffe & Hülsenfrucht-Zucker", "Fructose/Polyole": "Fruchtzucker & Zuckeralkohole" };
  return map[c] || c;
};

const MODEL = "claude-haiku-4-5-20251001";
const SYS = "Du bist ein strenger aber freundlicher FODMAP-Ernährungsberater nach Monash-Universität-Richtlinien. WICHTIG: Sei bei der Einstufung STRENG und KORREKT. Knoblauch, Zwiebeln, Weizen, Honig, Äpfel, Birnen, Wassermelone, Pilze, Blumenkohl sind IMMER high-FODMAP. Laktose-haltige Milchprodukte sind moderate bis high. Wenn auch nur EINE Zutat high-FODMAP ist, muss overall mindestens moderate sein. Antworte immer auf Deutsch. Schreib verständlich für Laien, keine Fachbegriffe.";
const PROMPT_CHECK = `Analysiere das Essen auf FODMAP-Verträglichkeit (Monash-basiert). WICHTIG: Liste NUR Zutaten auf die der User eingegeben hat oder die offensichtlich Teil des Gerichts sind. Erfinde KEINE Zutaten. Erkläre JEDE problematische Zutat so dass ein Laie es sofort versteht - keine Fachbegriffe wie Fructane, GOS, Polyole. Sag stattdessen was es im Körper macht. NUR JSON:\n{"title":"Name des Gerichts","overall":"low/moderate/high","summary":"1 kurzer ermutigender Satz. Bei high: was ist das Hauptproblem und dass es eine Lösung gibt. Bei low: kurze Bestätigung. Optional ein konkreter Tipp.","items":[{"name":"Zutat (einfacher Name ohne Klammerzusatz)","fodmap":"low/moderate/high","why":"1 klarer Satz OHNE Fachbegriffe: Warum ist das problematisch ODER warum ist es okay? Erkläre was im Körper passiert.","swap":"Kurze verträgliche Alternative oder null"}]}`;
const PROMPT_LABEL = `Analysiere diese Zutatenliste auf FODMAP-Verträglichkeit. WICHTIG: Erfinde KEINE Zutaten. Keine Fachbegriffe. Erkläre verständlich was im Körper passiert. NUR JSON:\n{"title":"Produktname","overall":"low/moderate/high","summary":"1 kurzer Satz mit optionalem Tipp.","items":[{"name":"Zutat","fodmap":"low/moderate/high","why":"1 klarer Satz ohne Fachbegriffe.","swap":"null oder kurze Alternative"}]}`;
const PROMPT_RECIPE = `Erstelle EIN leckeres einfaches Rezept passend zum Gericht. Falls Zutaten problematisch sind, ersetze sie. Einfache Sprache. NUR JSON:\n{"title":"Kreativer Rezeptname (z.B. Cremige Knoblauch-Pasta)","description":"1 appetitlicher Satz","servings":2,"time":"z.B. 25 Min.","ingredients":["Zutat 1","Zutat 2"],"steps":["Schritt 1","Schritt 2"],"tip":"Praktischer Tipp"}`;
const PROMPT_HUNGER = `Erstelle EIN leckeres einfaches FODMAP-armes Rezept basierend auf dem Wunsch. Sei kreativ! Einfache Sprache. NUR JSON:\n{"title":"Kreativer Rezeptname","description":"1 appetitlicher Satz","servings":2,"time":"z.B. 25 Min.","ingredients":["Zutat 1","Zutat 2"],"steps":["Schritt 1","Schritt 2"],"tip":"Praktischer Tipp"}`;
const PROMPT_EDIT = `Du hast ein Rezept erstellt. Der Nutzer möchte es anpassen. Erstelle die angepasste Version. Einfache Sprache. NUR JSON:\n{"title":"Kreativer Rezeptname","description":"1 appetitlicher Satz","servings":2,"time":"z.B. 25 Min.","ingredients":["Zutat 1","Zutat 2"],"steps":["Schritt 1","Schritt 2"],"tip":"Praktischer Tipp"}`;

function loadZXing() {
  return new Promise((resolve, reject) => {
    if (window.ZXing) { resolve(window.ZXing); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@zxing/library@0.19.1/umd/index.min.js";
    s.onload = () => resolve(window.ZXing);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
function BarcodeScanner({ onDetect, onClose }) {
  const videoRef = useRef(null); const readerRef = useRef(null);
  const [status, setStatus] = useState("starting"); const [error, setError] = useState(null);
  const handleClose = useCallback(() => { if (readerRef.current) { try { readerRef.current.reset(); } catch {} } onClose(); }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#000" }}>
      <ScannerEngine videoRef={videoRef} readerRef={readerRef} onDetect={onDetect} setStatus={setStatus} setError={setError} />
      <video ref={videoRef} autoPlay playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      {status === "scanning" && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><div style={{ width: 240, height: 140, border: `3px solid rgba(255,255,255,.6)`, borderRadius: 20, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }} /></div>}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 24px 52px", background: "linear-gradient(transparent,rgba(0,0,0,.85))", textAlign: "center" }}>
        {error ? <div style={{ color: "#fca5a5", fontSize: 15, fontWeight: 600, marginBottom: 16, fontFamily: B.font }}>{error}</div>
          : <div style={{ color: "rgba(255,255,255,.7)", fontSize: 15, fontWeight: 500, marginBottom: 16, fontFamily: B.font }}>{status === "starting" ? "Wird geladen…" : "Barcode in den Rahmen halten"}</div>}
        <button onClick={handleClose} style={{ padding: "12px 40px", borderRadius: 100, border: "none", background: "rgba(255,255,255,.15)", backdropFilter: "blur(20px)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: B.font }}>Abbrechen</button>
      </div>
    </div>
  );
}
function ScannerEngine({ videoRef, readerRef, onDetect, setStatus, setError }) {
  const started = useRef(false);
  if (!started.current) { started.current = true; setTimeout(async () => {
    try {
      const ZXing = await loadZXing(); const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128]);
      const reader = new ZXing.BrowserMultiFormatReader(hints); readerRef.current = reader; setStatus("scanning");
      await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, videoRef.current, (result) => {
        if (result) { if (navigator.vibrate) navigator.vibrate(100); try { reader.reset(); } catch {} onDetect(result.getText()); }
      });
    } catch (e) { setError(e?.name === "NotAllowedError" ? "Kamera-Zugriff verweigert." : "Kamera konnte nicht gestartet werden."); setStatus("error"); }
  }, 0); }
  return null;
}

/* ── Components ── */
const Card = ({ children, style }) => <div style={{ background: B.white, borderRadius: B.radius, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.04)", ...style }}>{children}</div>;

const Btn = ({ children, onClick, disabled, variant = "primary", style }) => {
  const styles = {
    magic: { background: `linear-gradient(135deg, ${B.teal}, ${B.tealDark})`, color: "#fff", boxShadow: disabled ? "none" : `0 4px 14px rgba(29,185,160,.3)` },
    primary: { background: B.charcoal, color: "#fff", boxShadow: "none" },
    secondary: { background: B.sand, color: B.charcoal, boxShadow: "none" },
    green: { background: B.teal, color: "#fff", boxShadow: "none" },
  };
  const s = styles[variant] || styles.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "15px", borderRadius: 100, border: "none",
      background: disabled ? B.lightGray : s.background,
      color: disabled ? B.warmGray : s.color,
      fontSize: 15, fontWeight: 700, cursor: disabled ? "default" : "pointer",
      fontFamily: "inherit", transition: "all .2s", boxShadow: s.boxShadow, ...style,
    }}>{children}</button>
  );
};

const TextLink = ({ children, onClick, style }) => (
  <button onClick={onClick} style={{ background: "none", border: "none", color: B.warmGray, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", ...style }}>{children}</button>
);

const ModeCard = ({ icon, title, sub, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: "20px 10px 16px", borderRadius: B.radius, border: "none",
    background: B.sand, cursor: "pointer", textAlign: "center", display: "flex",
    flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit",
  }}>
    <span style={{ fontSize: 26 }}>{icon}</span>
    <span style={{ fontSize: 13, fontWeight: 700, color: B.charcoal, marginTop: 4 }}>{title}</span>
    <span style={{ fontSize: 12, color: B.warmGray }}>{sub}</span>
  </button>
);

const Tag = ({ children }) => (
  <span style={{ fontSize: 12, fontWeight: 600, background: B.sage, color: B.teal, padding: "4px 12px", borderRadius: 100 }}>{children}</span>
);

function ChipInput({ value, onChange, placeholder, suggestions }) {
  return (
    <div>
      <div style={{ position: "relative" }}>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: "100%", background: B.sand, border: `1.5px solid ${B.lightGray}`, borderRadius: B.radiusSm, padding: "14px", paddingRight: value ? 44 : 14, color: B.charcoal, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
        {value && (
          <button onClick={() => onChange("")} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            width: 26, height: 26, borderRadius: 13, border: "none", background: B.lightGray,
            color: B.warmGray, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        )}
      </div>
      {!value && suggestions && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {suggestions.map((q, i) => (
            <button key={i} onClick={() => onChange(q)} style={{
              fontSize: 13, fontWeight: 500, background: B.white, border: `1.5px solid ${B.lightGray}`,
              color: B.charcoal, padding: "8px 14px", borderRadius: 100, cursor: "pointer", fontFamily: "inherit",
            }}>{q}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function IngredientRow({ it, last }) {
  const [open, setOpen] = useState(false);
  const isOk = it.fodmap === "low";
  return (
    <div style={{ borderBottom: last ? "none" : `1px solid ${B.lightGray}` }}>
      <button onClick={() => !isOk && setOpen(!open)} style={{
        width: "100%", padding: "13px 0", background: "none", border: "none", cursor: isOk ? "default" : "pointer",
        display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit", textAlign: "left",
      }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: colorOf(it.fodmap), flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: B.charcoal }}>{it.name}</span>
        {!isOk && <span style={{ fontSize: 13, color: B.warmGray, transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>▾</span>}
        {isOk && <span style={{ fontSize: 13, color: B.ok }}>✓</span>}
      </button>
      {open && !isOk && (
        <div style={{ padding: "0 0 14px 22px", animation: "fadeUp .2s ease-out", textAlign: "left" }}>
          {it.why && <div style={{ fontSize: 14, color: B.charcoal, lineHeight: 1.6, marginBottom: it.swap ? 10 : 0 }}>{it.why}</div>}
          {it.swap && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: B.sage, borderRadius: 8, padding: "7px 12px", marginTop: 2 }}>
              <span style={{ fontSize: 14, color: B.teal }}>→</span>
              <span style={{ fontSize: 14, color: B.teal, fontWeight: 500 }}>{it.swap}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── App ── */
export default function App() {
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_API_KEY || "");
  const [showSetup, setShowSetup] = useState(false);
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState("input");
  const [input, setInput] = useState("");
  const [hungerInput, setHungerInput] = useState("");
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [productInfo, setProductInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [result, setResult] = useState(null);
  const [recipe, setRecipe] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editInput, setEditInput] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fadeIn, setFadeIn] = useState(false);
  const [barcodeManual, setBarcodeManual] = useState("");
  const fileRef = useRef();

  const callAI = useCallback(async (content) => {
    const key = apiKey || import.meta.env.VITE_API_KEY;
    if (!key) throw new Error("Kein API Key hinterlegt");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: SYS, messages: [{ role: "user", content }] })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const raw = data.content.filter(b => b.type === "text").map(b => b.text).join("");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Keine Analyse erhalten");
    return JSON.parse(m[0]);
  }, [apiKey]);

  const fade = () => { setFadeIn(true); setTimeout(() => setFadeIn(false), 500); };

  const analyze = async (promptOverride, imgOverride) => {
    const key = apiKey || import.meta.env.VITE_API_KEY;
    if (!key) { setShowSetup(true); return; }
    setLoading(true); setLoadMsg(imgOverride || image ? "Bild wird analysiert…" : "Wird analysiert…");
    setError(null); setResult(null); setRecipe(null);
    try {
      const prompt = promptOverride || PROMPT_CHECK;
      const img = imgOverride || image;
      let content;
      if (img) {
        const b = img.split(",")[1], mt = img.split(";")[0].split(":")[1];
        content = [{ type: "image", source: { type: "base64", media_type: mt, data: b } }, { type: "text", text: prompt }];
      } else { content = prompt + "\n\nDas Essen: " + input; }
      const parsed = await callAI(content);
      setResult(parsed); setStep("result"); fade();
    } catch (e) { setError(String(e?.message || e)); }
    setLoading(false);
  };

  const onBarcode = useCallback(async (code) => {
    setScanning(false); setLoading(true); setLoadMsg("Produkt wird gesucht…"); setError(null); setResult(null); setRecipe(null); setMode("barcode-result");
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const data = await res.json();
      if (data.status !== 1) throw new Error("Produkt nicht gefunden (EAN: " + code + ")");
      const p = data.product;
      const name = p.product_name || p.product_name_de || "Unbekannt";
      const ingredients = p.ingredients_text_de || p.ingredients_text || "";
      const nutri = p.nutriscore_grade ? `Nutriscore ${p.nutriscore_grade.toUpperCase()}` : "";
      setProductInfo({ name, code, image: p.image_front_small_url, ingredients, nutri });
      setLoadMsg("Wird analysiert…");
      const parsed = await callAI(PROMPT_LABEL + `\n\nProdukt: ${name}\nZutaten: ${ingredients}\n${nutri}`);
      setResult(parsed); setStep("result"); fade();
    } catch (e) { setError(String(e?.message || e)); }
    setLoading(false);
  }, [apiKey, callAI]);

  const loadRecipe = async () => {
    setLoading(true); setError(null); setLoadMsg("Rezept wird gezaubert ✨");
    try {
      const dishName = result?.title || input;
      const problems = result?.items?.filter(i => i.fodmap !== "low");
      let extra = "";
      if (problems?.length > 0) extra = `\nErsetze: ${problems.map(i => `${i.name} → ${i.alternative || "weglassen"}`).join(", ")}`;
      const parsed = await callAI(PROMPT_RECIPE + `\n\nDas Gericht: ${dishName}${extra}`);
      setRecipe(parsed); setStep("recipe"); setEditMode(false); setEditInput(""); fade();
    } catch (e) { setError(String(e?.message || e)); }
    setLoading(false);
  };

  const loadHungerRecipe = async () => {
    const key = apiKey || import.meta.env.VITE_API_KEY;
    if (!key) { setShowSetup(true); return; }
    setLoading(true); setError(null); setMode("hunger"); setResult(null); setLoadMsg("Rezept wird gezaubert ✨");
    try {
      const parsed = await callAI(PROMPT_HUNGER + `\n\nHunger auf: ${hungerInput}`);
      setRecipe(parsed); setStep("recipe"); setEditMode(false); setEditInput(""); fade();
    } catch (e) { setError(String(e?.message || e)); }
    setLoading(false);
  };

  const editRecipe = async () => {
    if (!editInput.trim()) return;
    setEditLoading(true); setError(null);
    try {
      const parsed = await callAI(PROMPT_EDIT + `\n\nAktuelles Rezept:\n${JSON.stringify(recipe)}\n\nÄnderung: ${editInput}`);
      setRecipe(parsed); setEditInput(""); setEditMode(false); fade();
    } catch (e) { setError(String(e?.message || e)); }
    setEditLoading(false);
  };

  const handleImg = (prompt) => e => {
    const f = e.target.files?.[0]; if (!f) return;
    setResult(null); setError(null); setRecipe(null); setMode("photo-result");
    const r = new FileReader();
    r.onload = () => { setImage(r.result); analyze(prompt, r.result); };
    r.readAsDataURL(f);
  };

  const reset = () => {
    setInput(""); setHungerInput(""); setImage(null); setResult(null); setRecipe(null);
    setError(null); setMode(null); setStep("input"); setProductInfo(null); setBarcodeManual("");
    setLoading(false); setEditMode(false); setEditInput(""); setEditLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div style={{ minHeight: "100vh", background: B.warmWhite, color: B.charcoal, fontFamily: B.font, maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeUp .3s ease-out}
        input:focus,textarea:focus{border-color:${B.teal}!important;outline:none}
        ::placeholder{color:${B.warmGray}}
        *{-webkit-tap-highlight-color:transparent}
        button:active{opacity:.7}
      `}</style>

      {scanning && <BarcodeScanner onDetect={onBarcode} onClose={() => setScanning(false)} />}

      {/* Header */}
      <div style={{ padding: "24px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "baseline", gap: 2 }}>
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: -.8, color: B.charcoal }}>nouri</span>
          <span style={{ fontSize: 26, fontWeight: 800, color: B.teal }}>.</span>
        </button>
        <button onClick={() => setShowSetup(!showSetup)} style={{
          width: 40, height: 40, borderRadius: 12, border: "none",
          background: B.sand, color: B.warmGray, fontSize: 17, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>⚙</button>
      </div>

      {showSetup && (
        <div style={{ padding: "12px 20px 0" }}>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>API Key</div>
            <div style={{ fontSize: 13, color: B.warmGray, marginBottom: 12 }}>Dein Anthropic API Key.</div>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-ant-..." type="password"
              style={{ width: "100%", background: B.sand, border: `1.5px solid ${B.lightGray}`, borderRadius: B.radiusSm, padding: "12px 14px", color: B.charcoal, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
            {apiKey && <div style={{ fontSize: 13, color: B.teal, marginTop: 8, fontWeight: 600 }}>✓ Verbunden</div>}
          </Card>
        </div>
      )}

      <div style={{ padding: "0 20px" }}>

        {/* ═══ INPUT ═══ */}
        {step === "input" && (
          <>
            {!mode && !loading && (
              <div style={{ paddingTop: 20 }}>
                {/* Check Section */}
                <Card style={{ marginBottom: 12, padding: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: B.teal, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Essen checken</div>
                  <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, letterSpacing: -.5, marginBottom: 6 }}>Vertrag ich das?</div>
                  <div style={{ fontSize: 15, color: B.warmGray, marginBottom: 20, lineHeight: 1.5 }}>Prüfe ein Gericht, Produkt oder Foto.</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <ModeCard icon="✏️" title="Eintippen" sub="Gericht" onClick={() => setMode("text")} />
                    <ModeCard icon="📸" title="Foto" sub="Essen oder Zutaten" onClick={() => fileRef.current?.click()} />
                    <ModeCard icon="🔎" title="Scannen" sub="Barcode" onClick={() => setMode("barcode")} />
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImg(PROMPT_CHECK)} style={{ display: "none" }} />
                </Card>

                {/* Recipe Section */}
                <Card style={{ padding: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: B.teal, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Rezept finden</div>
                  <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, letterSpacing: -.5, marginBottom: 6 }}>Was soll auf den Tisch?</div>
                  <div style={{ fontSize: 15, color: B.warmGray, marginBottom: 18, lineHeight: 1.5 }}>Sag uns worauf du Lust hast — wir zaubern ein verträgliches Rezept.</div>
                  <ChipInput value={hungerInput} onChange={setHungerInput} placeholder="z.B. Pasta, Hähnchen, Curry…"
                    suggestions={["Pasta", "Hähnchen", "Salat", "Curry", "Risotto", "Suppe"]} />
                  <div style={{ marginTop: 14 }}>
                    <Btn variant="magic" onClick={loadHungerRecipe} disabled={!hungerInput.trim()}>Rezept zaubern 🪄</Btn>
                  </div>
                </Card>
              </div>
            )}

            {mode === "text" && !loading && (
              <Card style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <button onClick={() => setMode(null)} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: B.sand, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: B.charcoal }}>←</button>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>Gericht beschreiben</div>
                    <div style={{ fontSize: 13, color: B.warmGray }}>Was möchtest du essen?</div>
                  </div>
                </div>
                <ChipInput value={input} onChange={setInput} placeholder="z.B. Pasta mit Knoblauch und Sahne"
                  suggestions={["Pasta Aglio Olio", "Caesar Salad", "Chicken Curry", "Döner", "Risotto", "Müsli mit Joghurt"]} />
                <div style={{ marginTop: 14 }}>
                  <Btn onClick={() => analyze()} disabled={!input.trim()}>Prüfen</Btn>
                </div>
              </Card>
            )}

            {mode === "barcode" && !loading && (
              <Card style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <button onClick={() => setMode(null)} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: B.sand, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: B.charcoal }}>←</button>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>Produkt scannen</div>
                    <div style={{ fontSize: 13, color: B.warmGray }}>Barcode auf der Verpackung</div>
                  </div>
                </div>
                <Btn onClick={() => setScanning(true)}>Kamera öffnen</Btn>
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
                  <div style={{ flex: 1, height: 1, background: B.lightGray }} />
                  <span style={{ fontSize: 13, color: B.warmGray }}>oder manuell</span>
                  <div style={{ flex: 1, height: 1, background: B.lightGray }} />
                </div>
                <input value={barcodeManual} onChange={e => setBarcodeManual(e.target.value.replace(/\D/g, ""))} placeholder="EAN-Nummer eingeben" inputMode="numeric"
                  style={{ width: "100%", background: B.sand, border: `1.5px solid ${B.lightGray}`, borderRadius: B.radiusSm, padding: "14px", color: B.charcoal, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }} />
                <Btn onClick={() => barcodeManual.length >= 8 && onBarcode(barcodeManual)} disabled={barcodeManual.length < 8}>Suchen</Btn>
              </Card>
            )}
          </>
        )}

        {/* Loading */}
        {loading && (
          <Card style={{ textAlign: "center", padding: "48px 20px", marginTop: 16 }}>
            {productInfo?.image && <img src={productInfo.image} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", margin: "0 auto 14px", display: "block" }} />}
            <div style={{ width: 32, height: 32, margin: "0 auto 16px", border: `3px solid ${B.lightGray}`, borderTopColor: B.teal, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: B.warmGray }}>{loadMsg}</div>
          </Card>
        )}

        {/* Error */}
        {error && !loading && !editLoading && (
          <div style={{ background: B.badBg, border: `1px solid ${B.badBd}`, borderRadius: B.radius, padding: 16, fontSize: 15, color: B.bad, lineHeight: 1.5, marginTop: 16 }}>
            {error}
            <div onClick={reset} style={{ marginTop: 10, fontSize: 13, fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>Nochmal versuchen</div>
          </div>
        )}

        {/* ═══ RESULT ═══ */}
        {step === "result" && result && !loading && (
          <div className={fadeIn ? "fade-in" : ""} style={{ paddingTop: 16 }}>
            {productInfo && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                {productInfo.image && <img src={productInfo.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />}
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{productInfo.name}</div>
                  {productInfo.nutri && <div style={{ fontSize: 13, color: B.warmGray }}>{productInfo.nutri}</div>}
                </div>
              </div>
            )}
            {image && !productInfo && (
              <div style={{ marginBottom: 16 }}>
                <img src={image} alt="" style={{ width: "100%", borderRadius: B.radius, maxHeight: 160, objectFit: "cover" }} />
              </div>
            )}

            {/* Verdict */}
            <Card style={{ marginBottom: 12, borderLeft: `4px solid ${colorOf(result.overall)}`, textAlign: "left" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: bgOf(result.overall), padding: "6px 12px", borderRadius: 100, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: colorOf(result.overall) }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: colorOf(result.overall) }}>
                  {result.overall === "low" ? "Verträglich" : result.overall === "moderate" ? "Vorsicht" : "Nicht verträglich"}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -.5, marginBottom: 10 }}>{result.title}</div>
              {result.summary && <div style={{ fontSize: 15, color: B.warmGray, lineHeight: 1.6 }}>{result.summary}</div>}
            </Card>

            {/* Ingredients */}
            <Card style={{ marginBottom: 16, textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: B.warmGray }}>Zutaten</span>
                <span style={{ fontSize: 12, color: B.warmGray }}>Tippe für Details</span>
              </div>
              {result.items?.map((it, i) => <IngredientRow key={i} it={it} last={i === result.items.length - 1} />)}
            </Card>

            <Btn variant="magic" onClick={loadRecipe} style={{ marginBottom: 8 }}>
              {result.overall === "low" ? "Rezept zaubern 🪄" : "Verträgliches Rezept zaubern 🪄"}
            </Btn>
            <Btn variant="secondary" onClick={reset}>Neuer Check</Btn>
          </div>
        )}

        {/* ═══ RECIPE ═══ */}
        {step === "recipe" && recipe && !loading && (
          <div className={fadeIn ? "fade-in" : ""} style={{ paddingTop: 16 }}>
            <Card style={{ marginBottom: 12, border: `1.5px solid ${B.okBd}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 15 }}>✨</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: B.teal, textTransform: "uppercase", letterSpacing: .5 }}>Dein Rezept</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -.5, marginBottom: 10, textAlign: "left" }}>{recipe.title}</div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                <Tag>FODMAP-arm</Tag>
              </div>

              {recipe.description && <div style={{ fontSize: 15, color: B.warmGray, lineHeight: 1.5, marginBottom: 16, textAlign: "left" }}>{recipe.description}</div>}

              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {recipe.servings && <div style={{ background: B.sand, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: B.warmGray, fontWeight: 500 }}>👤 {recipe.servings} Portionen</div>}
                {recipe.time && <div style={{ background: B.sand, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: B.warmGray, fontWeight: 500 }}>⏱ {recipe.time}</div>}
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: B.warmGray, marginBottom: 10 }}>Zutaten</div>
              <div style={{ marginBottom: 20 }}>
                {recipe.ingredients?.map((ing, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < recipe.ingredients.length - 1 ? `1px solid ${B.lightGray}` : "none", textAlign: "left" }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: B.teal, flexShrink: 0 }} />
                    <span style={{ fontSize: 15 }}>{ing}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: B.warmGray, marginBottom: 10 }}>Zubereitung</div>
              {recipe.steps?.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, textAlign: "left" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 14, background: B.sand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: B.warmGray, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 15, color: B.charcoal, lineHeight: 1.6, paddingTop: 3 }}>{s}</div>
                </div>
              ))}

              {recipe.tip && (
                <div style={{ background: B.warnBg, borderRadius: 12, padding: 14, border: `1px solid ${B.warnBd}`, marginTop: 8, textAlign: "left" }}>
                  <div style={{ fontSize: 13, color: B.charcoal, lineHeight: 1.5 }}>💡 {recipe.tip}</div>
                </div>
              )}
            </Card>

            {/* Edit */}
            {!editMode ? (
              <Btn variant="secondary" onClick={() => setEditMode(true)} style={{ marginBottom: 16 }}>Rezept anpassen ✏️</Btn>
            ) : (
              <Card style={{ marginBottom: 16, border: `1.5px solid ${B.sage}` }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Rezept anpassen</div>
                <div style={{ fontSize: 13, color: B.warmGray, marginBottom: 12 }}>Was möchtest du ändern?</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {["Für 4 Personen", "Ohne Milch", "Schneller", "Mit Kartoffeln", "Weniger Zutaten"].map((s, i) => (
                    <button key={i} onClick={() => setEditInput(s)} style={{
                      fontSize: 12, fontWeight: 500, background: B.sage, border: "none",
                      color: B.teal, padding: "6px 12px", borderRadius: 100, cursor: "pointer", fontFamily: "inherit",
                    }}>{s}</button>
                  ))}
                </div>
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <input value={editInput} onChange={e => setEditInput(e.target.value)} placeholder="z.B. Geht das auch mit Reis?"
                    onKeyDown={e => e.key === "Enter" && editInput.trim() && editRecipe()}
                    style={{ width: "100%", background: B.sand, border: `1.5px solid ${B.lightGray}`, borderRadius: B.radiusSm, padding: "14px", paddingRight: 44, color: B.charcoal, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
                  {editInput && (
                    <button onClick={() => setEditInput("")} style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      width: 26, height: 26, borderRadius: 13, border: "none", background: B.lightGray,
                      color: B.warmGray, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>✕</button>
                  )}
                </div>
                <Btn variant="magic" onClick={editRecipe} disabled={!editInput.trim() || editLoading}>
                  {editLoading ? "Wird angepasst…" : "Anpassen 🪄"}
                </Btn>
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <TextLink onClick={() => { setEditMode(false); setEditInput(""); }}>Abbrechen</TextLink>
                </div>
              </Card>
            )}

            {/* Nav */}
            <Btn variant="green" onClick={reset} style={{ marginTop: 4 }}>Neuer Check</Btn>
            {result && (
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <TextLink onClick={() => { setStep("result"); setRecipe(null); setEditMode(false); setError(null); }}>← Zurück zum Check</TextLink>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", fontSize: 12, color: B.warmGray, marginTop: 32, padding: "0 20px" }}>Kein Ersatz für ärztliche Beratung</div>
    </div>
  );
}