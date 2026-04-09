import { useState, useRef, useCallback } from "react";

const P = {
  bg: "#FAFAFA", surface: "#FFFFFF", surfaceAlt: "#F5F5F5",
  text: "#1A1A1A", textSec: "#6E6E73", textTer: "#AEAEB2",
  border: "#F2F2F7",
  green: "#34C759", greenBg: "#E8F9ED", greenBd: "#B8F0C8",
  amber: "#FF9500", amberBg: "#FFF4E0", amberBd: "#FFE0A3",
  red: "#FF3B30", redBg: "#FFEDEC", redBd: "#FFC5C2",
  radius: 16, radiusSm: 12,
};
const colorOf = l => l === "low" ? P.green : l === "moderate" ? P.amber : P.red;
const bgOf = l => l === "low" ? P.greenBg : l === "moderate" ? P.amberBg : P.redBg;
const bdOf = l => l === "low" ? P.greenBd : l === "moderate" ? P.amberBd : P.redBd;
const categoryLabel = c => {
  if (!c || c === "keine") return null;
  const map = { "Fructose": "Fruchtzucker", "Lactose": "Milchzucker", "Fructane": "Schwer verdauliche Ballaststoffe", "GOS": "Hülsenfrucht-Zucker", "Polyole": "Zuckeralkohole", "GOS/Fructane": "Ballaststoffe & Hülsenfrucht-Zucker", "Fructose/Polyole": "Fruchtzucker & Zuckeralkohole" };
  return map[c] || c;
};

