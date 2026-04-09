import { useState, useEffect, useRef, useCallback } from "react";

/* ── palette & helpers ── */
const P = {
  bg: "#FAFAFA", surface: "#FFFFFF", surfaceAlt: "#F5F5F5",
  text: "#1A1A1A", textSec: "#8E8E93", textTer: "#AEAEB2",
  border: "#F2F2F7", borderActive: "#E5E5EA",
  green: "#34C759", greenBg: "#E8F9ED", greenBd: "#B8F0C8",
  amber: "#FF9500", amberBg: "#FFF4E0", amberBd: "#FFE0A3",
  red: "#FF3B30", redBg: "#FFEDEC", redBd: "#FFC5C2",
  accent: "#34C759", accentSoft: "#E8F9ED",
  radius: 16, radiusSm: 12, radiusXs: 8,
};
const colorOf = l => l === "low" ? P.green : l === "moderate" ? P.amber : P.red;
const bgOf = l => l === "low" ? P.greenBg : l === "moderate" ? P.amberBg : P.redBg;
const bdOf = l => l === "low" ? P.greenBd : l === "moderate" ? P.amberBd : P.redBd;
const labelOf = l => l === "low" ? "Verträglich" : l === "moderate" ? "Vorsicht" : "Meiden";
const emojiOf = l => l === "low" ? "✅" : l === "moderate" ? "⚠️" : "🚫";

const MODEL = "claude-haiku-4-5-20251001";
const PROMPT_CHECK = `FODMAP-Experte (Monash). Analysiere das Essen. NUR JSON:\n{"title":"Name","overall":"low/moderate/high","summary":"2 Sätze DE","items":[{"name":"Zutat","fodmap":"low/moderate/high","category":"Fructose/Lactose/Fructane/GOS/Polyole/keine","note":"Hinweis DE","alternative":"Alternative oder null"}],"tip":"SIBO-Tipp DE","safe_version":"FODMAP-arm Umbau oder null"}`;
const PROMPT_LABEL = `FODMAP-Experte. Analysiere diese Zutatenliste/Label. Suche ALLE problematischen Stoffe (Fructose, Lactose, Fructane, GOS, Polyole, Inulin, Sorbitol, Mannitol, Xylitol, Zwiebel, Knoblauch). NUR JSON:\n{"title":"Produktname","overall":"low/moderate/high","summary":"2 Sätze DE","items":[{"name":"Zutat","fodmap":"low/moderate/high","category":"Fructose/Lactose/Fructane/GOS/Polyole/keine","note":"Hinweis DE","alternative":"null oder Alternative"}],"tip":"Tipp DE","safe_version":"Bessere Alternative oder null"}`;
const PROMPT_SWAP = `Kreativer FODMAP-Koch. 3 leckere FODMAP-arme Alternativen. NUR JSON:\n{"original":"Name","alternatives":[{"title":"Alternative","why":"Warum gut (1 Satz DE)","swap_out":"Problematisch","swap_in":"Ersatz-Zutaten","effort":"einfach/mittel/aufwendig"}]}`;

/* ── ZXing loader ── */
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

