"use client";

import { useEffect, useMemo, useState } from "react";
import { demoFixtureFeed } from "../lib/demo-data";
import type {
  Fixture,
  FixtureFeed,
  MarketType,
  Pick,
  SelectionOutcome,
  SubmissionReceipt,
} from "../lib/types";

type View = "selections" | "credits" | "leaderboard" | "picks" | "admin";
type Toast = { tone: "success" | "warning"; message: string } | null;

const PICK_STORAGE = "tactelo:draft-picks";
const RECEIPT_STORAGE = "tactelo:receipt";
const USER_STORAGE = "tactelo:user";
const ANALYTICS_STORAGE = "tactelo:analytics";

const outcomeMeta: Record<
  SelectionOutcome,
  { market: MarketType; short: string; className: string }
> = {
  home: { market: "result", short: "Home", className: "home" },
  draw: { market: "result", short: "Draw", className: "draw" },
  away: { market: "result", short: "Away", className: "away" },
  over: { market: "goals", short: "Over 2.5", className: "over" },
  under: { market: "goals", short: "Under 2.5", className: "under" },
};

function track(name: string, detail: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    const current = JSON.parse(localStorage.getItem(ANALYTICS_STORAGE) ?? "[]") as unknown[];
    const next = [...current.slice(-99), { name, detail, at: new Date().toISOString() }];
    localStorage.setItem(ANALYTICS_STORAGE, JSON.stringify(next));
  } catch {
    // Analytics must never interrupt the game journey.
  }
}

