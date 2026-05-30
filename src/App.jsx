import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client (unchanged) ──────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Local Tokyo location corpus (M29 cohort) ────────────────────────────────
// You can keep adding spots here — and ANY raw string the user types is also
// accepted as a destination now (Global Search Bug fix).
const LOCAL_LOCATIONS = [
  "Minerva Tokyo Residence",
  "Shibuya Station",
  "Shibuya Crossing",
  "Shinjuku Station",
  "Harajuku",
  "Roppongi",
  "Akihabara",
  "Ueno Park",
  "Tokyo Tower",
  "Don Quijote",
  "FamilyMart (downstairs)",
  "7-Eleven (corner)",
  "Lawson",
  "Starbucks Reserve Roastery",
  "% Arabica",
  "Tsutaya Daikanyama",
  "Yoyogi Park",
  "Haneda Airport",
  "Narita Airport",
];

// ── Trip types: Tokyo Pivot (replacing drive/walk) ──────────────────────────
const TRIP_TYPES = [
  { key: "walk",  label: "Walk",   emoji: "🚶" },
  { key: "train", label: "Train",  emoji: "🚆" },
  { key: "taxi",  label: "Taxi",   emoji: "🚕" },
  { key: "drive", label: "Drive",  emoji: "🚗" }, // kept for backward compat
];

const EMOJI_BY_TYPE = {
  walk:  ["🚶", "🏃", "🚶‍♂️", "🚶‍♀️", "🏃‍♀️"],
  train: ["🚆", "🚇", "🚊", "🚉"],
  taxi:  ["🚕", "🚖"],
  drive: ["🚗", "🚙", "🚕", "🛻", "🚐"],
};

const poolEmoji = (pool) => {
  if (pool?.emoji) return pool.emoji;
  const set = EMOJI_BY_TYPE[pool?.trip_type] || EMOJI_BY_TYPE.walk;
  return set[(pool?.id ?? 0) % set.length];
};

const tripTypeLabel = (t) =>
  (TRIP_TYPES.find((x) => x.key === t) || { label: "Move" }).label;

// ── Helpers ─────────────────────────────────────────────────────────────────
const vibrate = (pattern) => { if (navigator?.vibrate) navigator.vibrate(pattern); };

const playAudio = (type = "pop") => {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const now  = ctx.currentTime;

    const tone = (freqStart, freqEnd, dur, gainPeak = 0.28, wave = "sine", delay = 0) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type  = wave;
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.setValueAtTime(freqStart, now + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + delay + dur);
      g.gain.setValueAtTime(0.0001, now + delay);
      g.gain.exponentialRampToValueAtTime(gainPeak, now + delay + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    };

    if (type === "pop") {
      tone(800, 300, 0.09, 0.30, "sine");
      setTimeout(() => ctx.close(), 220);
    } else if (type === "success") {
      tone(600, 480, 0.07, 0.28, "sine", 0);
      tone(900, 700, 0.09, 0.30, "sine", 0.07);
      setTimeout(() => ctx.close(), 320);
    } else if (type === "thud") {
      tone(300, 100, 0.22, 0.36, "sine");
      setTimeout(() => ctx.close(), 360);
    } else if (type === "gong") {
      tone(200, 50, 1.8, 0.35, "sine");
      setTimeout(() => ctx.close(), 1900);
    } else if (type === "ping") {
      tone(1200, 1200, 0.1, 0.25, "sine");
      tone(1200, 600, 0.4, 0.2, "sine", 0.1);
      setTimeout(() => ctx.close(), 600);
    }
  } catch (_) {}
};

const haptic = (type = "pop") => {
  playAudio(type);
  if (type === "pop") vibrate(15);
  else if (type === "success") vibrate([20, 30, 20]);
  else if (type === "thud") vibrate(40);
  else if (type === "gong") vibrate([50, 80, 150]);
  else if (type === "ping") vibrate([30, 40, 30]);
};

const fmtClockFromDate = (d) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// ── Avatar stack with REAL telegram photos (Participant Visibility fix) ─────
function AvatarStack({ participants = [], capacity = 4, onTap }) {
  const shown = participants.slice(0, 4);
  const extra = Math.max(0, participants.length - shown.length);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onTap?.(); vibrate(12); }}
      style={{
        display: "flex", alignItems: "center", background: "transparent",
        border: "none", padding: 0, cursor: "pointer",
      }}
      aria-label="See who joined"
    >
      {shown.map((p, i) => (
        <div
          key={p.user_id ?? i}
          title={p.user_name}
          style={{
            width: 26, height: 26, borderRadius: "999px",
            background: "#ffe0ec", color: "#c0305a",
            fontWeight: 900, fontSize: 11,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid rgba(255,255,255,0.95)",
            marginLeft: i === 0 ? 0 : -8,
            zIndex: shown.length - i, position: "relative",
            overflow: "hidden",
          }}
        >
          {p.user_photo ? (
            <img
              src={p.user_photo}
              alt={p.user_name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            (p.user_name || "?").slice(0, 1).toUpperCase()
          )}
        </div>
      ))}
      {extra > 0 && (
        <div style={{
          width: 26, height: 26, borderRadius: "999px",
          background: "#fff0f6", color: "#c0305a",
          fontWeight: 900, fontSize: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid rgba(255,255,255,0.95)",
          marginLeft: -8, zIndex: 0, position: "relative",
        }}>+{extra}</div>
      )}
      {/* Empty slot indicator if no one in yet — keeps layout consistent */}
      {shown.length === 0 && (
        <div style={{
          width: 26, height: 26, borderRadius: "999px",
          background: "#f5f5f5", color: "#bbb",
          fontWeight: 900, fontSize: 11,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px dashed #ddd",
        }}>?</div>
      )}
    </button>
  );
}

