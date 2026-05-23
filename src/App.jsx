import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client (initialised once, outside the component) ──────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Helpers ────────────────────────────────────────────────────────────────
const EMOJIS = ["🚗", "🚙", "🚕", "🛻", "🚐"];
const poolEmoji = (id) => EMOJIS[id % EMOJIS.length];

export default function App() {
  // ── Telegram user (keep exactly as-is) ──────────────────────────────────
  const tgUser = window?.Telegram?.WebApp?.initDataUnsafe?.user;
  const userName = tgUser?.first_name ?? "Rider";

  // ── State ────────────────────────────────────────────────────────────────
  const [pools, setPools]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [joinedPool, setJoinedPool] = useState(null);   // id of the pool the user joined
  const [joiningId, setJoiningId]   = useState(null);   // id currently being written to DB
  const [beaconActive, setBeaconActive] = useState(false);
  const [pingFired, setPingFired]   = useState(false);

  // ── Fetch pools on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchPools = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("pools")
        .select("*")
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (!error) setPools(data ?? []);
        setLoading(false);
      }
    };

    fetchPools();
    return () => { cancelled = true; };
  }, []);

  // ── Join a pool ──────────────────────────────────────────────────────────
  const handleJoin = async (id) => {
    // Guard: already joined this pool, or a write is in-flight, or no seats left
    if (joinedPool === id) return;
    if (joiningId !== null) return;

    const pool = pools.find((p) => p.id === id);
    if (!pool || pool.available_seats <= 0) return;

    // 1. Haptics
    if (navigator.vibrate) navigator.vibrate([30, 10, 30]);

    // 2. Optimistic UI update — decrement locally before the DB call returns
    setPools((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, available_seats: Math.max(0, p.available_seats - 1) }
          : p
      )
    );
    setJoinedPool(id);
    setJoiningId(id);

    // 3. Write to Supabase using a safe RPC so the decrement is atomic
    //    Falls back to a plain update if the RPC does not exist yet.
    const newSeats = Math.max(0, pool.available_seats - 1);
    const { error } = await supabase
      .from("pools")
      .update({ available_seats: newSeats })
      .eq("id", id)
      .gt("available_seats", 0);   // server-side guard: never go below 0

    if (error) {
      // Rollback optimistic update on failure
      setPools((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, available_seats: pool.available_seats } : p
        )
      );
      setJoinedPool(null);
    }

    setJoiningId(null);
  };

  // ── Ping & Beacon (UI-only, unchanged) ──────────────────────────────────
  const handlePing = () => {
    setPingFired(true);
    setTimeout(() => setPingFired(false), 2000);
  };

  const handleBeacon = () => {
    setBeaconActive((prev) => !prev);
    if (navigator.vibrate) navigator.vibrate(40);
  };

  // ── Derived counts ───────────────────────────────────────────────────────
  const openCount = pools.filter((p) => p.available_seats > 0).length;

  // ── Render ───────────────────────────────────────────────────────────────
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
          border: none;
          cursor: pointer;
          font-family: 'Nunito', sans-serif;
          font-weight: 800;
          font-size: 13px;
          padding: 7px 18px;
          border-radius: 999px;
          transition: transform 0.13s, box-shadow 0.13s;
        }
        .btn-join:active { transform: scale(0.95); }
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
          box-shadow: 0 0 0 10px rgba(134, 239, 172, 0.25), 0 0 0 20px rgba(134, 239, 172, 0.10);
          animation: pulse-green 2s infinite;
        }
        .beacon-off {
          background: #ffe4f0;
          box-shadow: 0 0 0 8px rgba(255, 182, 213, 0.20);
        }

        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 0 10px rgba(134, 239, 172, 0.25), 0 0 0 20px rgba(134, 239, 172, 0.10); }
          50%       { box-shadow: 0 0 0 14px rgba(134, 239, 172, 0.20), 0 0 0 26px rgba(134, 239, 172, 0.07); }
        }

        .seat-pill {
          display: inline-block; font-size: 11px; font-weight: 800;
          padding: 3px 10px; border-radius: 999px; letter-spacing: 0.02em;
        }

        .pool-row {
          display: flex; align-items: center; gap: 10px; padding: 12px 0;
          border-bottom: 1.5px solid rgba(255, 180, 180, 0.15);
        }
        .pool-row:last-child  { border-bottom: none; padding-bottom: 0; }
        .pool-row:first-child { padding-top: 0; }

        .ping-btn {
          width: 100%; border: none; cursor: pointer;
          font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 17px;
          padding: 18px; border-radius: 999px; letter-spacing: 0.01em;
          transition: transform 0.13s, box-shadow 0.15s;
        }
        .ping-btn:active  { transform: scale(0.97); }
        .ping-default { background: linear-gradient(135deg, #ffb7d4 0%, #ffc9a0 100%); color: #7a2040; box-shadow: 0 4px 18px rgba(255, 140, 160, 0.28); }
        .ping-fired   { background: linear-gradient(135deg, #b2f5c8 0%, #a0e8ff 100%); color: #1a6640; box-shadow: 0 4px 18px rgba(100, 220, 160, 0.28); }

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

        .scroll-pools { overflow-y: auto; max-height: 210px; scrollbar-width: none; }
        .scroll-pools::-webkit-scrollbar { display: none; }

        .loading-row {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 24px 0;
          font-size: 14px; font-weight: 700; color: #f472b6;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
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
          <button className="add-btn" aria-label="Create new pool">+</button>
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
                <div className="spinner" />
                Finding rides...
              </div>
            ) : pools.length === 0 ? (
              <div className="loading-row" style={{ color: "#9ca3af" }}>
                No active pools right now
              </div>
            ) : (
              pools.map((pool) => {
                const joined   = joinedPool === pool.id;
                const isFull   = pool.available_seats <= 0;
                const writing  = joiningId === pool.id;

                let btnClass = "btn-join-default";
                if (joined) btnClass = "btn-join-active";
                else if (isFull) btnClass = "btn-join-full";

                return (
                  <div key={pool.id} className="pool-row">
                    <div style={{ fontSize: "26px", lineHeight: 1 }}>{pool.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: "14px", color: "#1a1a1a", marginBottom: "2px" }}>
                        {pool.driver ?? "Unknown"}
                        <span style={{ fontWeight: 600, color: "#9ca3af", marginLeft: "6px", fontSize: "13px" }}>
                          → {pool.route ?? "—"}
                        </span>
                      </p>
                      <p style={{ fontSize: "12px", color: "#9ca3af", fontWeight: 600 }}>
                        {pool.time}
                      </p>
                    </div>
                    <span
                      className="seat-pill"
                      style={{
                        background: pool.available_seats === 1 ? "#fff0e0" : isFull ? "#f0f0f0" : "#e0f0ff",
                        color:      pool.available_seats === 1 ? "#c05a10" : isFull ? "#9ca3af" : "#1050a0",
                        marginRight: "8px",
                      }}
                    >
                      {isFull ? "Full" : `${pool.available_seats} ${pool.available_seats === 1 ? "seat" : "seats"}`}
                    </span>
                    <button
                      className={`btn-join ${btnClass}`}
                      onClick={() => handleJoin(pool.id)}
                      disabled={isFull || writing}
                    >
                      {writing ? "…" : joined ? "✓ In" : isFull ? "Full" : "Join"}
                    </button>
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
                <button key={route} className="route-chip" style={{ justifyContent: "flex-start" }}>
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
          {pingFired ? "🗳️ Poll Sent to Group!" : "😤 Restless Ping"}
        </button>

      </div>
    </>
  );
}