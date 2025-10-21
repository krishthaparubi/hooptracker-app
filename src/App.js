import React, { useState, useRef, useEffect } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "./App.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function get(obj, path, fallback = 0) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return fallback;
    cur = cur[p];
  }
  return cur ?? fallback;
}

export default function App() {
  // Player/profile
  const [player, setPlayer] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    height: "",
    weight: "",
    position: "",
  });

  // Tabs
  const [activeTab, setActiveTab] = useState("");

  // Game & timer
  const [gameTitle, setGameTitle] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [gameLocked, setGameLocked] = useState(false); // freeze when ended
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  // Shots and stats for current game
  const emptyStats = {
    points: 0,
    fgMade: 0,
    fgAttempted: 0,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: { shooting: 0, blocking: 0, offensive: 0, reaching: 0 },
  };
  const [stats, setStats] = useState({ ...emptyStats });
  const [shots, setShots] = useState([]); // {x,y,type,make}

  // Saved games (for charts)
  const [games, setGames] = useState([]); // {title, stats, shots, duration}

  // popup / court selection
  const [showPopup, setShowPopup] = useState(false);
  const [lastClickPos, setLastClickPos] = useState({ x: 300, y: 120 }); // stationary marker
  const [popupShotType, setPopupShotType] = useState("2pt"); // dropdown inside popup

  // chart selection
  const [selectedStat, setSelectedStat] = useState("points");

  // Timer effect — starts/stops interval based on gameStarted and gameLocked
  useEffect(() => {
    if (gameStarted && !gameLocked) {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setTimer((t) => t + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      // no-op cleanup handled above
    };
  }, [gameStarted, gameLocked]);

  // Start a new game (must have title)
  function handleStartGame() {
    if (!gameTitle.trim()) {
      alert("Please enter a game title before starting (e.g. 'JV 1 vs Marcus').");
      return;
    }
    setStats({ ...emptyStats });
    setShots([]);
    setTimer(0);
    setGameStarted(true);
    setGameLocked(false);
    setActiveTab("newGame");
  }

  // End game: now accepts ending when paused/bench. It will save if there is data (timer>0 or shots or non-zero stats)
  function handleEndGame() {
    // allow end even if gameStarted is false (bench) as long as there is something to save
    const hasData =
      timer > 0 ||
      shots.length > 0 ||
      Object.keys(stats).some((k) => {
        if (k === "fouls") return Object.values(stats.fouls).some((v) => v > 0);
        return typeof stats[k] === "number" && stats[k] > 0;
      });

    if (!hasData) {
      alert("No game data to save.");
      return;
    }

    // freeze and save game
    setGameLocked(true);
    setGameStarted(false);
    // stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // save game
    const newGame = {
      title: gameTitle || `Game ${games.length + 1}`,
      stats: JSON.parse(JSON.stringify(stats)),
      shots: JSON.parse(JSON.stringify(shots)),
      duration: timer,
    };
    setGames((g) => [...g, newGame]);
    // reset timer so next game starts at 0 visually
    setTimer(0);
    setGameTitle("");
    // keep stats saved in games; clear current stats for next new game
    setStats({ ...emptyStats });
    setShots([]);
    setGameLocked(true);
    alert("Game saved to history. Go to Advanced Stats to view charts.");
    setActiveTab("charts");
  }

  // handle court click -> open stationary popup modal (center)
  function handleCourtClick(e) {
    if (!gameStarted || gameLocked) return;
    // record click position relative to element for marker placement
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setLastClickPos({ x, y });
    setPopupShotType("2pt"); // default each time
    setShowPopup(true);
  }

  // record shot selection from modal (dropdown + Make/Miss)
  function recordShot(type, make) {
    // type: '2pt' | '3pt' | 'ft'
    // make: boolean
    const pts = make ? (type === "3pt" ? 3 : type === "2pt" ? 2 : 1) : 0;
    // update shots (marker)
    setShots((s) => [...s, { x: lastClickPos.x, y: lastClickPos.y, type, make }]);
    // update stats
    setStats((prev) => {
      const next = JSON.parse(JSON.stringify(prev)); // clone
      if (type === "2pt") {
        next.fgAttempted += 1;
        if (make) {
          next.fgMade += 1;
          next.points += 2;
        }
      } else if (type === "3pt") {
        next.fgAttempted += 1;
        next.threeAttempted = (next.threeAttempted || 0) + 1;
        if (make) {
          next.fgMade += 1;
          next.threeMade += 1;
          next.points += 3;
        }
      } else if (type === "ft") {
        next.ftAttempted = (next.ftAttempted || 0) + 1;
        if (make) {
          next.ftMade += 1;
          next.points += 1;
        }
      }
      return next;
    });
    setShowPopup(false);
  }

  // stat buttons (rebounds, assists, steals, blocks, turnovers, fouls)
  function incStat(statKey, subtype = null) {
    setStats((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (statKey === "foul") {
        if (subtype && next.fouls && typeof next.fouls[subtype] === "number") {
          next.fouls[subtype] += 1;
        }
      } else {
        next[statKey] = (next[statKey] || 0) + 1;
      }
      return next;
    });
  }

  // Chart data using saved games
  const statOptions = [
    { value: "points", label: "Points" },
    { value: "fgMade", label: "FG Made" },
    { value: "fgAttempted", label: "FG Attempted" },
    { value: "threeMade", label: "3PT Made" },
    { value: "threeAttempted", label: "3PT Attempted" },
    { value: "ftMade", label: "FT Made" },
    { value: "ftAttempted", label: "FT Attempted" },
    { value: "rebounds", label: "Rebounds" },
    { value: "assists", label: "Assists" },
    { value: "steals", label: "Steals" },
    { value: "blocks", label: "Blocks" },
    { value: "turnovers", label: "Turnovers" },
    { value: "fouls.shooting", label: "Fouls - Shooting" },
    { value: "fouls.blocking", label: "Fouls - Blocking" },
    { value: "fouls.offensive", label: "Fouls - Offensive" },
    { value: "fouls.reaching", label: "Fouls - Reaching" },
    { value: "timePlayed", label: "Time Played (s)" },
  ];

  const chartLabels = games.map((g) => g.title || "Game");
  const chartValues = games.map((g) => {
    if (selectedStat === "timePlayed") return g.duration || 0;
    if (selectedStat && selectedStat.startsWith("fouls.")) return get(g.stats, selectedStat, 0);
    return g.stats[selectedStat] ?? 0;
  });

  const lineData = {
    labels: chartLabels,
    datasets: [
      {
        label: statOptions.find((s) => s.value === selectedStat)?.label || selectedStat,
        data: chartValues,
        borderColor: "#4c6cff",
        backgroundColor: "#b9c8ff66",
        tension: 0.2,
      },
    ],
  };
  const barData = {
    labels: chartLabels,
    datasets: [
      {
        label: statOptions.find((s) => s.value === selectedStat)?.label || selectedStat,
        data: chartValues,
        backgroundColor: "#ff9f43",
      },
    ],
  };

  // format mm:ss
  function fmtTime(sec) {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div className="app">
      <h1>HoopTracker</h1>

      {!player ? (
        <div>
          <h2>New Player</h2>
          <form
            className="profile-form"
            onSubmit={(e) => {
              e.preventDefault();
              setPlayer({ ...profileForm });
              setActiveTab("newGame");
            }}
          >
            <input
              placeholder="Player name"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              required
            />
            <input
              placeholder="Height"
              value={profileForm.height}
              onChange={(e) => setProfileForm({ ...profileForm, height: e.target.value })}
            />
            <input
              placeholder="Weight"
              value={profileForm.weight}
              onChange={(e) => setProfileForm({ ...profileForm, weight: e.target.value })}
            />
            <input
              placeholder="Position"
              value={profileForm.position}
              onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
            />
            <button type="submit">Create Player</button>
          </form>
        </div>
      ) : (
        <div>
          <div className="tabs">
            <button onClick={() => setActiveTab("newGame")}>New Game</button>
            <button onClick={() => setActiveTab("charts")}>Advanced Stats</button>
            <button onClick={() => setActiveTab("updateProfile")}>Update Profile</button>
          </div>

          {activeTab === "newGame" && (
            <>
              <div style={{ marginTop: 10 }}>
                <input
                  placeholder="Game title (e.g. JV 1 vs Marcus)"
                  value={gameTitle}
                  onChange={(e) => setGameTitle(e.target.value)}
                  style={{ width: 420, padding: 8, borderRadius: 6, border: "1px solid #999" }}
                />
                <button
                  style={{ marginLeft: 10, padding: "8px 12px" }}
                  onClick={() => {
                    if (!gameStarted) {
                      handleStartGame();
                    } else {
                      alert("Game already started. End the game first to start a new one.");
                    }
                  }}
                >
                  {gameStarted ? "Game in progress" : "New Game (Start)"}
                </button>
                <button
                  style={{ marginLeft: 10, padding: "8px 12px" }}
                  onClick={() => {
                    // allow ending even if paused/bench
                    handleEndGame();
                  }}
                >
                  End Game
                </button>
              </div>

              <div className="timer" style={{ marginTop: 12 }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>Time on Court: {fmtTime(timer)}</span>
                <button
                  onClick={() => {
                    if (!gameStarted) {
                      alert("Start a game first.");
                      return;
                    }
                    setGameStarted(true);
                    setGameLocked(false);
                    // start interval via effect
                  }}
                >
                  Play
                </button>
                <button
                  onClick={() => {
                    // bench (pause) but still allow endGame
                    setGameStarted(false);
                    setGameLocked(false);
                  }}
                >
                  Bench
                </button>
                <button
                  onClick={() => {
                    setTimer(0);
                  }}
                >
                  Reset Timer
                </button>
              </div>

              {/* Court (CSS lines unchanged) */}
              <div className="court" onClick={handleCourtClick}>
                <div className="paint" />
                <div className="ft-line" />
                <div className="block" />
                <div className="arc" />
                <div className="hoop" />

                {shots.map((s, i) => (
                  <div
                    key={i}
                    className="shot-mark"
                    style={{
                      left: s.x,
                      top: s.y,
                      backgroundColor: s.make ? "green" : "red",
                      transform: "translate(-50%, -50%)",
                      position: "absolute",
                    }}
                    title={`${s.type} - ${s.make ? "Make" : "Miss"}`}
                  />
                ))}
              </div>

              {/* Popup: dropdown + Make / Miss buttons */}
              {showPopup && (
                <div className="popup">
                  <h3>Select Shot</h3>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ marginRight: 8 }}>Shot type:</label>
                    <select value={popupShotType} onChange={(e) => setPopupShotType(e.target.value)}>
                      <option value="2pt">2PT</option>
                      <option value="3pt">3PT</option>
                      <option value="ft">FT</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button onClick={() => recordShot(popupShotType, true)}>Make</button>
                    <button onClick={() => recordShot(popupShotType, false)}>Miss</button>
                    <button onClick={() => setShowPopup(false)}>Cancel</button>
                  </div>
                </div>
              )}

              <div className="stat-buttons" style={{ marginTop: 14 }}>
                <button onClick={() => incStat("rebounds")}>Rebound</button>
                <button onClick={() => incStat("assists")}>Assist</button>
                <button onClick={() => incStat("steals")}>Steal</button>
                <button onClick={() => incStat("blocks")}>Block</button>
                <button onClick={() => incStat("turnovers")}>Turnover</button>

                <button onClick={() => incStat("foul", "shooting")}>Shooting Foul</button>
                <button onClick={() => incStat("foul", "blocking")}>Blocking Foul</button>
                <button onClick={() => incStat("foul", "offensive")}>Offensive Foul</button>
                <button onClick={() => incStat("foul", "reaching")}>Reaching Foul</button>
              </div>

              <div className="box-score" style={{ marginTop: 16 }}>
                <h3>Box Score</h3>
                <p>Points: {stats.points}</p>
                <p>FG: {stats.fgMade}/{stats.fgAttempted}</p>
                <p>3PT: {stats.threeMade}/{stats.threeAttempted || 0}</p>
                <p>FT: {stats.ftMade}/{stats.ftAttempted || 0}</p>
                <p>Rebounds: {stats.rebounds}</p>
                <p>Assists: {stats.assists}</p>
                <p>Steals: {stats.steals}</p>
                <p>Blocks: {stats.blocks}</p>
                <p>Turnovers: {stats.turnovers}</p>
                <p>Fouls - Shooting: {stats.fouls.shooting}, Blocking: {stats.fouls.blocking}, Offensive: {stats.fouls.offensive}, Reaching: {stats.fouls.reaching}</p>
              </div>
            </>
          )}

          {activeTab === "charts" && (
            <div className="charts">
              <h2>Advanced Stats</h2>
              <div style={{ marginBottom: 12 }}>
                <select value={selectedStat} onChange={(e) => setSelectedStat(e.target.value)}>
                  {statOptions.map((o) => (
                    <option value={o.value} key={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <Line data={lineData} />
              </div>
              <div>
                <Bar data={barData} />
              </div>
            </div>
          )}

          {activeTab === "updateProfile" && (
            <div>
              <h2>Update Profile</h2>
              <form className="profile-form" onSubmit={(e) => e.preventDefault()}>
                <input value={player.name} onChange={(e) => setPlayer({ ...player, name: e.target.value })} />
                <input value={player.height} onChange={(e) => setPlayer({ ...player, height: e.target.value })} />
                <input value={player.weight} onChange={(e) => setPlayer({ ...player, weight: e.target.value })} />
                <input value={player.position} onChange={(e) => setPlayer({ ...player, position: e.target.value })} />
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}










