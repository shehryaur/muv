import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client (kept exactly as-is) ─────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Local location corpus ─────────────────────────────────────────────────────
const LOCAL_LOCATIONS = [
  "Psychology Lab", "Residence Hall", "Main Gate", "Admin Block",
  "Science Block", "Cadet Mess", "Sports Ground", "Library",
  "Hasanabdal City", "Attock City", "Taxila", "Wah Cantt",
  "F-10 Markaz", "Islamabad Airport", "Pindi Saddar", "GT Road Stop",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const DRIVE_EMOJIS = ["🚗", "🚙", "🚕", "🛻", "🚐"];
const WALK_EMOJIS  = ["🚶", "🏃", "🚶‍♂️", "🏃‍♀️", "🚶‍♀️"];

const poolEmoji = (pool) => {
  const set = pool?.trip_type === "walk" ? WALK_EMOJIS : DRIVE_EMOJIS;
  return set[(pool?.id ?? 0) % set.length];
};

const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";

const vibrate = (pattern) => {
  if (navigator?.vibrate) navigator.vibrate(pattern);
};

// ── Web Audio: synthesised wood-click tone ────────────────────────────────────
const playWoodClick = () => {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type      = "sine";
    osc.frequency.setValueAtTime(820, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.13);
    osc.onended = () => ctx.close();
  } catch (_) {
    // AudioContext unavailable — silent fallback
  }
};

// ── Avatar stack component ────────────────────────────────────────────────────
const AVATAR_COLORS = [
  ["#ffd6e0", "#c0305a"], ["#d4f5e2", "#1d7a4a"], ["#e0f0ff", "#1050a0"],
  ["#fff0e0", "#c05a10"], ["#f0e0ff", "#7030c0"],
];

function AvatarStack({ count, capacity }) {
  const filled = Math.min(capacity - (count ?? 0), capacity);
  const shown  = Math.min(filled, 4);
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {Array.from({ length: shown }).map((_, i) => {
        const [bg, color] = AVATAR_COLORS[i % AVATAR_COLORS.length];
        return (
          <div
            key={i}
            style={{
              width: 26, height: 26, borderRadius: "999px",
              background: bg, color, fontWeight: 900, fontSize: 11,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid rgba(255,255,255,0.9)",
              marginLeft: i === 0 ? 0 : -8,
              zIndex: shown - i,
              position: "relative",
            }}
          >
            {["A", "Z", "O", "M"][i]}
          </div>
        );
      })}
    </div>
  );
}

// ── Location autocomplete input ───────────────────────────────────────────────
function LocationInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const wrapRef                        = useRef(null);

  const handleChange = (e) => {
    const q = e.target.value;
    onChange(q);
    if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
    const local = LOCAL_LOCATIONS.filter((l) =>
      l.toLowerCase().includes(q.toLowerCase())
    );
    const results = local.length > 0
      ? local.slice(0, 5)
      : [`🗺 Search Maps for: "${q}"`];
    setSuggestions(results);
    setOpen(true);
  };

  const pick = (s) => {
    const clean = s.startsWith("🗺") ? value : s;
    onChange(clean);
    setSuggestions([]);
    setOpen(false);
    vibrate(20);
  };

  // Close on outside click
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
        placeholder={placeholder ?? "Type a destination…"}
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
                fontSize: 13, color: s.startsWith("🗺") ? "#9ca3af" : "#1a1a1a",
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

// ── Create Pool Modal ─────────────────────────────────────────────────────────
const BLANK_FORM = {
  trip_type: "drive", route: "", time: "", capacity: 4,
  description: "", is_courier: false,
};