/* ── Barcode Scanner ── */
function BarcodeScanner({ onDetect, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [status, setStatus] = useState("starting");
  const [error, setError] = useState(null);

  const handleClose = useCallback(() => {
    if (readerRef.current) { try { readerRef.current.reset(); } catch {} }
    onClose();
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const ZXing = await loadZXing();
        if (cancelled) return;
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
          ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E,
          ZXing.BarcodeFormat.CODE_128,
        ]);
        const reader = new ZXing.BrowserMultiFormatReader(hints);
        readerRef.current = reader;
        if (!cancelled) setStatus("scanning");
        await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result) => {
            if (cancelled) return;
            if (result) {
              cancelled = true;
              if (navigator.vibrate) navigator.vibrate(100);
              try { reader.reset(); } catch {}
              onDetect(result.getText());
            }
          }
        );
      } catch (e) {
        if (!cancelled) {
          setError(e?.name === "NotAllowedError"
            ? "Kamera-Zugriff verweigert. Bitte in den Einstellungen erlauben."
            : "Kamera konnte nicht gestartet werden.");
          setStatus("error");
        }
      }
    };
    start();
    return () => { cancelled = true; if (readerRef.current) { try { readerRef.current.reset(); } catch {} } };
  }, [onDetect]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#000", display: "flex", flexDirection: "column" }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      {status === "scanning" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: 240, height: 140, border: "3px solid rgba(255,255,255,.6)", borderRadius: 20, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }} />
        </div>
      )}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 24px 52px", background: "linear-gradient(transparent,rgba(0,0,0,.85))", textAlign: "center" }}>
        {error
          ? <div style={{ color: "#fca5a5", fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>{error}</div>
          : <div style={{ color: "rgba(255,255,255,.7)", fontSize: 14, fontWeight: 500, marginBottom: 16, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>
              {status === "starting" ? "Wird geladen…" : "Barcode in den Rahmen halten"}
            </div>
        }
        <button onClick={handleClose} style={{ padding: "12px 40px", borderRadius: 100, border: "none", background: "rgba(255,255,255,.15)", backdropFilter: "blur(20px)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>Abbrechen</button>
      </div>
    </div>
  );
}

/* ── Reusable Components ── */
const Card = ({ children, style }) => (
  <div style={{ background: P.surface, borderRadius: P.radius, padding: 20, ...style }}>{children}</div>
);

const ActionButton = ({ children, onClick, disabled, variant = "primary", style }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: "100%", padding: "16px", borderRadius: 100, border: "none",
    background: disabled ? P.surfaceAlt : variant === "primary" ? P.text : P.surfaceAlt,
    color: disabled ? P.textTer : variant === "primary" ? "#fff" : P.text,
    fontSize: 16, fontWeight: 700, cursor: disabled ? "default" : "pointer",
    fontFamily: "inherit", transition: "all .2s", ...style,
  }}>{children}</button>
);

const InputModeCard = ({ icon, title, sub, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: "22px 12px 18px", borderRadius: P.radius, border: `1.5px solid ${P.border}`,
    background: P.surface, cursor: "pointer", textAlign: "center", display: "flex",
    flexDirection: "column", alignItems: "center", gap: 4, transition: "all .15s",
    fontFamily: "inherit",
  }}>
    <span style={{ fontSize: 30, lineHeight: 1 }}>{icon}</span>
    <span style={{ fontSize: 14, fontWeight: 700, color: P.text, marginTop: 6 }}>{title}</span>
    <span style={{ fontSize: 12, color: P.textTer, lineHeight: 1.3 }}>{sub}</span>
  </button>
);

/* ── Main App ── */
export default function App() {
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_API_KEY || "");
  const [showSetup, setShowSetup] = useState(false);
  const [tab, setTab] = useState("check");
  const [mode, setMode] = useState(null);
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [productInfo, setProductInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [result, setResult] = useState(null);
  const [swapResult, setSwapResult] = useState(null);
  const [error, setError] = useState(null);
  const [fadeIn, setFadeIn] = useState(false);
  const [barcodeManual, setBarcodeManual] = useState("");
  const fileRef = useRef();

  const saveKey = k => { setApiKey(k); };

  const callAI = useCallback(async (content) => {
    const key = apiKey || import.meta.env.VITE_API_KEY;
    if (!key) throw new Error("Kein API Key hinterlegt");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, messages: [{ role: "user", content }] })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const raw = data.content.filter(b => b.type === "text").map(b => b.text).join("");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Keine Analyse erhalten");
    return JSON.parse(m[0]);
  }, [apiKey]);

  const showRes = (parsed) => { setResult(parsed); setFadeIn(true); setTimeout(() => setFadeIn(false), 500); };

  const analyze = async (promptOverride, imgOverride) => {
    const key = apiKey || import.meta.env.VITE_API_KEY;
    if (!key) { setShowSetup(true); return; }
    setLoading(true); setLoadMsg(imgOverride || image ? "Bild wird analysiert…" : "Wird analysiert…");
    setError(null); setResult(null);
    try {
      const prompt = promptOverride || PROMPT_CHECK;
      const img = imgOverride || image;
      let content;
      if (img) {
        const b = img.split(",")[1], mt = img.split(";")[0].split(":")[1];
        content = [{ type: "image", source: { type: "base64", media_type: mt, data: b } }, { type: "text", text: prompt }];
      } else {
        content = prompt + "\n\nDas Essen: " + input;
      }
      showRes(await callAI(content));
    } catch (e) { setError(String(e?.message || e)); }
    setLoading(false);
  };

  const onBarcode = useCallback(async (code) => {
    setScanning(false); setLoading(true); setLoadMsg("Produkt wird gesucht…"); setError(null); setResult(null); setMode("barcode-result");
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const data = await res.json();
      if (data.status !== 1) throw new Error("Produkt nicht gefunden (EAN: " + code + ")");
      const p = data.product;
      const name = p.product_name || p.product_name_de || "Unbekannt";
      const ingredients = p.ingredients_text_de || p.ingredients_text || "";
      const nutri = p.nutriscore_grade ? `Nutriscore ${p.nutriscore_grade.toUpperCase()}` : "";
      setProductInfo({ name, code, image: p.image_front_small_url, ingredients, nutri });
      setLoadMsg("FODMAP-Analyse läuft…");
      const prompt = PROMPT_LABEL + `\n\nProdukt: ${name}\nZutaten: ${ingredients}\n${nutri}`;
      showRes(await callAI(prompt));
    } catch (e) { setError(String(e?.message || e)); }
    setLoading(false);
  }, [apiKey, callAI]);

  const swapAI = async () => {
    const key = apiKey || import.meta.env.VITE_API_KEY;
    if (!key) { setShowSetup(true); return; }
    setLoading(true); setLoadMsg("Alternativen werden gesucht…"); setError(null); setSwapResult(null);
    try {
      const parsed = await callAI(PROMPT_SWAP + "\n\nDas Gericht: " + input);
      setSwapResult(parsed); setFadeIn(true); setTimeout(() => setFadeIn(false), 500);
    } catch (e) { setError(String(e?.message || e)); }
    setLoading(false);
  };

  const handleImg = (prompt) => e => {
    const f = e.target.files?.[0]; if (!f) return;
    setResult(null); setError(null); setMode("photo-result");
    const r = new FileReader();
    r.onload = () => { setImage(r.result); analyze(prompt, r.result); };
    r.readAsDataURL(f);
  };

  const reset = () => {
    setInput(""); setImage(null); setResult(null); setSwapResult(null);
    setError(null); setMode(null); setProductInfo(null); setBarcodeManual("");
    if (fileRef.current) fileRef.current.value = "";
  };

  /* ── Result Sub-Components ── */
  const ResultBadge = ({ overall }) => (
    <div style={{
      background: bgOf(overall), border: `1.5px solid ${bdOf(overall)}`,
      borderRadius: P.radius, padding: "16px 18px",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, background: colorOf(overall),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, color: "#fff", fontWeight: 800, flexShrink: 0,
      }}>
        {overall === "low" ? "✓" : overall === "moderate" ? "!" : "✕"}
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: colorOf(overall) }}>{labelOf(overall)}</div>
        <div style={{ fontSize: 12, color: P.textSec, marginTop: 2 }}>FODMAP-Gehalt: {overall === "low" ? "niedrig" : overall === "moderate" ? "mittel" : "hoch"}</div>
      </div>
    </div>
  );

  const ItemRow = ({ it, last }) => (
    <div style={{ padding: "14px 0", borderBottom: last ? "none" : `1px solid ${P.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: bgOf(it.fodmap),
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0,
        }}>{emojiOf(it.fodmap)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{it.name}</span>
            {it.category && it.category !== "keine" && (
              <span style={{
                fontSize: 10, fontWeight: 700, background: bgOf(it.fodmap), color: colorOf(it.fodmap),
                padding: "3px 8px", borderRadius: 6, textTransform: "uppercase", letterSpacing: .3, whiteSpace: "nowrap",
              }}>{it.category}</span>
            )}
          </div>
          {it.note && <div style={{ fontSize: 13, color: P.textSec, marginTop: 3, lineHeight: 1.5 }}>{it.note}</div>}
          {it.alternative && (
            <div style={{
              fontSize: 13, marginTop: 6, background: P.greenBg, border: `1px solid ${P.greenBd}`,
              borderRadius: 10, padding: "8px 10px", color: P.green, lineHeight: 1.4, fontWeight: 500,
            }}>→ {it.alternative}</div>
          )}
        </div>
      </div>
    </div>
  );

  const tipBox = (color, bgColor, bdColor, icon, label, text) => (
    <div style={{ background: bgColor, borderRadius: P.radius, padding: 16, border: `1px solid ${bdColor}`, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>{icon} {label}</div>
      <div style={{ fontSize: 13, color: P.text, lineHeight: 1.6 }}>{text}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.text, fontFamily: "SF Pro Display, -apple-system, 'Helvetica Neue', sans-serif", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .fade-in { animation: fadeUp .3s ease-out }
        input:focus, textarea:focus { border-color: ${P.text} !important; outline: none; }
        ::placeholder { color: ${P.textTer}; }
        * { -webkit-tap-highlight-color: transparent; }
        button:active { opacity: .7; }
      `}</style>

      {scanning && <BarcodeScanner onDetect={onBarcode} onClose={() => setScanning(false)} />}

      {/* ── Header ── */}
      <div style={{ padding: "24px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: -.8, color: P.text }}>nouri</span>
          <span style={{ fontSize: 26, fontWeight: 800, color: P.green }}>.</span>
        </div>
        <button onClick={() => setShowSetup(!showSetup)} style={{
          width: 40, height: 40, borderRadius: 12, border: `1.5px solid ${P.border}`,
          background: P.surface, color: P.textSec, fontSize: 17, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>⚙</button>
      </div>

      {/* API Key Setup */}
      {showSetup && (
        <div style={{ padding: "12px 20px 0" }}>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>API Key</div>
            <div style={{ fontSize: 13, color: P.textSec, marginBottom: 12, lineHeight: 1.4 }}>Dein Anthropic API Key für die AI-Analyse.</div>
            <input value={apiKey} onChange={e => saveKey(e.target.value)} placeholder="sk-ant-..." type="password"
              style={{ width: "100%", background: P.surfaceAlt, border: `1.5px solid ${P.border}`, borderRadius: P.radiusSm, padding: "12px 14px", color: P.text, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", transition: "border .2s" }} />
            {apiKey && <div style={{ fontSize: 12, color: P.green, marginTop: 8, fontWeight: 600 }}>✓ Verbunden</div>}
          </Card>
        </div>
      )}

      {/* ── Navigation ── */}
      <div style={{ display: "flex", gap: 0, padding: "20px 20px 0" }}>
        {[
          ["check", "Verträglich?"],
          ["swap", "Besser machen"],
        ].map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); reset(); }} style={{
            padding: "10px 18px", borderRadius: 100, border: "none",
            background: tab === k ? P.text : "transparent",
            color: tab === k ? "#fff" : P.textTer,
            fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            transition: "all .2s",
          }}>{l}</button>
        ))}
      </div>

      {/* ── CHECK TAB ── */}
      {tab === "check" && (
        <div style={{ padding: "16px 20px 0" }}>
          {/* Mode Selection */}
          {!mode && !loading && !result && (
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, lineHeight: 1.2 }}>Was steht auf<br/>dem Speiseplan?</div>
              <div style={{ fontSize: 14, color: P.textSec, marginBottom: 20 }}>Finde heraus, ob dein Essen verträglich ist.</div>
              <div style={{ display: "flex", gap: 10 }}>
                <InputModeCard icon="✏️" title="Eintippen" sub="Gericht beschreiben" onClick={() => setMode("text")} />
                <InputModeCard icon="📸" title="Foto" sub="Essen oder Zutaten" onClick={() => fileRef.current?.click()} />
                <InputModeCard icon="📦" title="Barcode" sub="Produkt scannen" onClick={() => setMode("barcode")} />
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImg(PROMPT_CHECK)} style={{ display: "none" }} />
            </div>
          )}

          {/* Barcode Mode */}
          {mode === "barcode" && !loading && !result && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <button onClick={() => setMode(null)} style={{
                  width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${P.border}`,
                  background: P.surface, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>←</button>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>Produkt scannen</div>
                  <div style={{ fontSize: 13, color: P.textSec }}>Scanne den Barcode auf der Verpackung</div>
                </div>
              </div>
              <ActionButton onClick={() => setScanning(true)}>Kamera öffnen</ActionButton>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
                <div style={{ flex: 1, height: 1, background: P.border }} />
                <span style={{ fontSize: 12, color: P.textTer, fontWeight: 500 }}>oder manuell</span>
                <div style={{ flex: 1, height: 1, background: P.border }} />
              </div>
              <input value={barcodeManual} onChange={e => setBarcodeManual(e.target.value.replace(/\D/g, ""))}
                placeholder="EAN-Nummer eingeben" inputMode="numeric"
                style={{ width: "100%", background: P.surfaceAlt, border: `1.5px solid ${P.border}`, borderRadius: P.radiusSm, padding: "14px 14px", color: P.text, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }} />
              <ActionButton onClick={() => barcodeManual.length >= 8 && onBarcode(barcodeManual)} disabled={barcodeManual.length < 8}>Produkt suchen</ActionButton>
            </Card>
          )}

          {/* Text Mode */}
          {mode === "text" && !loading && !result && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <button onClick={() => setMode(null)} style={{
                  width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${P.border}`,
                  background: P.surface, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>←</button>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>Gericht beschreiben</div>
                  <div style={{ fontSize: 13, color: P.textSec }}>Was möchtest du essen?</div>
                </div>
              </div>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                placeholder={"z.B. Pasta mit Knoblauch und Sahnesauce\noder: Apfel, Joghurt, Honig"} rows={3}
                style={{ width: "100%", background: P.surfaceAlt, border: `1.5px solid ${P.border}`, borderRadius: P.radiusSm, padding: "14px", color: P.text, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5, marginBottom: 14 }} />
              <ActionButton onClick={() => analyze()} disabled={!input.trim()}>Verträglichkeit prüfen</ActionButton>
            </Card>
          )}

          {/* Loading */}
          {loading && (
            <Card style={{ textAlign: "center", padding: "40px 20px" }}>
              {productInfo?.image && <img src={productInfo.image} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", margin: "0 auto 14px", display: "block" }} />}
              <div style={{ width: 32, height: 32, margin: "0 auto 14px", border: `3px solid ${P.border}`, borderTopColor: P.green, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: P.textSec }}>{loadMsg}</div>
              {productInfo && <div style={{ fontSize: 13, color: P.textTer, marginTop: 4 }}>{productInfo.name}</div>}
            </Card>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: P.redBg, border: `1px solid ${P.redBd}`, borderRadius: P.radius, padding: "16px", fontSize: 14, color: P.red, lineHeight: 1.5 }}>
              {error}
              <div onClick={reset} style={{ marginTop: 10, fontSize: 13, fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>Nochmal versuchen</div>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className={fadeIn ? "fade-in" : ""}>
              {productInfo && (
                <Card style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  {productInfo.image && <img src={productInfo.image} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: P.textTer, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>Gescannt</div>
                    <div style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{productInfo.name}</div>
                    {productInfo.nutri && <div style={{ fontSize: 12, color: P.textSec, marginTop: 1 }}>{productInfo.nutri} · EAN {productInfo.code}</div>}
                  </div>
                </Card>
              )}
              {image && !productInfo && (
                <div style={{ marginBottom: 12 }}>
                  <img src={image} alt="" style={{ width: "100%", borderRadius: P.radius, maxHeight: 180, objectFit: "cover" }} />
                </div>
              )}
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>{result.title}</div>
                <ResultBadge overall={result.overall} />
                {result.summary && <div style={{ fontSize: 14, color: P.textSec, lineHeight: 1.6, marginTop: 16 }}>{result.summary}</div>}
              </Card>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, color: P.textTer, marginBottom: 8 }}>Einzelne Zutaten</div>
                {result.items?.map((it, i) => <ItemRow key={i} it={it} last={i === result.items.length - 1} />)}
              </Card>
              {result.safe_version && tipBox(P.green, P.greenBg, P.greenBd, "💡", "So wird's verträglich", result.safe_version)}
              {result.tip && tipBox(P.amber, P.amberBg, P.amberBd, "🧠", "Gut zu wissen", result.tip)}
              <ActionButton onClick={reset} variant="secondary" style={{ marginTop: 4 }}>Neuer Check</ActionButton>
            </div>
          )}
        </div>
      )}

      {/* ── SWAP TAB ── */}
      {tab === "swap" && (
        <div style={{ padding: "16px 20px 0" }}>
          {!loading && !swapResult && (
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, lineHeight: 1.2 }}>Dein Lieblingsessen,<br/>nur verträglicher.</div>
              <div style={{ fontSize: 14, color: P.textSec, marginBottom: 20, lineHeight: 1.5 }}>Sag uns welches Gericht du liebst — wir zeigen dir, wie du es verträglich machen kannst.</div>
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="z.B. Pizza, Döner, Pasta Bolognese…"
                style={{ width: "100%", background: P.surfaceAlt, border: `1.5px solid ${P.border}`, borderRadius: P.radiusSm, padding: "14px", color: P.text, fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />
              <ActionButton onClick={swapAI} disabled={!input.trim()}>Alternativen finden</ActionButton>
              {!input && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: P.textTer, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Beliebt</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["Pasta Bolognese", "Pizza", "Döner", "Burger", "Risotto", "Curry", "Ramen", "Müsli"].map((q, i) => (
                      <button key={i} onClick={() => setInput(q)} style={{
                        fontSize: 13, fontWeight: 500, background: P.surface, border: `1.5px solid ${P.border}`,
                        color: P.text, padding: "8px 14px", borderRadius: 100, cursor: "pointer", fontFamily: "inherit",
                      }}>{q}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {loading && (
            <Card style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ width: 32, height: 32, margin: "0 auto 14px", border: `3px solid ${P.border}`, borderTopColor: P.green, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: P.textSec }}>{loadMsg}</div>
            </Card>
          )}
          {error && (
            <div style={{ background: P.redBg, border: `1px solid ${P.redBd}`, borderRadius: P.radius, padding: "16px", fontSize: 14, color: P.red }}>
              {error}
              <div onClick={reset} style={{ marginTop: 10, fontSize: 13, fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>Nochmal versuchen</div>
            </div>
          )}
          {swapResult && !loading && (
            <div className={fadeIn ? "fade-in" : ""}>
              <div style={{ fontSize: 13, color: P.textTer, fontWeight: 600, marginBottom: 4 }}>Statt „{swapResult.original}"</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>3 verträgliche Ideen</div>
              {swapResult.alternatives?.map((a, i) => (
                <Card key={i} style={{ marginBottom: 10, border: `1.5px solid ${P.greenBd}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: P.text, flex: 1 }}>{a.title}</div>
                    <span style={{
                      fontSize: 11, background: P.surfaceAlt, color: P.textSec,
                      padding: "4px 10px", borderRadius: 100, fontWeight: 600, whiteSpace: "nowrap",
                    }}>{a.effort === "einfach" ? "⚡ Schnell" : a.effort === "mittel" ? "👩‍🍳 Mittel" : "🎯 Aufwendig"}</span>
                  </div>
                  <div style={{ fontSize: 14, color: P.textSec, lineHeight: 1.5, marginBottom: 14 }}>{a.why}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, background: P.redBg, borderRadius: P.radiusSm, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: P.red, textTransform: "uppercase", letterSpacing: .3, marginBottom: 4 }}>Weglassen</div>
                      <div style={{ fontSize: 13, color: P.textSec, lineHeight: 1.4 }}>{a.swap_out}</div>
                    </div>
                    <div style={{ flex: 1, background: P.greenBg, borderRadius: P.radiusSm, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: P.green, textTransform: "uppercase", letterSpacing: .3, marginBottom: 4 }}>Stattdessen</div>
                      <div style={{ fontSize: 13, color: P.textSec, lineHeight: 1.4 }}>{a.swap_in}</div>
                    </div>
                  </div>
                </Card>
              ))}
              <ActionButton onClick={reset} variant="secondary" style={{ marginTop: 4 }}>Nochmal suchen</ActionButton>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 11, color: P.textTer, marginTop: 32, padding: "0 20px", lineHeight: 1.5 }}>
        Kein Ersatz für ärztliche Beratung
      </div>
    </div>
  );
}