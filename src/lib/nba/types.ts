export interface TeamInfo {
  teamId: number;
  teamName: string;
  teamCity: string;
  teamTricode: string;
  teamSlug: string;
  wins?: number;
  losses?: number;
  score?: number;
  seed?: number;
}

export interface Broadcast {
  broadcasterScope: 'natl' | 'home' | 'away';
  broadcasterMedia: 'tv' | 'radio' | 'ott';
  broadcasterId: number;
  broadcasterDisplay: string;
  broadcasterAbbreviation: string;
  broadcasterDescription: string;
  broadcasterVideoLink?: string;
}

export interface Game {
  gameId: string;
  gameCode: string;
  gameStatus: number;
  gameStatusText: string;
  gameDateEst: string;
  gameTimeEst: string;
  gameDateTimeEst: string;
  gameDateUTC: string;
  gameTimeUTC: string;
  gameDateTimeUTC: string;
  arenaName: string;
  arenaCity: string;
  arenaState: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  broadcasters?: {
    nationalBroadcasters?: Broadcast[];
    nationalRadioBroadcasters?: Broadcast[];
    nationalOttBroadcasters?: Broadcast[];
    homeTvBroadcasters?: Broadcast[];
    awayTvBroadcasters?: Broadcast[];
  };
}

export interface StandingsEntry {
  teamId: number;
  teamName: string;
  teamCity: string;
  teamTricode: string;
  wins: number;
  losses: number;
  winPct: number;
  conferenceRank: number;
  divisionRank: number;
  leagueRank: number;
  conference: 'East' | 'West';
  division: string;
}

export interface InjuryEntry {
  playerName: string;
  position: string;
  status: 'Out' | 'Questionable' | 'Probable' | 'Available' | 'Doubtful';
  reason: string;
  dateReported?: string;
  jerseyNumber?: string;
}

export interface Player {
  personId: number;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber?: string;
}

export interface GameSummary {
  gameId: string;
  gameDate: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  homeScore?: number;
  awayScore?: number;
  status: string;
  /** Win/Loss for the "focus" team (e.g. Cavs or opponent) when showing recent games */
  result?: 'W' | 'L';
}

/** One player's stat line for top-performers display */
export interface BoxScorePlayerStat {
  personId: number;
  playerName: string;
  teamId: number;
  points: number;
  rebounds: number;
  assists: number;
}

/** Top 3 players in one stat category for one team */
export interface TopThreeStat {
  statLabel: 'PTS' | 'REB' | 'AST';
  players: Array<{ playerName: string; personId: number; value: number; jerseyNumber?: string }>;
}

/** Top performers for the most recent H2H game (from box score) */
export interface LastH2HBoxScore {
  gameId: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTopPts: TopThreeStat['players'];
  homeTopReb: TopThreeStat['players'];
  homeTopAst: TopThreeStat['players'];
  awayTopPts: TopThreeStat['players'];
  awayTopReb: TopThreeStat['players'];
  awayTopAst: TopThreeStat['players'];
  /** Person ID of the single top performer in the entire game for each stat (for highlight) */
  gameHighPtsPersonId: number | null;
  gameHighRebPersonId: number | null;
  gameHighAstPersonId: number | null;
}

export interface NextGameResponse {
  game: {
    gameId: string;
    dateTime: string; // ISO 8601
    opponent: TeamInfo;
    location: string;
    isHome: boolean;
    broadcasts: Broadcast[];
  };
  standings: {
    cavaliers: StandingsEntry;
    opponent: StandingsEntry;
  };
  injuries: {
    cavaliers: InjuryEntry[];
    opponent: InjuryEntry[];
  };
  projectedLineups: {
    cavaliers: Player[];
    opponent: Player[];
  };
  cavaliersRecentGames: GameSummary[]; // last 3
  opponentRecentGames: GameSummary[]; // last 3
  headToHead: GameSummary[]; // this season's H2H (0–4 games)
  /** Top performers for the most recent H2H game only (from box score) */
  lastHeadToHeadBoxScore: LastH2HBoxScore | null;
  lastUpdated: string;
}