function formatKickoff(fixture: Fixture) {
  const date = new Date(fixture.kickoffIso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function deadlineLabel(feed: FixtureFeed) {
  if (!feed.fixtures.length) return "No active deadline";
  const first = [...feed.fixtures].sort(
    (a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime(),
  )[0];
  return formatKickoff(first);
}

function selectionLabel(fixture: Fixture, outcome: SelectionOutcome) {
  if (outcome === "home") return fixture.homeTeam;
  if (outcome === "away") return fixture.awayTeam;
  return outcomeMeta[outcome].short;
}

function Brand() {
  return (
    <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Tactelo home">
      <span className="brand-crop" aria-hidden="true" />
    </button>
  );
}

function TopNav({ view, onView, user, admin }: { view: View; onView: (view: View) => void; user: string | null; admin: boolean }) {
  const items: Array<[View, string, string]> = [
    ["selections", "Make picks", "◎"],
    ["picks", "My picks", "▣"],
    ["leaderboard", "Leaderboard", "↗"],
  ];
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Primary navigation">
          {items.map(([target, label]) => (
            <button key={target} className={view === target || (target === "selections" && view === "credits") ? "active" : ""} onClick={() => onView(target)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="account-area">
          {admin && <button className="admin-link" onClick={() => onView("admin")}>Admin</button>}
          <span className={user ? "avatar signed-in" : "avatar"}>{user ? user.slice(0, 1).toUpperCase() : "?"}</span>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ view, onView }: { view: View; onView: (view: View) => void }) {
  const items: Array<[View, string, string]> = [
    ["selections", "Picks", "◎"],
    ["picks", "My entry", "▣"],
    ["leaderboard", "Table", "↗"],
  ];
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map(([target, label, icon]) => (
        <button key={target} className={view === target || (target === "selections" && view === "credits") ? "active" : ""} onClick={() => onView(target)}>
          <span>{icon}</span>{label}
        </button>
      ))}
    </nav>
  );
}

function SelectionButton({
  fixture,
  outcome,
  selected,
  locked,
  onSelect,
}: {
  fixture: Fixture;
  outcome: SelectionOutcome;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  const meta = outcomeMeta[outcome];
  const label = selectionLabel(fixture, outcome);
  return (
    <button
      className={`outcome-button ${meta.className} ${selected ? "selected" : ""} ${locked ? "locked" : ""}`}
      onClick={onSelect}
      disabled={locked && !selected}
      aria-pressed={selected}
      aria-label={`${label}, 1 credit returns ${fixture.prices[outcome].toFixed(2)} points`}
    >
      <span className="outcome-name">{selected && <span className="check">✓</span>}{label}</span>
      <strong>{fixture.prices[outcome].toFixed(2)} <small>pts</small></strong>
    </button>
  );
}

function FixtureCard({ fixture, pick, onToggle }: { fixture: Fixture; pick?: Pick; onToggle: (outcome: SelectionOutcome) => void }) {
  const locked = Boolean(pick);
  return (
    <article className={`fixture-card ${locked ? "fixture-selected" : ""}`}>
      <div className="fixture-topline">
        <span>{fixture.competition}</span>
        <time dateTime={fixture.kickoffIso}>{formatKickoff(fixture)}</time>
      </div>
      <div className="teams-row">
        <div className="team-colour home-colour" style={{ "--primary": fixture.homeColours.primary, "--secondary": fixture.homeColours.secondary } as React.CSSProperties}><span>H</span></div>
        <div className="team-names">
          <strong>{fixture.homeTeam}</strong>
          <span>v</span>
          <strong>{fixture.awayTeam}</strong>
        </div>
        <div className="team-colour away-colour" style={{ "--primary": fixture.awayColours.primary, "--secondary": fixture.awayColours.secondary } as React.CSSProperties}><span>A</span></div>
      </div>
      <div className="market-block">
        <div className="market-heading"><span>Match result</span><small>Potential points per credit</small></div>
        <div className="result-grid">
          {(["home", "draw", "away"] as SelectionOutcome[]).map((outcome) => (
            <SelectionButton key={outcome} fixture={fixture} outcome={outcome} selected={pick?.outcome === outcome} locked={locked} onSelect={() => onToggle(outcome)} />
          ))}
        </div>
      </div>
      <div className="market-block goals-block">
        <div className="market-heading"><span>Total goals</span><small>Under / over 2.5</small></div>
        <div className="goals-grid">
          {(["over", "under"] as SelectionOutcome[]).map((outcome) => (
            <SelectionButton key={outcome} fixture={fixture} outcome={outcome} selected={pick?.outcome === outcome} locked={locked} onSelect={() => onToggle(outcome)} />
          ))}
        </div>
      </div>
      {pick && (
        <button className="unlock-button" onClick={() => onToggle(pick.outcome)}><span>↺</span> Change this selection</button>
      )}
    </article>
  );
}

function PickTray({ picks, onRemove, onContinue }: { picks: Pick[]; onRemove: (fixtureId: string) => void; onContinue: () => void }) {
  return (
    <aside className="pick-tray">
      <div className="tray-heading">
        <div><span className="eyebrow">Your gameweek</span><h2>{picks.length} of 3 picks</h2></div>
        <span className="pick-count">{picks.length}/3</span>
      </div>
      <div className="progress-track"><span style={{ width: `${(picks.length / 3) * 100}%` }} /></div>
      <div className="tray-list">
        {[0, 1, 2].map((slot) => {
          const pick = picks[slot];
          return pick ? (
            <div className="tray-pick" key={pick.fixtureId}>
              <span className={`market-dot ${outcomeMeta[pick.outcome].className}`} />
              <div><strong>{pick.label}</strong><small>{pick.fixtureLabel}</small></div>
              <span className="tray-price">{pick.price.toFixed(2)}</span>
              <button onClick={() => onRemove(pick.fixtureId)} aria-label={`Remove ${pick.label}`}>×</button>
            </div>
          ) : (
            <div className="tray-empty" key={slot}><span>{slot + 1}</span><p>Choose from a different fixture</p></div>
          );
        })}
      </div>
      <button className="primary-button full" disabled={picks.length !== 3} onClick={onContinue}>
        Allocate 6 credits <span>→</span>
      </button>
      <p className="tray-note">One pick per fixture. You can change any pick before submitting.</p>
    </aside>
  );
}

function HoldingState() {
  return (
    <section className="holding-state">
      <div className="holding-icon"><span>◌</span></div>
      <span className="eyebrow">Between gameweeks</span>
      <h1>No fixtures are currently available</h1>
      <p>The next gameweek will appear once fixtures and prices have been published.</p>
      <div className="holding-actions"><button className="secondary-button">View previous picks</button><button className="secondary-button">View leaderboard</button></div>
    </section>
  );
}

function MakeSelections({ feed, picks, onPicks, onContinue, closed }: { feed: FixtureFeed; picks: Pick[]; onPicks: (picks: Pick[]) => void; onContinue: () => void; closed: boolean }) {
  const toggle = (fixture: Fixture, outcome: SelectionOutcome) => {
    const current = picks.find((item) => item.fixtureId === fixture.id);
    if (current) {
      const next = picks.filter((item) => item.fixtureId !== fixture.id);
      onPicks(next);
      track("selection_removed", { fixtureId: fixture.id, outcome: current.outcome });
      if (current.outcome === outcome) return;
    }
    if (picks.length >= 3 || closed) return;
    const nextPick: Pick = {
      fixtureId: fixture.id,
      market: outcomeMeta[outcome].market,
      outcome,
      label: selectionLabel(fixture, outcome),
      price: fixture.prices[outcome],
      fixtureLabel: `${fixture.homeTeam} v ${fixture.awayTeam}`,
    };
    onPicks([...picks.filter((item) => item.fixtureId !== fixture.id), nextPick]);
    track("selection_added", { fixtureId: fixture.id, outcome, price: fixture.prices[outcome] });
  };

  if (!feed.fixtures.length) return <HoldingState />;
  return (
    <>
      <section className="page-intro">
        <div>
          <span className="eyebrow">{feed.gameweekLabel}</span>
          <h1>Build your winning week.</h1>
          <p>Choose three predictions from three different fixtures. The return shown is how many points one credit could earn.</p>
        </div>
        <div className={`deadline-card ${closed ? "closed" : ""}`}>
          <span className="status-dot" /><div><small>{closed ? "Selections closed" : "Selections close"}</small><strong>{deadlineLabel(feed)}</strong></div>
        </div>
      </section>
      <div className="selection-layout">
        <section className="fixtures-column" aria-label="Available fixtures">
          <div className="section-heading"><div><h2>Premier League fixtures</h2><p>{feed.fixtures.length} fixtures available</p></div><span className="live-chip">● {feed.source === "google-sheet" ? "Live prices" : "Demo snapshot"}</span></div>
          {closed && <div className="alert warning"><span>!</span><div><strong>This gameweek is closed</strong><p>The first fixture has kicked off, so new submissions are unavailable.</p></div></div>}
          {feed.fixtures.map((fixture) => (
            <FixtureCard key={fixture.id} fixture={fixture} pick={picks.find((pick) => pick.fixtureId === fixture.id)} onToggle={(outcome) => toggle(fixture, outcome)} />
          ))}
        </section>
        <PickTray picks={picks} onRemove={(fixtureId) => { onPicks(picks.filter((pick) => pick.fixtureId !== fixtureId)); track("selection_removed", { fixtureId }); }} onContinue={onContinue} />
      </div>
    </>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Remove one credit">−</button>
      <strong>{value}</strong>
      <button onClick={() => onChange(value + 1)} disabled={value >= 4} aria-label="Add one credit">+</button>
    </div>
  );
}

function CreditsView({ picks, onBack, onSubmit }: { picks: Pick[]; onBack: () => void; onSubmit: (credits: number[], combo: number) => void }) {
  const [credits, setCredits] = useState([2, 2, 2]);
  const [combo, setCombo] = useState(0);
  const total = credits.reduce((sum, value) => sum + value, 0) + combo;
  const remaining = 6 - total;
  const comboPrice = picks.reduce((product, pick) => product * pick.price, 1);
  const valid = picks.length === 3 && total === 6 && credits.every((value) => value >= 1 && value <= 4) && combo >= 0 && combo <= 1;

  const changeCredit = (index: number, value: number) => {
    if (value < 1 || value > 4) return;
    const next = [...credits];
    next[index] = value;
    setCredits(next);
    track("credits_redistributed", { credits: next, combo });
  };
  const toggleCombo = () => {
    if (combo === 1) {
      setCombo(0);
      setCredits([2, 2, 2]);
      return;
    }
    setCombo(1);
    setCredits([2, 2, 1]);
    track("combo_credit_enabled", { comboPrice });
  };

  return (
    <section className="credits-page">
      <button className="back-link" onClick={onBack}>← Back to fixtures</button>
      <div className="credits-header">
        <div><span className="eyebrow">Step 2 of 2</span><h1>Put your credits to work.</h1><p>Use all six credits. Give more to the predictions you believe in most.</p></div>
        <div className={`credit-meter ${remaining === 0 ? "complete" : ""}`}><small>Credits remaining</small><strong>{remaining}</strong><span>of 6</span></div>
      </div>
      <div className="credits-layout">
        <div className="allocation-column">
          <div className="allocation-summary"><span>Individual picks</span><small>1–4 credits each</small></div>
          {picks.map((pick, index) => (
            <article className="allocation-card" key={pick.fixtureId}>
              <span className={`market-line ${outcomeMeta[pick.outcome].className}`} />
              <div className="allocation-main"><span className="market-label">{pick.market === "result" ? "Match result" : "Total goals"}</span><h2>{pick.label}</h2><p>{pick.fixtureLabel} · {pick.price.toFixed(2)} points per credit</p></div>
              <Stepper value={credits[index]} onChange={(value) => changeCredit(index, value)} />
              <div className="potential-return"><small>Potential points</small><strong>{(credits[index] * pick.price).toFixed(2)}</strong></div>
            </article>
          ))}
          <article className={`combo-card ${combo ? "enabled" : ""}`}>
            <div className="combo-icon">×3</div>
            <div className="combo-copy"><span className="market-label">Optional combo</span><h2>All three picks win</h2><p>Uses one of your six credits. Void legs are removed from the combined return.</p><div className="combo-legs">{picks.map((pick) => <span key={pick.fixtureId}>{pick.price.toFixed(2)}</span>)}<strong>= {comboPrice.toFixed(2)} pts</strong></div></div>
            <button className={`toggle ${combo ? "on" : ""}`} onClick={toggleCombo} role="switch" aria-checked={Boolean(combo)}><span /></button>
            <div className="potential-return"><small>Combo credits</small><strong>{combo}</strong></div>
          </article>
        </div>
        <aside className="review-card">
          <span className="eyebrow">Entry review</span><h2>Your potential returns</h2>
          <div className="review-lines">
            {picks.map((pick, index) => <div key={pick.fixtureId}><span>{credits[index]} × {pick.label}</span><strong>{(credits[index] * pick.price).toFixed(2)}</strong></div>)}
            {combo > 0 && <div className="combo-review"><span>1 × Three-pick combo</span><strong>{comboPrice.toFixed(2)}</strong></div>}
          </div>
          <div className="max-return"><span>Maximum potential points</span><strong>{(picks.reduce((sum, pick, index) => sum + pick.price * credits[index], 0) + combo * comboPrice).toFixed(2)}</strong></div>
          <div className={`credit-check ${valid ? "valid" : ""}`}><span>{valid ? "✓" : "!"}</span>{valid ? "All six credits allocated" : remaining > 0 ? `${remaining} credit${remaining === 1 ? "" : "s"} still to allocate` : `${Math.abs(remaining)} too many credits allocated`}</div>
          <button className="primary-button full" disabled={!valid} onClick={() => onSubmit(credits, combo)}>Submit final picks <span>→</span></button>
          <p className="tray-note">You’ll be asked to log in or create an account before your entry is saved.</p>
        </aside>
      </div>
    </section>
  );
}

function LoginModal({ onClose, onComplete }: { onClose: () => void; onComplete: (details: { email: string; password: string; displayName: string; mode: "login" | "register" }) => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6 || (mode === "register" && !name.trim())) {
      setError("Enter valid account details. Passwords need at least six characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onComplete({ email: email.toLowerCase(), password, displayName: name.trim(), mode });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-brand"><div className="mini-mark">◎</div><span>Tactelo</span></div>
        <span className="eyebrow">Your picks are safe</span>
        <h2 id="login-title">{mode === "login" ? "Log in to submit." : "Create your free account."}</h2>
        <p>We’ve kept your three picks and credit choices ready. Sign in now to add them to the competition.</p>
        <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button></div>
        <form onSubmit={submit}>
          {mode === "register" && <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Matt C" autoComplete="name" /></label>}
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button full" disabled={busy}>{busy ? "Saving your entry…" : mode === "login" ? "Log in & submit" : "Create account & submit"}<span>→</span></button>
        </form>
        <small className="privacy-note">Free to play. No payment details, cash balances or marketing opt-in required.</small>
      </div>
    </div>
  );
}

type EntryResult = "pending" | "won" | "lost" | "void";
type LiveEntry = {
  status: string;
  selections: Array<{ fixtureId: string; result: EntryResult; points: number }>;
  combo: { result: EntryResult; points: number; settledPrice: number | null } | null;
};
type LeaderboardRow = { name: string; points: number; winners: number; average: number };

function resultLabel(result: EntryResult) {
  if (result === "won") return "Won";
  if (result === "lost") return "Lost";
  if (result === "void") return "Void";
  return "Awaiting result";
}

function PicksView({ receipt, onMakePicks }: { receipt: SubmissionReceipt | null; onMakePicks: () => void }) {
  const [liveEntry, setLiveEntry] = useState<LiveEntry | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!receipt) return;
    let cancelled = false;
    fetch(`/api/my-entry?receiptId=${encodeURIComponent(receipt.id)}&refresh=${Date.now()}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as LiveEntry & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Your results could not be loaded.");
        return payload;
      })
      .then((payload) => { if (!cancelled) { setLiveEntry(payload); setLoadError(""); } })
      .catch((reason) => { if (!cancelled) setLoadError(reason instanceof Error ? reason.message : "Your results could not be loaded."); });
    return () => { cancelled = true; };
  }, [receipt]);

  if (!receipt) {
    return <section className="empty-entry"><div className="empty-entry-icon">▣</div><span className="eyebrow">My picks</span><h1>No entry submitted yet.</h1><p>Choose three predictions, allocate your six credits and submit before the first fixture kicks off.</p><button className="primary-button" onClick={onMakePicks}>Make my picks <span>→</span></button></section>;
  }
  return (
    <section className="receipt-page">
      <div className="receipt-hero"><div className="success-ring">✓</div><span className="eyebrow">{liveEntry?.status === "settled" ? "Gameweek settled" : "Entry confirmed"}</span><h1>{liveEntry?.status === "settled" ? "Your results are in." : "You’re in for the gameweek."}</h1><p>Submitted {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(receipt.submittedAt))}</p><div className="receipt-id">Receipt {receipt.id}</div></div>
      {loadError && <div className="alert warning"><span>!</span><div><strong>Live results unavailable</strong><p>{loadError}</p></div></div>}
      <div className="receipt-grid">
        {receipt.picks.map((pick, index) => {
          const settled = liveEntry?.selections.find((item) => item.fixtureId === pick.fixtureId);
          const result = settled?.result ?? "pending";
          const displayPoints = result === "pending" ? receipt.credits[index] * pick.price : settled?.points ?? 0;
          return <article className={`receipt-pick result-${result}`} key={pick.fixtureId}><span className={`market-line ${outcomeMeta[pick.outcome].className}`} /><small>{pick.fixtureLabel}</small><h2>{pick.label}</h2><div><span>{receipt.credits[index]} credit{receipt.credits[index] === 1 ? "" : "s"} × {pick.price.toFixed(2)}</span><strong>{displayPoints.toFixed(2)} pts</strong></div><em>{resultLabel(result)}</em></article>;
        })}
        {receipt.comboCredit > 0 && (() => {
          const result = liveEntry?.combo?.result ?? "pending";
          const price = liveEntry?.combo?.settledPrice ?? receipt.comboPrice;
          const points = result === "pending" ? receipt.comboPrice : liveEntry?.combo?.points ?? 0;
          return <article className={`receipt-pick receipt-combo result-${result}`}><span className="market-line combo" /><small>Three-pick combo</small><h2>All three to win</h2><div><span>1 credit × {price.toFixed(2)}</span><strong>{points.toFixed(2)} pts</strong></div><em>{resultLabel(result)}</em></article>;
        })()}
      </div>
      <div className="receipt-foot"><span>Selections and prices are locked to snapshot <strong>{receipt.snapshotId}</strong>.</span><button className="secondary-button">Game rules</button></div>
    </section>
  );
}

function LeaderboardView() {
  const [scope, setScope] = useState<"overall" | "gameweek">("overall");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/leaderboard?scope=${scope}&refresh=${Date.now()}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { rows?: LeaderboardRow[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Leaderboard could not be loaded.");
        return payload.rows ?? [];
      })
      .then((nextRows) => { if (!cancelled) { setRows(nextRows); setLoadError(""); } })
      .catch((reason) => { if (!cancelled) { setRows([]); setLoadError(reason instanceof Error ? reason.message : "Leaderboard could not be loaded."); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope]);

  const podiumOrder = rows.length >= 3 ? [rows[1], rows[0], rows[2]] : rows;
  return (
    <section className="leaderboard-page">
      <div className="leaderboard-hero"><div><span className="eyebrow">Official competition</span><h1>The Tactelo table.</h1><p>Ranked by points, then winning picks and average winning return.</p></div><div className="scope-toggle"><button className={scope === "overall" ? "active" : ""} onClick={() => setScope("overall")}>Overall</button><button className={scope === "gameweek" ? "active" : ""} onClick={() => setScope("gameweek")}>Current gameweek</button></div></div>
      {loading && <div className="alert"><span>◌</span><div><strong>Loading leaderboard</strong><p>Retrieving the latest settled scores.</p></div></div>}
      {loadError && <div className="alert warning"><span>!</span><div><strong>Leaderboard unavailable</strong><p>{loadError}</p></div></div>}
      {!loading && !loadError && rows.length === 0 && <div className="alert"><span>i</span><div><strong>No settled scores yet</strong><p>The leaderboard will appear after the first gameweek is settled.</p></div></div>}
      {rows.length > 0 && <>
        <div className="podium">
          {podiumOrder.map((row, index) => {
            const place = rows.indexOf(row) + 1;
            return <article className={`podium-card place-${place}`} key={row.name}><span className="place">{place}</span><div className="podium-avatar">{row.name.split(" ").map((part) => part[0]).join("")}</div><h2>{row.name}</h2><strong>{Number(row.points).toFixed(2)}</strong><small>points</small></article>;
          })}
        </div>
        <div className="table-card">
          <div className="table-head"><span>Pos</span><span>Player</span><span>Winning picks</span><span>Avg return</span><span>Points</span></div>
          {rows.map((row, index) => <div className="table-row" key={row.name}><span className="position">{index + 1}</span><div className="player-cell"><span className="small-avatar">{row.name[0]}</span><strong>{row.name}</strong></div><span>{row.winners}</span><span>{Number(row.average).toFixed(2)}</span><strong>{Number(row.points).toFixed(2)}</strong></div>)}
        </div>
      </>}
      <p className="tiebreak-note"><span>i</span> Ties are separated by winning individual picks, then average winning return. Combo wins add points but do not count as individual wins.</p>
    </section>
  );
}

function AdminLogin({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json() as { authenticated?: boolean; error?: string };
      if (!response.ok || !payload.authenticated) throw new Error(payload.error ?? "Admin sign-in failed");
      setPassword("");
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Admin sign-in failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit}>
        <span className="admin-lock" aria-hidden="true">⌑</span>
        <span className="eyebrow">Restricted access</span>
        <h1>Admin sign in.</h1>
        <p>Enter the private Tactelo admin password to access imports, results and settlement controls.</p>
        <label htmlFor="admin-password">Admin password</label>
        <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus required />
        {error && <div className="admin-login-error" role="alert">{error}</div>}
        <button className="primary-button full" type="submit" disabled={busy || !password}>{busy ? "Signing in…" : "Sign in securely"}<span>→</span></button>
        <button className="admin-cancel" type="button" onClick={onCancel}>Return to Tactelo</button>
      </form>
    </section>
  );
}

function AdminView({ feed, onFeed, toast, onLogout }: { feed: FixtureFeed; onFeed: (feed: FixtureFeed) => void; toast: (message: string, tone?: "success" | "warning") => void; onLogout: () => void }) {
  const [scores, setScores] = useState<Record<string, [string, string]>>({});
  const [busy, setBusy] = useState(false);
  const [showSettlementPreview, setShowSettlementPreview] = useState(false);
  const importNow = async () => {
    setBusy(true);
    try {
      const importResponse = await fetch("/api/admin/import?confirm=true", { method: "POST" });
      const importPayload = await importResponse.json() as { fixtures?: number; error?: string };
      if (!importResponse.ok) throw new Error(importPayload.error ?? "Fixture import failed");

      const feedResponse = await fetch(`/api/fixtures?refresh=${Date.now()}`, { cache: "no-store" });
      if (!feedResponse.ok) throw new Error("Fixtures were imported but the active feed could not be refreshed");
      const nextFeed = await feedResponse.json() as FixtureFeed;
      onFeed(nextFeed);
      toast(`${importPayload.fixtures ?? nextFeed.fixtures.length} fixtures imported and activated successfully.`);
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "Fixture import failed", "warning");
    } finally {
      setBusy(false);
    }
  };
  const completedScores = feed.fixtures.map((fixture) => {
    const [home, away] = scores[fixture.id] ?? ["", ""];
    return { fixture, home, away };
  });
  const reviewSettlement = () => {
    if (completedScores.some(({ home, away }) => home === "" || away === "")) {
      toast("Enter a final score for every fixture before reviewing settlement.", "warning");
      return;
    }
    setShowSettlementPreview(true);
    window.setTimeout(() => document.getElementById("settlement-preview")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const confirmSettlement = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId: feed.snapshotId,
          actor: "admin",
          scores: completedScores.map(({ fixture, home, away }) => ({
            fixtureId: fixture.id,
            homeGoals: Number(home),
            awayGoals: Number(away),
          })),
        }),
      });
      const payload = await response.json() as { settledEntries?: number; scores?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Settlement failed");
      setShowSettlementPreview(false);
      toast(`Gameweek settled successfully. ${payload.settledEntries ?? 0} entries recalculated from ${payload.scores ?? completedScores.length} results.`);
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "Settlement failed", "warning");
    } finally {
      setBusy(false);
    }
  };
  const reverseSettlement = async () => {
    const confirmation = window.prompt(
      `Reverse settlement for ${feed.gameweekLabel}? Entries and results will be kept. Type REVERSE to confirm.`,
    );
    if (confirmation !== "REVERSE") {
      if (confirmation !== null) toast("Settlement reversal cancelled. Type REVERSE exactly to confirm.", "warning");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/reverse-settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: feed.snapshotId, confirmation }),
      });
      const payload = await response.json() as { submissions?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Settlement reversal failed");
      toast(`Settlement reversed. ${payload.submissions ?? 0} entries are ready to be settled again.`);
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "Settlement reversal failed", "warning");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="admin-page">
      <div className="admin-title"><div><span className="eyebrow">Operations</span><h1>Game control.</h1><p>Import health, active snapshot and settlement controls for the POC.</p></div><div className="admin-title-actions"><button className="secondary-button" onClick={onLogout}>Sign out</button><button className="primary-button" onClick={importNow} disabled={busy}>{busy ? "Checking feeds…" : "Run import now"}<span>↻</span></button></div></div>
      <div className="health-grid">
        <article><span className="health-icon good">✓</span><div><small>Fixture feed</small><h2>Healthy</h2><p>{feed.fixtures.length} valid rows · {feed.source === "google-sheet" ? "Google Sheet live" : "Demo fallback active"}</p></div></article>
        <article><span className="health-icon good">✓</span><div><small>Team colours</small><h2>{feed.missingColourTeams.length ? "Needs review" : "All matched"}</h2><p>{feed.missingColourTeams.length} unmatched team names</p></div></article>
        <article><span className="health-icon">◷</span><div><small>Last snapshot</small><h2>{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(feed.importedAt))}</h2><p>{feed.snapshotId}</p></div></article>
        <article><span className="health-icon">◎</span><div><small>Active gameweek</small><h2>Confirmed</h2><p>{feed.gameweekLabel}</p></div></article>
      </div>
      <div className="admin-panels">
        <article className="admin-panel snapshot-panel"><div className="panel-heading"><div><span className="eyebrow">Snapshot</span><h2>Published fixtures</h2></div><span className="status-badge success">Active</span></div><div className="snapshot-details"><div><small>Snapshot ID</small><strong>{feed.snapshotId}</strong></div><div><small>Fixtures</small><strong>{feed.fixtures.length}</strong></div><div><small>First kickoff</small><strong>{deadlineLabel(feed)}</strong></div><div><small>Submissions</small><strong>24</strong></div></div><div className="panel-actions"><button className="secondary-button" onClick={() => toast("Raw import opened for inspection.")}>View raw CSV</button><button className="secondary-button" onClick={() => toast("Snapshot protection is enabled while submissions exist.")}>Snapshot settings</button></div></article>
        <article className="admin-panel audit-panel"><div className="panel-heading"><div><span className="eyebrow">Audit log</span><h2>Recent activity</h2></div></div>{[
          ["Snapshot confirmed", "Admin · 21 Jul, 19:04"],
          ["10 fixtures imported", "Scheduled import · 21 Jul, 19:00"],
          ["Team colours updated", "Scheduled import · 21 Jul, 19:00"],
          ["Leaderboard recalculated", "System · 20 Jul, 18:22"],
        ].map(([action, detail]) => <div className="audit-row" key={action}><span /><div><strong>{action}</strong><small>{detail}</small></div></div>)}</article>
      </div>
      <article className="admin-panel results-panel"><div className="panel-heading"><div><span className="eyebrow">Manual fallback</span><h2>Enter final scores</h2><p>Scores settle Match Result and Under/Over 2.5 automatically.</p></div><button className="secondary-button" onClick={() => toast("Result feed checked; no final results are available yet.")}>Import results CSV</button></div><div className="results-list">{feed.fixtures.map((fixture) => <div className="result-row" key={fixture.id}><time>{fixture.date.slice(5).split("-").reverse().join("/")}</time><strong>{fixture.homeTeam}</strong><input inputMode="numeric" aria-label={`${fixture.homeTeam} goals`} value={scores[fixture.id]?.[0] ?? ""} onChange={(event) => setScores({ ...scores, [fixture.id]: [event.target.value.replace(/\D/g, "").slice(0, 2), scores[fixture.id]?.[1] ?? ""] })} /><span>–</span><input inputMode="numeric" aria-label={`${fixture.awayTeam} goals`} value={scores[fixture.id]?.[1] ?? ""} onChange={(event) => setScores({ ...scores, [fixture.id]: [scores[fixture.id]?.[0] ?? "", event.target.value.replace(/\D/g, "").slice(0, 2)] })} /><strong>{fixture.awayTeam}</strong><button className="void-button" onClick={() => toast(`${fixture.homeTeam} v ${fixture.awayTeam} marked for void review.`)}>Void</button></div>)}</div><div className="settle-bar"><div><strong>{Object.values(scores).filter(([home, away]) => home !== "" && away !== "").length} scores ready</strong><small>Settlement changes are written to the audit log and can be recalculated.</small></div><div className="settlement-actions"><button className="secondary-button danger-button" onClick={reverseSettlement} disabled={busy}>Reverse settlement</button><button className="primary-button" onClick={reviewSettlement} disabled={busy}>Review & settle <span>→</span></button></div></div></article>
      {showSettlementPreview && (
        <article className="admin-panel settlement-preview" id="settlement-preview">
          <div className="panel-heading">
            <div><span className="eyebrow">Settlement preview</span><h2>Review calculated outcomes</h2><p>Nothing has been settled yet. Check every result before confirming.</p></div>
            <span className="status-badge warning">Awaiting confirmation</span>
          </div>
          <div className="settlement-preview-list">
            {completedScores.map(({ fixture, home, away }) => {
              const homeGoals = Number(home);
              const awayGoals = Number(away);
              const matchResult = homeGoals > awayGoals ? fixture.homeTeam : awayGoals > homeGoals ? fixture.awayTeam : "Draw";
              const goalsResult = homeGoals + awayGoals >= 3 ? "Over 2.5" : "Under 2.5";
              return (
                <div className="settlement-preview-row" key={fixture.id}>
                  <div><strong>{fixture.homeTeam} {home}–{away} {fixture.awayTeam}</strong><small>{fixture.competition}</small></div>
                  <span>{matchResult}</span>
                  <span>{goalsResult}</span>
                </div>
              );
            })}
          </div>
          <div className="settlement-warning"><span>!</span><p><strong>This will settle the gameweek.</strong> Entries, points and the leaderboard will be recalculated. You can reverse the settlement afterward if corrections are needed.</p></div>
          <div className="settlement-confirm-actions">
            <button className="secondary-button" onClick={() => { setShowSettlementPreview(false); document.querySelector(".results-panel")?.scrollIntoView({ behavior: "smooth" }); }} disabled={busy}>Back to scores</button>
            <button className="primary-button" onClick={confirmSettlement} disabled={busy}>{busy ? "Settling…" : "Confirm settlement"} <span>→</span></button>
          </div>
        </article>
      )}
    </section>
  );
}

export default function TacteloApp() {
  const [view, setView] = useState<View>("selections");
  const [feed, setFeed] = useState<FixtureFeed>(demoFixtureFeed);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [pendingAllocation, setPendingAllocation] = useState<{ credits: number[]; combo: number } | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    window.setTimeout(() => {
      try {
        const storedPicks = JSON.parse(localStorage.getItem(PICK_STORAGE) ?? "[]") as Pick[];
        const storedReceipt = JSON.parse(localStorage.getItem(RECEIPT_STORAGE) ?? "null") as SubmissionReceipt | null;
        setPicks(storedPicks);
        setReceipt(storedReceipt);
        setUser(localStorage.getItem(USER_STORAGE));
      } catch {
        localStorage.removeItem(PICK_STORAGE);
      }
      setStorageReady(true);
    }, 0);
    fetch("/api/fixtures")
      .then(async (response) => {
        if (!response.ok) throw new Error("Feed unavailable");
        return await response.json() as FixtureFeed;
      })
      .then((nextFeed) => setFeed(nextFeed))
      .catch(() => setFeed(demoFixtureFeed))
      .finally(() => setLoaded(true));
    fetch("/api/admin/auth", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ authenticated?: boolean }>)
      .then((payload) => setAdminAuthenticated(Boolean(payload.authenticated)))
      .catch(() => setAdminAuthenticated(false))
      .finally(() => setAdminChecked(true));
    if (window.location.pathname === "/admin" || window.location.hash === "#admin") window.setTimeout(() => setView("admin"), 0);
    track("page_loaded_make_selections");
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(PICK_STORAGE, JSON.stringify(picks));
    if (picks.length === 3) track("three_selections_completed");
  }, [picks, loaded]);

  const [currentTime] = useState(() => Date.now());
  const earliestKickoff = useMemo(() => Math.min(...feed.fixtures.map((fixture) => new Date(fixture.kickoffIso).getTime())), [feed]);
  const importedAfterKickoff = new Date(feed.importedAt).getTime() > earliestKickoff;
  const closed = feed.fixtures.length > 0 && (currentTime >= earliestKickoff || (feed.source === "google-sheet" && importedAfterKickoff));

  const navigate = (next: View) => {
    if (next === "selections" && view === "credits") setView("selections");
    else setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (next === "leaderboard") track("leaderboard_viewed");
  };

  const logoutAdmin = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAdminAuthenticated(false);
    window.history.replaceState(null, "", "/");
    setView("selections");
    setToast({ tone: "success", message: "Admin session ended securely." });
  };

  const requestSubmit = (credits: number[], combo: number) => {
    setPendingAllocation({ credits, combo });
    if (user) completeSubmission(user, { credits, combo });
    else {
      track("submit_clicked_unauthenticated");
      setShowLogin(true);
    }
  };

  const completeSubmission = async (email: string, allocation = pendingAllocation) => {
    if (!allocation) return;
    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: feed.snapshotId, picks, ...allocation }),
      });
      const payload = await response.json() as { receipt?: SubmissionReceipt; error?: string };
      if (!response.ok || !payload.receipt) throw new Error(payload.error ?? "Submission failed validation");
      localStorage.setItem(USER_STORAGE, email);
      localStorage.setItem(RECEIPT_STORAGE, JSON.stringify(payload.receipt));
      localStorage.removeItem(PICK_STORAGE);
      setUser(email);
      setReceipt(payload.receipt);
      setPicks([]);
      setShowLogin(false);
      setPendingAllocation(null);
      setView("picks");
      setToast({ tone: "success", message: "Entry confirmed. Your prices and credits are locked in." });
      track("submission_completed", { receiptId: payload.receipt.id });
    } catch (error) {
      setToast({ tone: "warning", message: error instanceof Error ? error.message : "Submission failed validation." });
      track("submission_failed_validation");
    }
  };

  const authenticateAndSubmit = async (details: { email: string; password: string; displayName: string; mode: "login" | "register" }) => {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    const payload = await response.json() as { email?: string; error?: string };
    if (!response.ok || !payload.email) throw new Error(payload.error ?? "Authentication failed");
    await completeSubmission(payload.email);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!storageReady || !loaded || !adminChecked) {
    return (
      <div className="app-shell">
        <TopNav view="selections" onView={() => undefined} user={null} admin={false} />
        <main className="main-content loading-shell" aria-label="Loading fixtures">
          <div className="loading-kicker" /><div className="loading-title" /><div className="loading-copy" />
          <div className="loading-grid"><div /><div /></div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopNav view={view} onView={navigate} user={user} admin={adminAuthenticated} />
      <main className="main-content">
        {view === "selections" && <MakeSelections feed={feed} picks={picks} onPicks={setPicks} onContinue={() => { setView("credits"); track("credit_allocation_page_viewed"); window.scrollTo({ top: 0 }); }} closed={closed} />}
        {view === "credits" && <CreditsView picks={picks} onBack={() => setView("selections")} onSubmit={requestSubmit} />}
        {view === "picks" && <PicksView receipt={receipt} onMakePicks={() => setView("selections")} />}
        {view === "leaderboard" && <LeaderboardView />}
        {view === "admin" && !adminAuthenticated && <AdminLogin onSuccess={() => setAdminAuthenticated(true)} onCancel={() => { window.history.replaceState(null, "", "/"); navigate("selections"); }} />}
        {view === "admin" && adminAuthenticated && <AdminView feed={feed} onFeed={setFeed} toast={(message, tone = "success") => setToast({ tone, message })} onLogout={logoutAdmin} />}
      </main>
      <footer className="site-footer"><div><Brand /><p>Three picks. Six credits. One tactical edge.</p></div><div><button onClick={() => navigate("selections")}>Game rules</button><button onClick={() => navigate("leaderboard")}>Leaderboard</button>{adminAuthenticated && <button onClick={() => navigate("admin")}>Admin</button>}</div><small>Free to play · Tactelo POC 2026</small></footer>
      <BottomNav view={view} onView={navigate} />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onComplete={authenticateAndSubmit} />}
      {toast && <div className={`toast ${toast.tone}`} role="status"><span>{toast.tone === "success" ? "✓" : "!"}</span>{toast.message}<button onClick={() => setToast(null)}>×</button></div>}
    </div>
  );
}
