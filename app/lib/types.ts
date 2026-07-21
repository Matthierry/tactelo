export type MarketType = "result" | "goals";

export type SelectionOutcome =
  | "home"
  | "draw"
  | "away"
  | "over"
  | "under";

export type TeamColours = {
  primary: string;
  secondary: string;
};

export type Fixture = {
  id: string;
  competition: string;
  date: string;
  time: string;
  kickoffIso: string;
  homeTeam: string;
  awayTeam: string;
  homeColours: TeamColours;
  awayColours: TeamColours;
  prices: Record<SelectionOutcome, number>;
};

export type Pick = {
  fixtureId: string;
  market: MarketType;
  outcome: SelectionOutcome;
  label: string;
  price: number;
  fixtureLabel: string;
};

export type SubmissionReceipt = {
  id: string;
  snapshotId: string;
  submittedAt: string;
  email: string;
  credits: number[];
  comboCredit: number;
  comboPrice: number;
  picks: Pick[];
};

export type FixtureFeed = {
  fixtures: Fixture[];
  snapshotId: string;
  gameweekLabel: string;
  importedAt: string;
  source: "google-sheet" | "demo-snapshot";
  missingColourTeams: string[];
};