const MODEL = "claude-haiku-4-5-20251001";
const SYS = "Du bist ein freundlicher Ernährungsberater. Antworte immer auf Deutsch. Schreib verständlich für Laien, keine Fachbegriffe.";
const PROMPT_CHECK = `Analysiere das Essen auf FODMAP-Verträglichkeit (Monash-basiert). NUR JSON:\n{"title":"Name des Gerichts","overall":"low/moderate/high","summary":"Ein freundlicher, ermutigender Satz. Bei high: benenne das Hauptproblem und mach Mut dass es eine Lösung gibt. Bei low: bestätige dass alles gut ist.","items":[{"name":"Zutat","fodmap":"low/moderate/high","category":"Fructose/Lactose/Fructane/GOS/Polyole/keine","detail":"1 verständlicher Satz für Laien.","alternative":"Verträgliche Alternative oder null"}]}`;
const PROMPT_LABEL = `Analysiere diese Zutatenliste auf FODMAP-Verträglichkeit. NUR JSON:\n{"title":"Produktname","overall":"low/moderate/high","summary":"Ein freundlicher Satz.","items":[{"name":"Zutat","fodmap":"low/moderate/high","category":"Fructose/Lactose/Fructane/GOS/Polyole/keine","detail":"1 verständlicher Satz für Laien.","alternative":"null oder Alternative"}]}`;
const PROMPT_FIX = `Mach dieses Gericht FODMAP-verträglich. Zeige was getauscht wird. Einfache Sprache. NUR JSON:\n{"title":"Verträgliche Version","changes":[{"problem":"Problematische Zutat","solution":"Ersatz","why":"Kurzer Grund in einfacher Sprache"}],"summary":"1 ermutigender Satz was sich ändert"}`;
const PROMPT_RECIPE = `Erstelle ein leckeres, einfaches FODMAP-armes Rezept passend zum Gericht. Einfache Sprache. NUR JSON:\n{"title":"Rezeptname","description":"1 appetitlicher Satz","servings":2,"time":"z.B. 25 Min.","ingredients":["Zutat 1","Zutat 2"],"steps":["Schritt 1","Schritt 2"],"tip":"Praktischer Tipp"}`;
const PROMPT_RECIPE_FIXED = `Erstelle ein konkretes Rezept für die verträgliche Version dieses Gerichts mit den genannten Ersatz-Zutaten. Einfache Sprache. NUR JSON:\n{"title":"Rezeptname","description":"1 appetitlicher Satz","servings":2,"time":"z.B. 25 Min.","ingredients":["Zutat 1","Zutat 2"],"steps":["Schritt 1","Schritt 2"],"tip":"Praktischer Tipp"}`;
const PROMPT_HUNGER = `Erstelle ein leckeres, einfaches FODMAP-armes Rezept basierend auf dem Wunsch des Nutzers. Sei kreativ! Einfache Sprache. NUR JSON:\n{"title":"Rezeptname","description":"1 appetitlicher Satz","servings":2,"time":"z.B. 25 Min.","ingredients":["Zutat 1","Zutat 2"],"steps":["Schritt 1","Schritt 2"],"tip":"Praktischer Tipp"}`;

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
      {status === "scanning" && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><div style={{ width: 240, height: 140, border: "3px solid rgba(255,255,255,.6)", borderRadius: 20, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }} /></div>}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 24px 52px", background: "linear-gradient(transparent,rgba(0,0,0,.85))", textAlign: "center" }}>
        {error ? <div style={{ color: "#fca5a5", fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: "inherit" }}>{error}</div>
          : <div style={{ color: "rgba(255,255,255,.7)", fontSize: 14, fontWeight: 500, marginBottom: 16, fontFamily: "inherit" }}>{status === "starting" ? "Wird geladen…" : "Barcode in den Rahmen halten"}</div>}
        <button onClick={handleClose} style={{ padding: "12px 40px", borderRadius: 100, border: "none", background: "rgba(255,255,255,.15)", backdropFilter: "blur(20px)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Abbrechen</button>
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

const Card = ({ children, style }) => <div style={{ background: P.surface, borderRadius: P.radius, padding: 20, ...style }}>{children}</div>;
const Btn = ({ children, onClick, disabled, variant = "primary", style }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: "100%", padding: "16px", borderRadius: 100, border: "none",
    background: disabled ? P.surfaceAlt : variant === "magic" ? "linear-gradient(135deg, #34C759, #30B350)" : variant === "primary" ? P.text : P.surfaceAlt,
    color: disabled ? P.textTer : variant === "secondary" ? P.text : "#fff",
    fontSize: 16, fontWeight: 700, cursor: disabled ? "default" : "pointer",
    fontFamily: "inherit", transition: "all .2s",
    boxShadow: variant === "magic" && !disabled ? "0 4px 14px rgba(52,199,89,.3)" : "none", ...style,
  }}>{children}</button>
);
const ModeCard = ({ icon, title, sub, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: "22px 12px 18px", borderRadius: P.radius, border: `1.5px solid ${P.border}`,
    background: P.surface, cursor: "pointer", textAlign: "center", display: "flex",
    flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit",
  }}>
    <span style={{ fontSize: 30 }}>{icon}</span>
    <span style={{ fontSize: 14, fontWeight: 700, color: P.text, marginTop: 6 }}>{title}</span>
    <span style={{ fontSize: 12, color: P.textTer }}>{sub}</span>
  </button>
);

