import type { Fixture, FixtureFeed, TeamColours } from "./types";

export const FIXTURE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTzqbY0L2XnGRgEQLgpwPRNYhoZEO2CGrYW7sjFDAGmfQCXNNwQbRq_Ee4MX0ySonjfCauy7ZHOgk6p/pub?gid=0&single=true&output=csv";

export const COLOUR_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTzqbY0L2XnGRgEQLgpwPRNYhoZEO2CGrYW7sjFDAGmfQCXNNwQbRq_Ee4MX0ySonjfCauy7ZHOgk6p/pub?gid=2066031773&single=true&output=csv";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(rawDate: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  const parts = rawDate.split(/[\/-]/);
  if (parts.length !== 3) return rawDate;
  const [day, month, year] = parts;
  return `${year.length === 2 ? `20${year}` : year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function safeColour(value: string, fallback: string) {
  const colour = value.trim();
  return /^#[0-9a-f]{6}$/i.test(colour) ? colour : fallback;
}

export function buildFeed(fixtureCsv: string, colourCsv: string): FixtureFeed {
  const colourRows = parseCsv(colourCsv);
  const colourMap = new Map<string, TeamColours>();
  colourRows.slice(1).forEach((row) => {
    if (!row[0]) return;
    colourMap.set(normalise(row[0]), {
      primary: safeColour(row[1] ?? "", "#566371"),
      secondary: safeColour(row[2] ?? "", "#293746"),
    });
  });

  const rows = parseCsv(fixtureCsv);
  if (rows.length < 2) throw new Error("Fixture CSV contains no rows");
  const headers = rows[0].map(normalise);
  const column = (name: string) => headers.indexOf(normalise(name));
  const get = (row: string[], name: string) => row[column(name)] ?? "";
  const missing = new Set<string>();

  const fixtures = rows.slice(1).flatMap((row, index) => {
    const homeTeam = get(row, "HomeTeam");
    const awayTeam = get(row, "AwayTeam");
    const date = isoDate(get(row, "Date"));
    const time = get(row, "Time").slice(0, 5);
    if (!homeTeam || !awayTeam || !date || !time) return [];
    const homeColours = colourMap.get(normalise(homeTeam));
    const awayColours = colourMap.get(normalise(awayTeam));
    if (!homeColours) missing.add(homeTeam);
    if (!awayColours) missing.add(awayTeam);
    const fallback = { primary: "#566371", secondary: "#293746" };
    const fixture: Fixture = {
      id: `${date}-${normalise(homeTeam)}-${index}`,
      competition: get(row, "Div") || "Premier League",
      date,
      time,
      kickoffIso: `${date}T${time}:00+01:00`,
      homeTeam,
      awayTeam,
      homeColours: homeColours ?? fallback,
      awayColours: awayColours ?? fallback,
      prices: {
        home: toNumber(get(row, "AvgH")),
        draw: toNumber(get(row, "AvgD")),
        away: toNumber(get(row, "AvgA")),
        over: toNumber(get(row, "Avg>2.5")),
        under: toNumber(get(row, "Avg<2.5")),
      },
    };
    return Object.values(fixture.prices).every((price) => price > 1)
      ? [fixture]
      : [];
  });

  if (!fixtures.length) throw new Error("No valid fixture rows were found");
  const hashSource = `${fixtureCsv.length}-${fixtureCsv.slice(0, 100)}`;
  let hash = 0;
  for (let i = 0; i < hashSource.length; i += 1) {
    hash = (hash * 31 + hashSource.charCodeAt(i)) >>> 0;
  }
  const first = fixtures[0];
  const last = fixtures[fixtures.length - 1];
  const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

  return {
    fixtures,
    snapshotId: `sheet-${hash.toString(16)}`,
    gameweekLabel: `Current gameweek · ${dateFormatter.format(new Date(first.date))}–${dateFormatter.format(new Date(last.date))}`,
    importedAt: new Date().toISOString(),
    source: "google-sheet",
    missingColourTeams: [...missing],
  };
}