function CreateModal({ onClose, onCreated, driverName }) {
  const [form, setForm]       = useState(BLANK_FORM);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    vibrate([20, 10, 20]);
    if (!form.route.trim()) { setError("Please enter a destination."); return; }
    if (!form.time)          { setError("Please choose a departure time."); return; }

    setSaving(true);
    setError("");

    // Build departs_at from today + chosen time
    const [hh, mm]    = form.time.split(":").map(Number);
    const departsAt   = new Date();
    departsAt.setHours(hh, mm, 0, 0);

    const { error: dbErr } = await supabase.from("pools").insert({
      driver_name:     driverName,
      trip_type:       form.trip_type,
      route:           form.route.trim(),
      departs_at:      departsAt.toISOString(),
      available_seats: Number(form.capacity),
      description:     form.description.trim() || null,
      is_courier:      form.is_courier,
    });

    setSaving(false);
    if (dbErr) { setError("Could not save. Try again."); return; }

    onCreated();
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
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(255,200,220,0.25)",
        backdropFilter: "blur(6px)", display: "flex",
        alignItems: "flex-end", justifyContent: "center",
      }}
    >
      {/* Sheet */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="frosted-glass"
        style={{
          width: "100%", maxWidth: 480, borderRadius: "32px 32px 0 0",
          padding: "24px 20px 36px", display: "flex", flexDirection: "column", gap: 16,
        }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 999, background: "#ffd6e8", margin: "0 auto 4px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>New Pool</h2>
          <button
            onClick={onClose}
            style={{ background: "#fff0f6", border: "none", borderRadius: "999px", width: 32, height: 32, fontSize: 16, cursor: "pointer", color: "#c0305a", fontWeight: 900 }}
          >
            ✕
          </button>
        </div>

        {/* Trip Type Toggle */}
        <div>
          <span style={labelStyle}>Type</span>
          <div style={{ display: "flex", gap: 8 }}>
            {["drive", "walk"].map((type) => (
              <button
                key={type}
                onClick={() => { set("trip_type", type); vibrate(15); }}
                style={{
                  flex: 1, padding: "10px", borderRadius: "16px", border: "none",
                  fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14,
                  cursor: "pointer",
                  background: form.trip_type === type ? "#ffe0ec" : "#f5f5f5",
                  color:      form.trip_type === type ? "#c0305a" : "#9ca3af",
                  transition: "all 0.15s",
                }}
              >
                {type === "drive" ? "🚗 Drive" : "🚶 Walk"}
              </button>
            ))}
          </div>
        </div>

        {/* Route */}
        <div>
          <span style={labelStyle}>Destination</span>
          <LocationInput
            value={form.route}
            onChange={(v) => set("route", v)}
            placeholder="e.g. Psychology Lab…"
          />
        </div>

        {/* Time + Capacity in a row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <span style={labelStyle}>Time</span>
            <input
              type="time"
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <span style={labelStyle}>Seats</span>
            <input
              type="number"
              min={1} max={8}
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Description */}
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
            placeholder="e.g. for morning run"
            style={inputStyle}
          />
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
            📦 Courier Request
          </span>
        </label>

        {error && (
          <p style={{ fontSize: 13, fontWeight: 700, color: "#c0305a", textAlign: "center" }}>{error}</p>
        )}

        {/* Submit */}
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
          {saving ? "Posting…" : form.is_courier ? "📦 Request Item" : "🚀 Post Pool"}
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  // Telegram user — kept exactly as-is
  const tgUser   = window?.Telegram?.WebApp?.initDataUnsafe?.user;
  const userName = tgUser?.first_name ?? "Rider";

  // ── State ─────────────────────────────────────────────────────────────────
  const [pools,        setPools]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [joinedPool,   setJoinedPool]   = useState(null);
  const [joiningId,    setJoiningId]    = useState(null);
  const [beaconActive, setBeaconActive] = useState(false);
  const [pingFired,    setPingFired]    = useState(false);
  const [showModal,    setShowModal]    = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchPools = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pools")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setPools(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPools(); }, [fetchPools]);

  // ── Join ──────────────────────────────────────────────────────────────────
  const handleJoin = async (id) => {
    if (joinedPool === id || joiningId !== null) return;
    const pool = pools.find((p) => p.id === id);
    if (!pool || pool.available_seats <= 0) return;

    vibrate([30, 10, 30]);
    playWoodClick();

    // Optimistic update
    setPools((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, available_seats: Math.max(0, p.available_seats - 1) } : p
      )
    );
    setJoinedPool(id);
    setJoiningId(id);

    const newSeats = Math.max(0, pool.available_seats - 1);
    const { error } = await supabase
      .from("pools")
      .update({ available_seats: newSeats })
      .eq("id", id)
      .gt("available_seats", 0);

    if (error) {
      // Rollback
      setPools((prev) =>
        prev.map((p) => (p.id === id ? { ...p, available_seats: pool.available_seats } : p))
      );
      setJoinedPool(null);
    }
    setJoiningId(null);
  };

  // ── Ping ──────────────────────────────────────────────────────────────────
  const handlePing = () => {
    vibrate([40, 20, 40]);
    setPingFired(true);
    setTimeout(() => setPingFired(false), 2500);
  };

  // ── Beacon ────────────────────────────────────────────────────────────────
  const handleBeacon = () => {
    vibrate(40);
    setBeaconActive((prev) => !prev);
  };

  // ── Modal handlers ────────────────────────────────────────────────────────
  const openModal  = () => { vibrate(20); setShowModal(true); };
  const closeModal = () => setShowModal(false);
  const onCreated  = () => { closeModal(); fetchPools(); };

  // ── Derived ───────────────────────────────────────────────────────────────
  const openCount = pools.filter((p) => p.available_seats > 0).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Nunito', sans-serif;
          background: #fff8f5;
          min-height: 100vh;
        }

        .liquid-bg {
          min-height: 100vh;
          background:
            radial-gradient(ellipse at 10% 10%, #ffd6e0 0%, transparent 50%),
            radial-gradient(ellipse at 90% 0%, #fde8d0 0%, transparent 50%),
            radial-gradient(ellipse at 60% 80%, #ffd6e0 0%, transparent 50%),
            radial-gradient(ellipse at 0% 80%, #fef3e2 0%, transparent 50%),
            #fff8f5;
          padding: 16px;
          padding-bottom: 32px;
        }

        .frosted-glass {
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1.5px solid rgba(255, 255, 255, 0.85);
          box-shadow: 0 4px 24px rgba(255, 160, 130, 0.10), 0 1.5px 6px rgba(255,140,100,0.07);
        }

        .btn-join {
          border: none; cursor: pointer;
          font-family: 'Nunito', sans-serif; font-weight: 800;
          font-size: 13px; padding: 7px 16px; border-radius: 999px;
          transition: transform 0.13s; white-space: nowrap; flex-shrink: 0;
        }
        .btn-join:active  { transform: scale(0.95); }
        .btn-join:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .btn-join-active  { background: #d4f5e2; color: #1d7a4a; }
        .btn-join-full    { background: #f0f0f0; color: #9ca3af; }
        .btn-join-default { background: #ffe0ec; color: #c0305a; }

        .beacon-ring {
          width: 88px; height: 88px; border-radius: 999px; border: none;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 32px; transition: transform 0.15s, box-shadow 0.2s; position: relative;
        }
        .beacon-ring:active { transform: scale(0.93); }

        .beacon-on {
          background: #d4f5e2;
          box-shadow: 0 0 0 10px rgba(134,239,172,0.25), 0 0 0 20px rgba(134,239,172,0.10);
          animation: pulse-green 2s infinite;
        }
        .beacon-off {
          background: #ffe4f0;
          box-shadow: 0 0 0 8px rgba(255,182,213,0.20);
        }

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

        .route-chip {
          display: inline-flex; align-items: center; gap: 5px;
          background: #fff0f6; color: #c0305a; font-size: 12px; font-weight: 800;
          padding: 5px 12px; border-radius: 999px; border: 1.5px solid #ffd6e8;
          cursor: pointer; transition: transform 0.12s;
        }
        .route-chip:hover { transform: scale(1.04); }

        .avatar-circle {
          width: 38px; height: 38px; border-radius: 999px;
          background: linear-gradient(135deg, #ffd6e0, #ffc9a0);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; flex-shrink: 0;
        }

        .add-btn {
          width: 36px; height: 36px; border-radius: 999px;
          background: #ffe0ec; border: none; cursor: pointer;
          font-size: 20px; font-weight: 900; color: #c0305a;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.12s;
        }
        .add-btn:active { transform: scale(0.92); }

        .scroll-pools { overflow-y: auto; max-height: 240px; scrollbar-width: none; }
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
      `}</style>

      <div className="liquid-bg">

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", padding: "4px 2px" }}>
          <div className="avatar-circle">
            {tgUser?.photo_url
              ? <img src={tgUser.photo_url} alt={userName} style={{ width: "100%", height: "100%", borderRadius: "999px", objectFit: "cover" }} />
              : "👤"}
          </div>
          <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: "22px", fontWeight: 900, color: "#1a1a1a", letterSpacing: "-0.5px" }}>
            MUV
          </span>
          <button className="add-btn" onClick={openModal} aria-label="Create new pool">+</button>
        </div>

        {/* ── HERO CARD: Active Pools ── */}
        <div className="frosted-glass" style={{ borderRadius: "32px", padding: "22px", marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#f472b6", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px" }}>
                Live Now
              </p>
              <h1 style={{ fontSize: "22px", fontWeight: 900, color: "#1a1a1a", lineHeight: 1.2 }}>
                Active Transit Pools
              </h1>
            </div>
            <span className="seat-pill" style={{ background: "#ffe0ec", color: "#c0305a" }}>
              {loading ? "…" : `${openCount} open`}
            </span>
          </div>

          <div className="scroll-pools">
            {loading ? (
              <div className="loading-row">
                <div className="spinner" /> Finding rides…
              </div>
            ) : pools.length === 0 ? (
              <div className="loading-row" style={{ color: "#9ca3af" }}>
                No active pools right now
              </div>
            ) : (
              pools.map((pool) => {
                const joined  = joinedPool === pool.id;
                const isFull  = pool.available_seats <= 0;
                const writing = joiningId === pool.id;
                const joined_count = (pool.capacity ?? 4) - (pool.available_seats ?? 0);

                let btnClass = "btn-join-default";
                if (joined) btnClass = "btn-join-active";
                else if (isFull) btnClass = "btn-join-full";

                return (
                  <div key={pool.id} className="pool-row">
                    {/* Emoji */}
                    <div style={{ fontSize: "26px", lineHeight: 1, flexShrink: 0 }}>
                      {poolEmoji(pool)}
                    </div>

                    {/* Route + description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: "14px", color: "#1a1a1a", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {pool.route ?? "—"}
                        {pool.is_courier && (
                          <span style={{ marginLeft: 6, fontSize: 11, background: "#fff0e0", color: "#c05a10", borderRadius: 999, padding: "2px 7px", fontWeight: 800 }}>
                            📦
                          </span>
                        )}
                      </p>
                      {pool.description ? (
                        <p style={{ fontSize: "11px", color: "#b0b0b0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {pool.description}
                        </p>
                      ) : null}
                    </div>

                    {/* Time */}
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", flexShrink: 0 }}>
                      {fmtTime(pool.departs_at)}
                    </span>

                    {/* Avatar stack + Join */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <AvatarStack count={pool.available_seats} capacity={pool.capacity ?? 4} />
                      <button
                        className={`btn-join ${btnClass}`}
                        onClick={() => handleJoin(pool.id)}
                        disabled={isFull || writing}
                      >
                        {writing ? "…" : joined ? "✓ In" : isFull ? "Full" : "Join"}
                      </button>
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
          <div className="frosted-glass" style={{ borderRadius: "32px", padding: "22px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <p style={{ fontSize: "11px", fontWeight: 800, color: "#f472b6", letterSpacing: "0.06em", textTransform: "uppercase", alignSelf: "flex-start" }}>
              Beacon
            </p>
            <button
              className={`beacon-ring ${beaconActive ? "beacon-on" : "beacon-off"}`}
              onClick={handleBeacon}
              aria-label={beaconActive ? "Deactivate lobby beacon" : "Activate lobby beacon"}
            >
              {beaconActive ? "📍" : "🔔"}
            </button>
            <p style={{ fontSize: "12px", fontWeight: 700, color: beaconActive ? "#1d7a4a" : "#9ca3af", textAlign: "center" }}>
              {beaconActive ? "You're live!" : "Tap to signal"}
            </p>
          </div>

          {/* Quick Route */}
          <div className="frosted-glass" style={{ borderRadius: "32px", padding: "22px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <p style={{ fontSize: "11px", fontWeight: 800, color: "#f472b6", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Quick Route
            </p>
            <p style={{ fontSize: "14px", fontWeight: 900, color: "#1a1a1a", lineHeight: 1.3 }}>
              Where to?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {["Campus", "F-10", "Pindi"].map((route) => (
                <button
                  key={route}
                  className="route-chip"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => vibrate(15)}
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

      </div>

      {/* ── CREATE POOL MODAL ── */}
      {showModal && (
        <CreateModal
          onClose={closeModal}
          onCreated={onCreated}
          driverName={userName}
        />
      )}
    </>
  );
}