// ── Location autocomplete (Global Search Bug fix: accept raw text) ──────────
function LocationInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const wrapRef                       = useRef(null);

  const handleChange = (e) => {
    const q = e.target.value;
    onChange(q);                                     // <- raw text always saved
    if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
    const local = LOCAL_LOCATIONS.filter((l) =>
      l.toLowerCase().includes(q.toLowerCase())
    );
    // Always show local matches first; if none, gently offer to "use as is"
    const results = local.length > 0
      ? local.slice(0, 5)
      : [`✏️ Use "${q}" as destination`];
    setSuggestions(results);
    setOpen(true);
  };

  const pick = (s) => {
    if (s.startsWith("✏️")) {
      // accept user's raw text verbatim
      onChange(value.trim());
    } else {
      onChange(s);
    }
    setSuggestions([]); setOpen(false); vibrate(20);
  };

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => value && setOpen(true)}
        placeholder={placeholder ?? "Type any spot…"}
        style={{
          width: "100%", padding: "10px 14px", borderRadius: "16px",
          border: "1.5px solid #ffd6e8", background: "#fff8fb",
          fontFamily: "'Nunito', sans-serif", fontWeight: 700,
          fontSize: 14, color: "#1a1a1a", outline: "none",
        }}
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "rgba(255,255,255,0.97)", borderRadius: "16px",
          border: "1.5px solid #ffd6e8", overflow: "hidden",
          boxShadow: "0 8px 24px rgba(255,140,160,0.15)", zIndex: 200,
        }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => pick(s)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 14px", background: "none", border: "none",
                borderBottom: i < suggestions.length - 1 ? "1px solid #ffeef5" : "none",
                fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                fontSize: 13, color: s.startsWith("✏️") ? "#888" : "#1a1a1a",
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create Pool / Courier Modal ─────────────────────────────────────────────
const BLANK_FORM = {
  trip_type: "walk", route: "", time: "", capacity: 4,
  description: "", is_courier: false,
  courier_items: "",
  payment_link: "", cost_total: "",
};