function IngredientRow({ it, last }) {
  const [open, setOpen] = useState(false);
  const isOk = it.fodmap === "low";
  const catLabel = categoryLabel(it.category);
  return (
    <div style={{ borderBottom: last ? "none" : `1px solid ${P.border}` }}>
      <button onClick={() => !isOk && setOpen(!open)} style={{
        width: "100%", padding: "14px 0", background: "none", border: "none", cursor: isOk ? "default" : "pointer",
        display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit", textAlign: "left",
      }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: colorOf(it.fodmap), flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: P.text }}>{it.name}</span>
        {!isOk && <span style={{ fontSize: 13, color: P.textTer, transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>▾</span>}
        {isOk && <span style={{ fontSize: 13, color: P.green }}>✓</span>}
      </button>
      {open && !isOk && (
        <div style={{ padding: "0 0 14px 22px", animation: "fadeUp .2s ease-out" }}>
          {catLabel && <div style={{ display: "inline-block", fontSize: 11, fontWeight: 600, background: bgOf(it.fodmap), color: colorOf(it.fodmap), padding: "3px 10px", borderRadius: 6, marginBottom: 8 }}>{catLabel}</div>}
          {it.detail && <div style={{ fontSize: 13, color: P.textSec, lineHeight: 1.5, marginBottom: it.alternative ? 8 : 0 }}>{it.detail}</div>}
          {it.alternative && <div style={{ fontSize: 13, color: P.green, fontWeight: 500 }}>→ {it.alternative}</div>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_API_KEY || "");
  const [showSetup, setShowSetup] = useState(false);
  const [mode, setMode] = useState(null);
  // steps: "input" | "result" | "fix" | "recipe"
  const [step, setStep] = useState("input");
  const [input, setInput] = useState("");
  const [hungerInput, setHungerInput] = useState("");
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [productInfo, setProductInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [result, setResult] = useState(null);
  const [fix, setFix] = useState(null);
  const [recipe, setRecipe] = useState(null);
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
    setError(null); setResult(null); setFix(null); setRecipe(null);
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
    setScanning(false); setLoading(true); setLoadMsg("Produkt wird gesucht…"); setError(null); setResult(null); setFix(null); setRecipe(null); setMode("barcode-result");
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
      const prompt = PROMPT_LABEL + `\n\nProdukt: ${name}\nZutaten: ${ingredients}\n${nutri}`;
      const parsed = await callAI(prompt);
      setResult(parsed); setStep("result"); fade();
    } catch (e) { setError(String(e?.message || e)); }
    setLoading(false);
  }, [apiKey, callAI]);

  const loadFix = async () => {
    setLoading(true); setError(null);
    setLoadMsg("Wird verträglich gemacht ✨");
    try {
      const dishName = result?.title || input;
      const problems = result?.items?.filter(i => i.fodmap !== "low").map(i => `${i.name} (${i.alternative || "ersetzen"})`).join(", ");
      const parsed = await callAI(PROMPT_FIX + `\n\nDas Gericht: ${dishName}\nProblematische Zutaten: ${problems}`);
      setFix(parsed); setStep("fix"); fade();
    } catch (e) { setError(String(e?.message || e)); }
    setLoading(false);
  };

  const loadRecipe = async (fromFix) => {
    setLoading(true); setError(null);
    setLoadMsg("Rezept wird gezaubert ✨");
    try {
      const dishName = result?.title || input;
      let prompt;
      if (fromFix && fix) {
        const swaps = fix.changes?.map(c => `${c.problem} → ${c.solution}`).join(", ");
        prompt = PROMPT_RECIPE_FIXED + `\n\nOriginal: ${dishName}\nÄnderungen: ${swaps}`;
      } else {
        prompt = PROMPT_RECIPE + `\n\nDas Gericht: ${dishName}`;
      }
      const parsed = await callAI(prompt);
      setRecipe(parsed); setStep("recipe"); fade();
    } catch (e) { setError(String(e?.message || e)); }
    setLoading(false);
  };

  const loadHungerRecipe = async () => {
    const key = apiKey || import.meta.env.VITE_API_KEY;
    if (!key) { setShowSetup(true); return; }
    setLoading(true); setError(null); setStep("recipe"); setMode("hunger");
    setLoadMsg("Rezept wird gezaubert ✨");
    try {
      const parsed = await callAI(PROMPT_HUNGER + `\n\nDer Nutzer hat Hunger auf: ${hungerInput}`);
      setRecipe(parsed); fade();
    } catch (e) { setError(String(e?.message || e)); }
    setLoading(false);
  };

  const handleImg = (prompt) => e => {
    const f = e.target.files?.[0]; if (!f) return;
    setResult(null); setError(null); setFix(null); setRecipe(null); setMode("photo-result");
    const r = new FileReader();
    r.onload = () => { setImage(r.result); analyze(prompt, r.result); };
    r.readAsDataURL(f);
  };

  const reset = () => {
    setInput(""); setHungerInput(""); setImage(null); setResult(null); setFix(null); setRecipe(null);
    setError(null); setMode(null); setStep("input"); setProductInfo(null); setBarcodeManual(""); setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const isGreen = result?.overall === "low";

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.text, fontFamily: "SF Pro Display, -apple-system, 'Helvetica Neue', sans-serif", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeUp .3s ease-out}
        input:focus,textarea:focus{border-color:${P.text}!important;outline:none}
        ::placeholder{color:${P.textTer}}
        *{-webkit-tap-highlight-color:transparent}
        button:active{opacity:.7}
      `}</style>

      {scanning && <BarcodeScanner onDetect={onBarcode} onClose={() => setScanning(false)} />}

      {/* Header */}
      <div style={{ padding: "24px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "baseline", gap: 2 }}>
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: -.8, color: P.text }}>nouri</span>
          <span style={{ fontSize: 26, fontWeight: 800, color: P.green }}>.</span>
        </button>
        <button onClick={() => setShowSetup(!showSetup)} style={{
          width: 40, height: 40, borderRadius: 12, border: `1.5px solid ${P.border}`,
          background: P.surface, color: P.textSec, fontSize: 17, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>⚙</button>
      </div>

      {showSetup && (
        <div style={{ padding: "12px 20px 0" }}>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>API Key</div>
            <div style={{ fontSize: 13, color: P.textSec, marginBottom: 12 }}>Dein Anthropic API Key.</div>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-ant-..." type="password"
              style={{ width: "100%", background: P.surfaceAlt, border: `1.5px solid ${P.border}`, borderRadius: P.radiusSm, padding: "12px 14px", color: P.text, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
            {apiKey && <div style={{ fontSize: 12, color: P.green, marginTop: 8, fontWeight: 600 }}>✓ Verbunden</div>}
          </Card>
        </div>
      )}

      <div style={{ padding: "0 20px" }}>

        {/* ═══ INPUT ═══ */}
        {step === "input" && (
          <>
            {!mode && !loading && (
              <div style={{ paddingTop: 24 }}>
                {/* Section 1: Check */}
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15, letterSpacing: -.5 }}>Vertrag ich das?</div>
                <div style={{ fontSize: 15, color: P.textSec, marginTop: 8, marginBottom: 24, lineHeight: 1.5 }}>Prüfe dein Essen auf Verträglichkeit.</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 40 }}>
                  <ModeCard icon="✏️" title="Eintippen" sub="Gericht beschreiben" onClick={() => setMode("text")} />
                  <ModeCard icon="📸" title="Foto" sub="Essen oder Zutaten" onClick={() => fileRef.current?.click()} />
                  <ModeCard icon="📦" title="Barcode" sub="Produkt scannen" onClick={() => setMode("barcode")} />
                </div>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImg(PROMPT_CHECK)} style={{ display: "none" }} />

                {/* Section 2: Hunger */}
                <div style={{ height: 1, background: P.border, marginBottom: 32 }} />
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, letterSpacing: -.3 }}>Worauf hast du Hunger?</div>
                <div style={{ fontSize: 15, color: P.textSec, marginTop: 6, marginBottom: 18, lineHeight: 1.5 }}>Wir zaubern dir ein verträgliches Rezept.</div>
                <input value={hungerInput} onChange={e => setHungerInput(e.target.value)} placeholder="z.B. Pasta, was mit Hähnchen, Curry…"
                  style={{ width: "100%", background: P.surfaceAlt, border: `1.5px solid ${P.border}`, borderRadius: P.radiusSm, padding: "14px", color: P.text, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }} />
                <Btn variant="magic" onClick={loadHungerRecipe} disabled={!hungerInput.trim()}>Rezept zaubern 🪄</Btn>

                {!hungerInput && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                    {["Pasta", "Hähnchen", "Salat", "Curry", "Risotto", "Suppe", "Bowl", "Pfanne"].map((q, i) => (
                      <button key={i} onClick={() => setHungerInput(q)} style={{
                        fontSize: 13, fontWeight: 500, background: P.surface, border: `1.5px solid ${P.border}`,
                        color: P.text, padding: "8px 14px", borderRadius: 100, cursor: "pointer", fontFamily: "inherit",
                      }}>{q}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mode === "text" && !loading && (
              <Card style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <button onClick={() => setMode(null)} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${P.border}`, background: P.surface, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>Gericht beschreiben</div>
                    <div style={{ fontSize: 13, color: P.textSec }}>Was möchtest du essen?</div>
                  </div>
                </div>
                <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="z.B. Pasta mit Knoblauch und Sahnesauce" rows={3}
                  style={{ width: "100%", background: P.surfaceAlt, border: `1.5px solid ${P.border}`, borderRadius: P.radiusSm, padding: "14px", color: P.text, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5, marginBottom: 14 }} />
                <Btn onClick={() => analyze()} disabled={!input.trim()}>Prüfen</Btn>
              </Card>
            )}

            {mode === "barcode" && !loading && (
              <Card style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <button onClick={() => setMode(null)} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${P.border}`, background: P.surface, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>Produkt scannen</div>
                    <div style={{ fontSize: 13, color: P.textSec }}>Barcode auf der Verpackung</div>
                  </div>
                </div>
                <Btn onClick={() => setScanning(true)}>Kamera öffnen</Btn>
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
                  <div style={{ flex: 1, height: 1, background: P.border }} />
                  <span style={{ fontSize: 12, color: P.textTer, fontWeight: 500 }}>oder manuell</span>
                  <div style={{ flex: 1, height: 1, background: P.border }} />
                </div>
                <input value={barcodeManual} onChange={e => setBarcodeManual(e.target.value.replace(/\D/g, ""))} placeholder="EAN-Nummer eingeben" inputMode="numeric"
                  style={{ width: "100%", background: P.surfaceAlt, border: `1.5px solid ${P.border}`, borderRadius: P.radiusSm, padding: "14px", color: P.text, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }} />
                <Btn onClick={() => barcodeManual.length >= 8 && onBarcode(barcodeManual)} disabled={barcodeManual.length < 8}>Suchen</Btn>
              </Card>
            )}
          </>
        )}

        {/* Loading */}
        {loading && (
          <Card style={{ textAlign: "center", padding: "48px 20px", marginTop: 16 }}>
            {productInfo?.image && <img src={productInfo.image} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", margin: "0 auto 14px", display: "block" }} />}
            <div style={{ width: 32, height: 32, margin: "0 auto 16px", border: `3px solid ${P.border}`, borderTopColor: P.green, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: P.textSec }}>{loadMsg}</div>
          </Card>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ background: P.redBg, border: `1px solid ${P.redBd}`, borderRadius: P.radius, padding: 16, fontSize: 14, color: P.red, lineHeight: 1.5, marginTop: 16 }}>
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
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{productInfo.name}</div>
                  {productInfo.nutri && <div style={{ fontSize: 12, color: P.textTer }}>{productInfo.nutri}</div>}
                </div>
              </div>
            )}
            {image && !productInfo && (
              <div style={{ marginBottom: 16 }}>
                <img src={image} alt="" style={{ width: "100%", borderRadius: P.radius, maxHeight: 160, objectFit: "cover" }} />
              </div>
            )}
            <Card style={{ marginBottom: 12, borderLeft: `4px solid ${colorOf(result.overall)}` }}>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>{result.title}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: bgOf(result.overall), padding: "8px 14px", borderRadius: 100, marginBottom: result.summary ? 14 : 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, background: colorOf(result.overall) }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: colorOf(result.overall) }}>
                  {result.overall === "low" ? "Verträglich" : result.overall === "moderate" ? "Vorsicht" : "Nicht verträglich"}
                </span>
              </div>
              {result.summary && <div style={{ fontSize: 15, color: P.textSec, lineHeight: 1.6 }}>{result.summary}</div>}
            </Card>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: P.textTer, marginBottom: 4 }}>Zutaten</div>
              <div style={{ fontSize: 12, color: P.textTer, marginBottom: 12 }}>Tippe auf eine Zutat für Details</div>
              {result.items?.map((it, i) => <IngredientRow key={i} it={it} last={i === result.items.length - 1} />)}
            </Card>
            <Btn variant="magic" onClick={isGreen ? () => loadRecipe(false) : loadFix} style={{ marginBottom: 8 }}>
              {isGreen ? "Rezept anzeigen 🪄" : "Verträglich machen 🪄"}
            </Btn>
            <Btn variant="secondary" onClick={reset}>Neuer Check</Btn>
          </div>
        )}

        {/* ═══ FIX ═══ */}
        {step === "fix" && fix && !loading && (
          <div className={fadeIn ? "fade-in" : ""} style={{ paddingTop: 16 }}>
            <Card style={{ marginBottom: 12, borderLeft: `4px solid ${P.green}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.green, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>✨ So wird's verträglich</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{fix.title || result?.title}</div>
              {fix.summary && <div style={{ fontSize: 15, color: P.textSec, lineHeight: 1.6, marginBottom: 16 }}>{fix.summary}</div>}

              {fix.changes?.map((c, i) => (
                <div key={i} style={{ background: P.surfaceAlt, borderRadius: 12, padding: 14, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: c.why ? 6 : 0 }}>
                    <span style={{ fontSize: 14, color: P.red, textDecoration: "line-through", fontWeight: 500 }}>{c.problem}</span>
                    <span style={{ color: P.textTer }}>→</span>
                    <span style={{ fontSize: 14, color: P.green, fontWeight: 600 }}>{c.solution}</span>
                  </div>
                  {c.why && <div style={{ fontSize: 13, color: P.textSec, lineHeight: 1.4 }}>{c.why}</div>}
                </div>
              ))}
            </Card>

            <Btn variant="magic" onClick={() => loadRecipe(true)} style={{ marginBottom: 8 }}>Rezept anzeigen 🪄</Btn>
            <Btn variant="secondary" onClick={() => { setStep("result"); setFix(null); setError(null); }} style={{ marginBottom: 8 }}>← Zurück</Btn>
            <Btn variant="secondary" onClick={reset}>Neuer Check</Btn>
          </div>
        )}

        {/* ═══ RECIPE ═══ */}
        {step === "recipe" && recipe && !loading && (
          <div className={fadeIn ? "fade-in" : ""} style={{ paddingTop: 16 }}>
            <Card style={{ marginBottom: 12, border: `1.5px solid ${P.greenBd}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.green, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>✨ Dein Rezept</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{recipe.title}</div>
              {recipe.description && <div style={{ fontSize: 14, color: P.textSec, lineHeight: 1.5, marginBottom: 16 }}>{recipe.description}</div>}

              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {recipe.servings && <div style={{ background: P.surfaceAlt, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: P.textSec, fontWeight: 500 }}>👤 {recipe.servings} Portionen</div>}
                {recipe.time && <div style={{ background: P.surfaceAlt, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: P.textSec, fontWeight: 500 }}>⏱ {recipe.time}</div>}
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: P.textTer, marginBottom: 10 }}>Zutaten</div>
              <div style={{ marginBottom: 20 }}>
                {recipe.ingredients?.map((ing, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < recipe.ingredients.length - 1 ? `1px solid ${P.border}` : "none" }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: P.green, flexShrink: 0 }} />
                    <span style={{ fontSize: 14 }}>{ing}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: P.textTer, marginBottom: 10 }}>Zubereitung</div>
              {recipe.steps?.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 14, background: P.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: P.textSec, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 14, color: P.text, lineHeight: 1.6, paddingTop: 3 }}>{s}</div>
                </div>
              ))}

              {recipe.tip && (
                <div style={{ background: P.amberBg, borderRadius: 12, padding: 14, border: `1px solid ${P.amberBd}`, marginTop: 8 }}>
                  <div style={{ fontSize: 13, color: P.text, lineHeight: 1.5 }}>💡 {recipe.tip}</div>
                </div>
              )}
            </Card>

            <Btn variant="secondary" onClick={() => {
              setStep(fix ? "fix" : result ? "result" : "input");
              setRecipe(null); setError(null);
            }} style={{ marginBottom: 8 }}>← Zurück</Btn>
            <Btn variant="secondary" onClick={reset}>Neuer Check</Btn>
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: P.textTer, marginTop: 32, padding: "0 20px" }}>Kein Ersatz für ärztliche Beratung</div>
    </div>
  );
}