import type { Fixture, FixtureFeed } from "./types";

const colours: Record<string, [string, string]> = {
  Arsenal: ["#D0021B", "#F4F7FA"],
  "Aston Villa": ["#670E36", "#95BFE5"],
  Bournemouth: ["#DA291C", "#111111"],
  Brentford: ["#E30613", "#F4F7FA"],
  Brighton: ["#0057B8", "#F4F7FA"],
  Burnley: ["#6C1D45", "#99D6EA"],
  Chelsea: ["#034694", "#F4F7FA"],
  "Crystal Palace": ["#1B458F", "#C4122E"],
  Everton: ["#003399", "#F4F7FA"],
  Fulham: ["#F4F7FA", "#CC0000"],
  Leeds: ["#FFCD00", "#1D428A"],
  Liverpool: ["#C8102E", "#00B2A9"],
  "Man City": ["#6CABDD", "#F4F7FA"],
  "Man United": ["#DA291C", "#FBE122"],
  Newcastle: ["#F4F7FA", "#111111"],
  "Nott'm Forest": ["#DD0000", "#F4F7FA"],
  Sunderland: ["#EB172B", "#F4F7FA"],
  Tottenham: ["#F4F7FA", "#132257"],
  "West Ham": ["#7A263A", "#1BB1E7"],
  Wolves: ["#FDB913", "#231F20"],
};

function teamColours(team: string) {
  const value = colours[team] ?? ["#566371", "#293746"];
  return { primary: value[0], secondary: value[1] };
}

const rawFixtures: Array<
  [string, string, string, string, [number, number, number, number, number]]
> = [
  ["2026-08-15", "12:30", "Liverpool", "Bournemouth", [1.42, 4.8, 7.2, 1.64, 2.24]],
  ["2026-08-15", "15:00", "Aston Villa", "Newcastle", [2.55, 3.5, 2.68, 1.78, 2.04]],
  ["2026-08-15", "15:00", "Brighton", "Fulham", [2.05, 3.6, 3.55, 1.84, 1.98]],
  ["2026-08-15", "15:00", "Sunderland", "West Ham", [2.74, 3.2, 2.66, 2.08, 1.75]],
  ["2026-08-15", "17:30", "Wolves", "Man City", [7.6, 4.75, 1.4, 1.58, 2.38]],
  ["2026-08-16", "14:00", "Chelsea", "Crystal Palace", [1.68, 4.1, 4.8, 1.72, 2.14]],
  ["2026-08-16", "16:30", "Man United", "Arsenal", [3.05, 3.45, 2.32, 1.9, 1.9]],
  ["2026-08-17", "14:00", "Nott'm Forest", "Brentford", [2.18, 3.35, 3.35, 1.96, 1.86]],
  ["2026-08-17", "16:30", "Leeds", "Everton", [2.4, 3.25, 3.05, 2.05, 1.77]],
  ["2026-08-17", "20:00", "Tottenham", "Burnley", [1.47, 4.6, 6.6, 1.61, 2.32]],
];

export const demoFixtures: Fixture[] = rawFixtures.map(
  ([date, time, homeTeam, awayTeam, prices], index) => ({
    id: `gw1-${index + 1}`,
    competition: "Premier League",
    date,
    time,
    kickoffIso: `${date}T${time}:00+01:00`,
    homeTeam,
    awayTeam,
    homeColours: teamColours(homeTeam),
    awayColours: teamColours(awayTeam),
    prices: {
      home: prices[0],
      draw: prices[1],
      away: prices[2],
      over: prices[3],
      under: prices[4],
    },
  }),
);

export const demoFixtureFeed: FixtureFeed = {
  fixtures: demoFixtures,
  snapshotId: "snap-2026-gw01-demo",
  gameweekLabel: "Gameweek 1 · 15–17 August",
  importedAt: "2026-07-21T19:00:00.000Z",
  source: "demo-snapshot",
  missingColourTeams: [],
};

export const leaderboardRows = [
  { name: "Alex Morgan", points: 48.72, winners: 7, average: 2.31, trend: 2 },
  { name: "Sam Taylor", points: 46.15, winners: 6, average: 2.58, trend: 0 },
  { name: "Jamie Patel", points: 44.8, winners: 7, average: 2.12, trend: 1 },
  { name: "Charlie Evans", points: 41.64, winners: 5, average: 2.71, trend: -2 },
  { name: "Jordan Lee", points: 39.92, winners: 6, average: 2.18, trend: 3 },
  { name: "Morgan Smith", points: 38.45, winners: 5, average: 2.49, trend: -1 },
  { name: "Robin Clarke", points: 36.12, winners: 5, average: 2.24, trend: 0 },
  { name: "Taylor Jones", points: 33.78, winners: 4, average: 2.64, trend: 1 },
];