function CreateModal({ onClose, onCreated, driverName, tgUser, prefillRoute }) {
  const [form, setForm]     = useState({ ...BLANK_FORM, route: prefillRoute || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  

  // ── Quick time helpers (Quick Time Selection feature) ───────────────────
  const setQuickTime = (minsFromNow) => {
    const d = new Date(Date.now() + minsFromNow * 60_000);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    set("time", `${hh}:${mm}`);
    vibrate(15);
  };

  const handleSubmit = async () => {
    vibrate([20, 10, 20]);
    if (!form.route.trim()) { setError("Pick a destination."); return; }
    if (!form.time)         { setError("Pick a time."); return; }

    setSaving(true); setError("");

    const [hh, mm] = form.time.split(":");
    const date = new Date();
    date.setHours(Number(hh), Number(mm), 0, 0);
    
    const graceTime = new Date();
    graceTime.setMinutes(graceTime.getMinutes() - 5);
    
    if (date < graceTime) {
      date.setDate(date.getDate() + 1);
    }

    const isoString  = date.toISOString();
    const timeString = fmtClockFromDate(date);

    const emojiSet    = EMOJI_BY_TYPE[form.trip_type] || EMOJI_BY_TYPE.walk;
    const randomEmoji = emojiSet[Math.floor(Math.random() * emojiSet.length)];

    // RPC fixes the "Initiator Bug": creator is inserted as a participant
    // atomically with the new pool row. Variable names match the SQL function.
    const { data, error: dbErr } = await supabase.rpc("create_pool_with_creator", {
      p_driver:         driverName,
      p_trip_type:      form.trip_type,
      p_route:          form.route.trim(),
      p_time:           timeString,
      p_departs_at:     isoString,
      p_total_seats:    Number(form.capacity),
      p_capacity:       Number(form.capacity),
      p_emoji:          randomEmoji,
      p_description:    form.description.trim() || null,
      p_is_courier:     form.is_courier,
      p_creator_id:     String(tgUser?.id ?? `anon-${driverName}`),
      p_creator_name:   driverName,
      p_creator_photo:  tgUser?.photo_url ?? null,
      p_payment_link:   form.payment_link.trim() || null,
      p_cost_total:     form.cost_total ? Number(form.cost_total) : null,
      p_courier_items:  form.is_courier ? (form.courier_items.trim() || null) : null,
    });

    setSaving(false);
    if (dbErr) {
      console.error(dbErr);
      setError("Could not save. Check console for details.");
      return;
    }
    onCreated(data); // data = new pool id
  };

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: "16px",
    border: "1.5px solid #ffd6e8", background: "#fff8fb",
    fontFamily: "'Nunito', sans-serif", fontWeight: 700,
    fontSize: 14, color: "#1a1a1a", outline: "none",
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 800, color: "#f472b6",
    textTransform: "uppercase", letterSpacing: "0.06em",
    display: "block", marginBottom: 6,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(255,200,220,0.25)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="frosted-glass"
        style={{
          width: "100%", maxWidth: 480, borderRadius: "32px 32px 0 0",
          padding: "24px 20px 36px", display: "flex", flexDirection: "column", gap: 14,
          maxHeight: "92vh", overflowY: "auto",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 999, background: "#ffd6e8", margin: "0 auto 4px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>
            {form.is_courier ? "📦 New Courier Request" : "🚀 New Outing"}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "#fff0f6", border: "none", borderRadius: "999px", width: 32, height: 32, fontSize: 16, cursor: "pointer", color: "#c0305a", fontWeight: 900 }}
          >✕</button>
        </div>

        {/* Trip Type Toggle — Tokyo Pivot */}
        <div>
          <span style={labelStyle}>How are you moving?</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {TRIP_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => { set("trip_type", t.key); vibrate(15); }}
                style={{
                  padding: "10px 4px", borderRadius: "14px", border: "none",
                  fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12,
                  cursor: "pointer", lineHeight: 1.2,
                  background: form.trip_type === t.key ? "#ffe0ec" : "#f5f5f5",
                  color:      form.trip_type === t.key ? "#c0305a" : "#9ca3af",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 2 }}>{t.emoji}</div>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Destination */}
        <div>
          <span style={labelStyle}>Destination</span>
          <LocationInput
            value={form.route}
            onChange={(v) => set("route", v)}
            placeholder="Shibuya, conbini, anywhere…"
          />
        </div>

        {/* Quick Time + Capacity */}
        <div>
          <span style={labelStyle}>When?</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => setQuickTime(0)}
              style={{
                padding: "12px", borderRadius: "14px", border: "none",
                background: "linear-gradient(135deg,#ffe0ec,#ffd6e0)",
                color: "#c0305a", fontWeight: 900, fontSize: 13, cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
              }}
            >⚡ Right Now</button>
            <button
              onClick={() => setQuickTime(30)}
              style={{
                padding: "12px", borderRadius: "14px", border: "none",
                background: "linear-gradient(135deg,#fff0e0,#ffe4d0)",
                color: "#c05a10", fontWeight: 900, fontSize: 13, cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
              }}
            >⏱ In 30 min</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              type="time"
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
              style={inputStyle}
            />
            <input
              type="number"
              min={1} max={8}
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              style={inputStyle}
              aria-label="Seats"
            />
          </div>
        </div>

        {/* Courier toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div
            onClick={() => { set("is_courier", !form.is_courier); vibrate(15); }}
            style={{
              width: 44, height: 24, borderRadius: 999, position: "relative",
              background: form.is_courier ? "#ffe0ec" : "#f0f0f0",
              transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <div style={{
              position: "absolute", top: 3,
              left: form.is_courier ? 22 : 3,
              width: 18, height: 18, borderRadius: "999px",
              background: form.is_courier ? "#c0305a" : "#ccc",
              transition: "left 0.2s",
            }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#1a1a1a" }}>
            📦 I'm picking stuff up for others (Courier)
          </span>
        </label>

        {/* Courier items input */}
        {form.is_courier && (
          <div>
            <span style={labelStyle}>What can people request?</span>
            <input
              type="text"
              maxLength={120}
              value={form.courier_items}
              onChange={(e) => set("courier_items", e.target.value)}
              placeholder="onigiri, pocari, anything from conbini…"
              style={inputStyle}
            />
          </div>
        )}

        {/* Note */}
        <div>
          <span style={labelStyle}>
            Note&nbsp;
            <span style={{ color: "#d4a0b0", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
              {form.description.length}/100
            </span>
          </span>
          <input
            type="text"
            maxLength={100}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="e.g. grabbing dinner, wanna come?"
            style={inputStyle}
          />
        </div>

        {/* Cost splitting (only really useful for taxi) */}
        {(form.trip_type === "taxi" || form.cost_total || form.payment_link) && (
          <div style={{
            background: "#fff8f0", borderRadius: 18, padding: 12,
            border: "1.5px dashed #ffd6a8",
          }}>
            <span style={{ ...labelStyle, color: "#c05a10" }}>💴 Split the cost (optional)</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8 }}>
              <input
                type="number" min={0}
                value={form.cost_total}
                onChange={(e) => set("cost_total", e.target.value)}
                placeholder="¥ total"
                style={inputStyle}
              />
              <input
                type="text"
                value={form.payment_link}
                onChange={(e) => set("payment_link", e.target.value)}
                placeholder="PayPay / split link"
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {error && (
          <p style={{ fontSize: 13, fontWeight: 700, color: "#c0305a", textAlign: "center" }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            width: "100%", padding: "16px", borderRadius: "999px", border: "none",
            background: "linear-gradient(135deg, #ffb7d4 0%, #ffc9a0 100%)",
            color: "#7a2040", fontFamily: "'Nunito', sans-serif",
            fontWeight: 900, fontSize: 17, cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.65 : 1,
            boxShadow: "0 4px 18px rgba(255,140,160,0.28)",
            transition: "opacity 0.15s",
          }}
        >
          {saving ? "Posting…" : form.is_courier ? "📦 Post Courier Run" : "🚀 Post Outing"}
        </button>
      </div>
    </div>
  );
}

// ── Participants drawer (tap avatars to see who's actually going) ───────────
// ── Detail & Participants Sheet ──────────────────────────────────────────────
function ParticipantsSheet({ pool, participants, onClose, currentUserId, onFlake }) {
  if (!pool) return null;

  const handleCourierRequest = () => {
    if (navigator.vibrate) navigator.vibrate(20);
    const text = `📦 Hey ${pool.driver}, I need an item from ${pool.route}!`;
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(tgUrl);
    } else {
      alert("Drop your item list in the main group chat so the courier can see it!");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 320,
        background: "rgba(255,200,220,0.30)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="frosted-glass"
        style={{
          width: "100%", maxWidth: 480, borderRadius: "32px 32px 0 0",
          padding: "22px 20px 32px", display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 999, background: "#ffd6e8", margin: "0 auto 4px" }} />
        
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>
            {poolEmoji(pool)} {pool.route}
          </h3>
          <p style={{ color: "#9ca3af", fontWeight: 700, fontSize: 13, marginTop: 2 }}>
            {tripTypeLabel(pool.trip_type)} · {pool.time}
          </p>
        </div>

        {pool.description && (
          <div style={{ background: "#fff8fb", padding: "10px 14px", borderRadius: 12, border: "1px dashed #ffd6e8" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>"{pool.description}"</p>
          </div>
        )}

        {pool.is_courier && pool.creator_id !== currentUserId && (
          <div style={{ background: "#fff0e0", padding: 14, borderRadius: 16, marginTop: 4 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#c05a10", marginBottom: 8 }}>
              📦 COURIER MODE
              <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#c05a10", marginTop: 2 }}>
                {pool.driver} is taking item requests!
              </span>
            </p>
            <button 
              onClick={handleCourierRequest}
              style={{ width: "100%", padding: 10, borderRadius: 999, background: "#c05a10", color: "#fff", border: "none", fontWeight: 900, fontSize: 13, cursor: "pointer" }}
            >
              Send Request to Group Chat
            </button>
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            {participants.length}/{pool.capacity} Going
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {participants.length === 0 ? (
              <p style={{ color: "#999", textAlign: "center", padding: 12 }}>nobody yet</p>
            ) : participants.map((p) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 4px", borderBottom: "1px solid rgba(255,180,180,0.18)",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "999px",
                  background: "#ffe0ec", color: "#c0305a", fontWeight: 900,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden", flexShrink: 0,
                }}>
                  {p.user_photo
                    ? <img src={p.user_photo} alt={p.user_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (p.user_name || "?").slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 800, fontSize: 14, color: "#1a1a1a" }}>
                    {p.user_name}{p.is_creator && <span style={{
                      marginLeft: 6, fontSize: 10, background: "#fff0e0", color: "#c05a10",
                      borderRadius: 999, padding: "2px 7px", fontWeight: 800,
                    }}>host</span>}
                  </p>
                </div>
                {pool.creator_id === currentUserId && p.user_id !== currentUserId && (
                  <button
                    onClick={() => onFlake(p)}
                    style={{
                      background: "#fff0f6", color: "#c0305a", border: "none",
                      borderRadius: 999, padding: "5px 11px", fontSize: 11,
                      fontWeight: 800, cursor: "pointer",
                    }}
                    title="Report no-show"
                  >👻 flake</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status switcher (creator only — Live Status Updates) ────────────────────
const STATUS_LABELS = {
  open:               { emoji: "🟢", label: "Open",          color: "#1d7a4a", bg: "#d4f5e2" },
  leaving_soon:       { emoji: "⏳", label: "Leaving in ~5", color: "#c05a10", bg: "#fff0e0" },
  waiting_downstairs: { emoji: "📍", label: "Downstairs",    color: "#1050a0", bg: "#e0f0ff" },
  departed:           { emoji: "🏃", label: "Departed",      color: "#7030c0", bg: "#f0e0ff" },
};

function StatusPill({ pool, isCreator, onChange }) {
  const meta = STATUS_LABELS[pool.live_status || "open"];
  if (!isCreator) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999,
        background: meta.bg, color: meta.color, whiteSpace: "nowrap",
      }}>{meta.emoji} {meta.label}</span>
    );
  }
  const next = {
    open: "leaving_soon", leaving_soon: "waiting_downstairs",
    waiting_downstairs: "departed", departed: "open",
  }[pool.live_status || "open"];
  return (
    <button
      onClick={(e) => { e.stopPropagation(); vibrate(15); onChange(next); }}
      style={{
        fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999,
        background: meta.bg, color: meta.color, whiteSpace: "nowrap",
        border: "none", cursor: "pointer",
      }}
      title="tap to update status"
    >{meta.emoji} {meta.label}</button>
  );
}

function CountdownPill({ departsAt, now }) {
  const target = new Date(departsAt).getTime();
  const diff = target - now;

  if (diff < -300000) return null;

  const isUnder5 = diff <= 300000;
  const isPast = diff < 0;

  let text = "";
  if (isPast) {
    const remainingPast = 300000 + diff;
    const m = Math.floor(remainingPast / 60000);
    const s = Math.floor((remainingPast % 60000) / 1000);
    text = `Hide in ${m}m ${s}s`;
  } else {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    text = h > 0 ? `In ${h}h ${m}m` : `In ${m}m ${s}s`;
  }

  const bgColor = isUnder5 ? "#ffe0e0" : "#d4f5e2";
  const color = isUnder5 ? "#c03030" : "#1d7a4a";

  return (
    <span style={{
      fontSize: 10, fontWeight: 900, padding: "3px 8px", borderRadius: 999,
      background: bgColor, color: color, whiteSpace: "nowrap", marginLeft: 8
    }}>
      ⏱ {text}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  // Telegram user — kept exactly as-is
  const tgUser     = window?.Telegram?.WebApp?.initDataUnsafe?.user;
  const userName   = tgUser?.first_name ?? "Rider";
  const currentUserId = String(tgUser?.id ?? `anon-${userName}`);

  // State
  const [pools,           setPools]           = useState([]);
  const [participantsMap, setParticipantsMap] = useState({}); // { pool_id: [p,...] }
  const [loading,         setLoading]         = useState(true);
  const [joiningId,       setJoiningId]       = useState(null);
  const [beaconActive,    setBeaconActive]    = useState(false);
  const [pingFired,       setPingFired]       = useState(false);
  const [showModal,       setShowModal]       = useState(false);
  const [prefillRoute,    setPrefillRoute]    = useState("");
  const [openSheetFor,    setOpenSheetFor]    = useState(null); // pool object
  const [restricted,      setRestricted]      = useState(false);
  const [now,             setNow]             = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Check if I'm currently restricted (3-strike system) ─────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("user_restrictions")
        .select("restricted_until")
        .eq("user_id", currentUserId)
        .maybeSingle();
      if (data?.restricted_until && new Date(data.restricted_until) > new Date()) {
        setRestricted(true);
      }
    })();
  }, [currentUserId]);

  // ── Fetch pools + participants ──────────────────────────────────────────
  const fetchPools = useCallback(async () => {
    setLoading(true);
    
    const buffer = new Date();
    buffer.setMinutes(buffer.getMinutes() - 5);
    const cutoffTime = buffer.toISOString();

    const { data: poolData, error } = await supabase
      .from("pools")
      .select("*")
      .gte("departs_at", cutoffTime)
      .order("departs_at", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    setPools(poolData ?? []);

    // Fetch participants in one query
    if (poolData && poolData.length > 0) {
      const ids = poolData.map((p) => p.id);
      const { data: parts } = await supabase
        .from("pool_participants")
        .select("*")
        .in("pool_id", ids)
        .order("joined_at", { ascending: true });

      const map = {};
      (parts ?? []).forEach((p) => {
        (map[p.pool_id] ||= []).push(p);
      });
      setParticipantsMap(map);
    } else {
      setParticipantsMap({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPools(); }, [fetchPools]);

  // Realtime: refresh when anything changes
  useEffect(() => {
    const ch = supabase
      .channel("pools-and-participants")
      .on("postgres_changes", { event: "*", schema: "public", table: "pools" }, fetchPools)
      .on("postgres_changes", { event: "*", schema: "public", table: "pool_participants" }, fetchPools)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchPools]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const isCreator = (pool) => pool.creator_id === currentUserId;
  const amIIn     = (pool) => (participantsMap[pool.id] || []).some((p) => p.user_id === currentUserId);
  const openCount = pools.filter((p) => p.available_seats > 0).length;

  // ── Join via RPC (atomic) ───────────────────────────────────────────────
  const handleJoin = async (pool) => {
    if (restricted) {
      alert("You're temporarily paused from joining runs (3 no-shows). Try again later.");
      return;
    }
    if (joiningId !== null) return;
    if (pool.available_seats <= 0) return;
    if (amIIn(pool)) return;

    haptic("success");
    setJoiningId(pool.id);

    const { data: ok, error } = await supabase.rpc("join_pool", {
      p_pool_id:    pool.id,
      p_user_id:    currentUserId,
      p_user_name:  userName,
      p_user_photo: tgUser?.photo_url ?? null,
    });

    setJoiningId(null);
    if (error || !ok) { console.error(error); return; }

    // Fire-and-forget group notification
    fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: userName, route: pool.route, time: pool.time }),
    }).catch(() => {});

    fetchPools();
  };

  // ── Leave (for non-creators) ────────────────────────────────────────────
  const handleLeave = async (pool) => {
    haptic("thud");
    const { error } = await supabase.rpc("leave_pool", {
      p_pool_id: pool.id,
      p_user_id: currentUserId,
    });
    if (error) console.error(error);
    fetchPools();
  };

  // ── Cancel (for creator) ────────────────────────────────────────────────
  const handleCancel = async (pool) => {
    if (!confirm("Cancel this outing for everyone?")) return;
    haptic("thud");
    const { error } = await supabase.rpc("cancel_pool", {
      p_pool_id:    pool.id,
      p_creator_id: currentUserId,
    });
    if (error) console.error(error);
    fetchPools();
  };

  // ── Status change (creator only) ────────────────────────────────────────
  const handleStatusChange = async (pool, newStatus) => {
    await supabase.from("pools").update({ live_status: newStatus }).eq("id", pool.id);
    fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: userName, route: pool.route, status: newStatus }),
    }).catch(() => {});
    fetchPools();
  };

  // ── Share to group ──────────────────────────────────────────────────────
  const handleShare = async (pool) => {
    vibrate(20);
    try {
      // Prefer native Telegram share if available (deep link goes through MTProto)
      const tg = window?.Telegram?.WebApp;
      if (tg?.openTelegramLink && import.meta.env.VITE_TELEGRAM_BOT_USERNAME && import.meta.env.VITE_TELEGRAM_APP_SHORTNAME) {
        const url = `https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME}/${import.meta.env.VITE_TELEGRAM_APP_SHORTNAME}?startapp=pool_${pool.id}`;
        const text = `${poolEmoji(pool)} ${pool.route} @ ${pool.time} — pull up`;
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
        return;
      }
    } catch (_) {}
    // Fallback: post via our API into the configured group chat
    await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool }),
    }).catch(console.error);
  };

  // ── Flake report ────────────────────────────────────────────────────────
  const handleFlake = async (pool, participant) => {
    if (!confirm(`Mark ${participant.user_name} as a no-show?`)) return;
    vibrate(25);
    const { data: count, error } = await supabase.rpc("report_flake", {
      p_pool_id:          pool.id,
      p_flaker_id:        participant.user_id,
      p_flaker_name:      participant.user_name,
      p_reported_by_id:   currentUserId,
      p_reported_by_name: userName,
    });
    if (error) { console.error(error); return; }
    fetch("/api/flake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reporter: userName, flaker: participant.user_name,
        route: pool.route, count,
      }),
    }).catch(() => {});
  };

  // ── Beacon + Ping ───────────────────────────────────────────────────────
  const handleBeacon = async () => {
    const newState = !beaconActive;
    setBeaconActive(newState);
    haptic(newState ? "gong" : "thud");
    try {
      await fetch("/api/beacon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: userName, active: newState }),
      });
    } catch (e) { console.error(e); }
  };

  const handlePing = async () => {
    haptic("ping");
    setPingFired(true);
    try {
      await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: userName }),
      });
    } catch (e) { console.error(e); }
    setTimeout(() => setPingFired(false), 2500);
  };

  // ── Modal handlers ──────────────────────────────────────────────────────

  function openModal(route = "") { haptic("pop"); setPrefillRoute(route); setShowModal(true); }
  const closeModal = () => { haptic("thud"); setShowModal(false); setPrefillRoute(""); };
  const onCreated  = () => { closeModal(); fetchPools(); };

  // Sheet participants (live)
  const sheetParticipants = useMemo(() => {
    if (!openSheetFor) return [];
    return participantsMap[openSheetFor.id] || [];
  }, [openSheetFor, participantsMap]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Nunito', sans-serif; background: #fff8f5; min-height: 100vh; }

        @keyframes gradient-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .liquid-bg {
          min-height: 100vh;
          background: linear-gradient(-45deg, #fff8f5, #ffe0ec, #fff0e0, #fff8f5);
          background-size: 400% 400%;
          animation: gradient-flow 15s ease infinite;
          padding: 16px; padding-bottom: 32px;
        }

        .muv-press {
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          cursor: pointer;
        }
        .muv-press:active {
          transform: scale(0.92);
        }

        .frosted-glass {
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 8px 32px rgba(255, 140, 100, 0.08), 0 2px 8px rgba(255,140,100,0.04);
        }

        .btn-join {
          border: none; cursor: pointer;
          font-family: 'Nunito', sans-serif; font-weight: 800;
          font-size: 13px; padding: 7px 14px; border-radius: 999px;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          white-space: nowrap; flex-shrink: 0;
        }
        .btn-join:active { transform: scale(0.92); }
        .btn-join:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .btn-join-active  { background: #d4f5e2; color: #1d7a4a; }
        .btn-join-full    { background: #f0f0f0; color: #9ca3af; }
        .btn-join-default { background: #ffe0ec; color: #c0305a; }
        .btn-join-cancel  { background: #ffe0e0; color: #c03030; }
        .btn-join-leave   { background: #fff0e0; color: #c05a10; }

        .beacon-ring {
          width: 88px; height: 88px; border-radius: 999px; border: none;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 32px; transition: transform 0.15s, box-shadow 0.2s; position: relative;
        }
        .beacon-ring:active { transform: scale(0.93); }
        .beacon-on  { background: #d4f5e2;
          box-shadow: 0 0 0 10px rgba(134,239,172,0.25), 0 0 0 20px rgba(134,239,172,0.10);
          animation: pulse-green 2s infinite; }
        .beacon-off { background: #ffe4f0;
          box-shadow: 0 0 0 8px rgba(255,182,213,0.20); }

        @keyframes pulse-green {
          0%,100% { box-shadow: 0 0 0 10px rgba(134,239,172,0.25), 0 0 0 20px rgba(134,239,172,0.10); }
          50%      { box-shadow: 0 0 0 14px rgba(134,239,172,0.20), 0 0 0 26px rgba(134,239,172,0.07); }
        }
        .seat-pill {
          display: inline-block; font-size: 11px; font-weight: 800;
          padding: 3px 10px; border-radius: 999px; letter-spacing: 0.02em; white-space: nowrap;
        }
        .pool-row {
          display: flex; align-items: center; gap: 10px; padding: 12px 0;
          border-bottom: 1.5px solid rgba(255,180,180,0.15);
        }
        .pool-row:last-child  { border-bottom: none; padding-bottom: 0; }
        .pool-row:first-child { padding-top: 0; }
        .ping-btn {
          width: 100%; border: none; cursor: pointer;
          font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 17px;
          padding: 18px; border-radius: 999px; letter-spacing: 0.01em;
          transition: transform 0.13s, box-shadow 0.15s;
        }
        .ping-btn:active { transform: scale(0.97); }
        .ping-default { background: linear-gradient(135deg, #ffb7d4 0%, #ffc9a0 100%); color: #7a2040; box-shadow: 0 4px 18px rgba(255,140,160,0.28); }
        .ping-fired   { background: linear-gradient(135deg, #b2f5c8 0%, #a0e8ff 100%); color: #1a6640; box-shadow: 0 4px 18px rgba(100,220,160,0.28); }
        .avatar-circle {
          width: 38px; height: 38px; border-radius: 999px;
          background: linear-gradient(135deg, #ffd6e0, #ffc9a0);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; flex-shrink: 0; overflow: hidden;
        }
        .add-btn {
          width: 36px; height: 36px; border-radius: 999px;
          background: #ffe0ec; border: none; cursor: pointer;
          font-size: 20px; font-weight: 900; color: #c0305a;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.12s;
        }
        .add-btn:active { transform: scale(0.92); }
        .scroll-pools { overflow-y: auto; max-height: 320px; scrollbar-width: none; }
        .scroll-pools::-webkit-scrollbar { display: none; }
        .loading-row {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 24px 0; font-size: 14px; font-weight: 700; color: #f472b6;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px; height: 16px; border-radius: 999px;
          border: 2.5px solid #ffd6e8; border-top-color: #f472b6;
          animation: spin 0.7s linear infinite;
        }
        .subtle {
          font-size: 10.5px; color: #b0b0b0; font-weight: 600;
          text-align: center; margin-top: 6px; line-height: 1.3;
        }
        .icon-btn {
          background: transparent; border: none; cursor: pointer;
          padding: 4px; font-size: 14px; color: #c0305a; border-radius: 999px;
        }
        .icon-btn:active { transform: scale(0.9); }
      `}</style>

      <div className="liquid-bg">

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", padding: "4px 2px" }}>
          <div className="avatar-circle">
            {tgUser?.photo_url
              ? <img src={tgUser.photo_url} alt={userName} style={{ width: "100%", height: "100%", borderRadius: "999px", objectFit: "cover" }} />
              : "👤"}
          </div>
          <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 24, fontWeight: 900, color: "#cc0000", letterSpacing: "-0.5px", display: "flex", alignItems: "center" }}>
            M
            <span style={{ display: "inline-block", transform: "scaleX(3)", transformOrigin: "center", margin: "0 12px" }}>U</span>
            V
          </span>
          <button className="add-btn muv-press" onClick={() => openModal()} aria-label="Create new outing">+</button>
        </div>

        {restricted && (
          <div style={{
            background: "#ffe0e0", color: "#a01a1a", padding: "10px 14px",
            borderRadius: 14, fontSize: 12, fontWeight: 800, marginBottom: 12, textAlign: "center",
          }}>
            ⏸ You're paused from joining runs (3 no-shows). Hosting still works.
          </div>
        )}

        {/* ── HERO: Active Outings (Terminology Overhaul) ── */}
        <div className="frosted-glass" style={{ borderRadius: "32px", padding: "22px", marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#f472b6", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px" }}>
                Live Now
              </p>
              <h1 style={{ fontSize: "22px", fontWeight: 900, color: "#1a1a1a", lineHeight: 1.2 }}>
                Active Outings
              </h1>
            </div>
            <span className="seat-pill" style={{ background: "#ffe0ec", color: "#c0305a" }}>
              {loading ? "…" : `${openCount} open`}
            </span>
          </div>

          <div className="scroll-pools">
            {loading ? (
              <div className="loading-row">
                <div className="spinner" /> Finding moves…
              </div>
            ) : pools.length === 0 ? (
              <div className="loading-row" style={{ color: "#9ca3af", flexDirection: "column" }}>
                <div>No outings right now</div>
                <button onClick={() => openModal()} className="muv-press"
                  style={{
                    marginTop: 8, background: "#ffe0ec", color: "#c0305a",
                    border: "none", padding: "8px 16px", borderRadius: 999,
                    fontWeight: 800, fontSize: 12, cursor: "pointer",
                  }}
                >+ Start one</button>
              </div>
            ) : (
              pools
                .filter(p => new Date(p.departs_at).getTime() - now > -300000)
                .map((pool) => {
                const iAmIn   = amIIn(pool);
                const iHost   = isCreator(pool);
                const isFull  = pool.available_seats <= 0;
                const writing = joiningId === pool.id;
                const parts   = participantsMap[pool.id] || [];

                let btn;
                if (iHost) {
                  btn = <button className="btn-join btn-join-cancel" onClick={(e) => { e.stopPropagation(); handleCancel(pool); }}>Cancel</button>;
                } else if (iAmIn) {
                  btn = <button className="btn-join btn-join-leave" onClick={(e) => { e.stopPropagation(); handleLeave(pool); }}>Leave</button>;
                } else if (isFull) {
                  btn = <button className="btn-join btn-join-full" onClick={(e) => e.stopPropagation()} disabled>Full</button>;
                } else {
                  btn = (
                    <button
                      className="btn-join btn-join-default"
                      onClick={(e) => { e.stopPropagation(); handleJoin(pool); }}
                      disabled={writing || restricted}
                    >{writing ? "…" : "Join"}</button>
                  );
                }

                return (
                  <div 
                    key={pool.id} 
                    className="pool-row" 
                    onClick={() => setOpenSheetFor(pool)} 
                    style={{ cursor: "pointer" }}
                  >
                    <div style={{ fontSize: "26px", lineHeight: 1, flexShrink: 0 }}>
                      {poolEmoji(pool)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: "14px", color: "#1a1a1a", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {pool.route ?? "—"}
                        {pool.is_courier && (
                          <span style={{ marginLeft: 6, fontSize: 11, background: "#fff0e0", color: "#c05a10", borderRadius: 999, padding: "2px 7px", fontWeight: 800 }}>
                            📦
                          </span>
                        )}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", display: "flex", alignItems: "center" }}>
                          {tripTypeLabel(pool.trip_type)} · {pool.time}
                          <CountdownPill departsAt={pool.departs_at} now={now} />
                        </span>
                        <StatusPill
                          pool={pool}
                          isCreator={iHost}
                          onChange={(s) => handleStatusChange(pool, s)}
                        />
                        {pool.cost_total ? (
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#c05a10", background: "#fff0e0", padding: "2px 7px", borderRadius: 999 }}>
                            💴 ¥{pool.cost_total}
                          </span>
                        ) : null}
                      </div>
                      {pool.description && (
                        <p style={{ fontSize: 11, color: "#b0b0b0", fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {pool.description}
                        </p>
                      )}
                      {pool.is_courier && pool.courier_items && (
                        <p style={{ fontSize: 11, color: "#c05a10", fontWeight: 700, marginTop: 2 }}>
                          📦 {pool.courier_items}
                        </p>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <AvatarStack
                          participants={parts}
                          capacity={pool.capacity ?? 4}
                          onTap={() => setOpenSheetFor(pool)}
                        />
                        {btn}
                      </div>
                      <button
                        className="icon-btn"
                        onClick={(e) => { e.stopPropagation(); handleShare(pool); }}
                        title="Share to group"
                        aria-label="Share to group"
                      >↗</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── SPLIT ROW: Beacon + Quick Route ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>

          {/* Lobby Beacon */}
          <div className="frosted-glass" style={{ borderRadius: "32px", padding: "22px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <p style={{ fontSize: "11px", fontWeight: 800, color: "#f472b6", letterSpacing: "0.06em", textTransform: "uppercase", alignSelf: "flex-start" }}>
              Beacon
            </p>
            <button
              className={`beacon-ring ${beaconActive ? "beacon-on" : "beacon-off"}`}
              onClick={handleBeacon}
              aria-label={beaconActive ? "Turn off lobby beacon" : "Turn on lobby beacon"}
            >
              {beaconActive ? "📍" : "🔔"}
            </button>
            <p style={{ fontSize: "12px", fontWeight: 700, color: beaconActive ? "#1d7a4a" : "#9ca3af", textAlign: "center" }}>
              {beaconActive ? "You're live!" : "I'm in the lobby"}
            </p>
            <p className="subtle">
              Tells the group you're downstairs and down for anything
            </p>
          </div>

          {/* Quick Route — Tokyo defaults */}
          <div className="frosted-glass" style={{ borderRadius: "32px", padding: "22px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <p style={{ fontSize: "11px", fontWeight: 800, color: "#f472b6", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Quick Route
            </p>
            <p style={{ fontSize: "14px", fontWeight: 900, color: "#1a1a1a", lineHeight: 1.3 }}>
              Where to?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {["Shibuya", "FamilyMart", "Shinjuku"].map((route) => (
                <button
                  key={route}
                  onClick={() => openModal(route)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "#fff0f6", color: "#c0305a", fontSize: 12, fontWeight: 800,
                    padding: "5px 12px", borderRadius: 999, border: "1.5px solid #ffd6e8",
                    cursor: "pointer", justifyContent: "flex-start",
                  }}
                >
                  <span>→</span> {route}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── RESTLESS PING ── */}
        <button
          className={`ping-btn ${pingFired ? "ping-fired" : "ping-default"}`}
          onClick={handlePing}
          aria-label="Send a restless ping to the group"
        >
          {pingFired ? "🗳️ Group Alert Sent!" : "😤 Restless Ping"}
        </button>
        <p className="subtle">
          Blasts the group chat: "someone's bored, who wants to move?"
        </p>

      </div>

      {showModal && (
        <CreateModal
          onClose={closeModal}
          onCreated={onCreated}
          driverName={userName}
          tgUser={tgUser}
          prefillRoute={prefillRoute}
        />
      )}

      {openSheetFor && (
        <ParticipantsSheet
          pool={openSheetFor}
          participants={sheetParticipants}
          onClose={() => setOpenSheetFor(null)}
          currentUserId={currentUserId}
          onFlake={(p) => handleFlake(openSheetFor, p)}
        />
      )}
    </>
  );
}
