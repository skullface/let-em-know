import { InjuryEntry } from './types';
import { getCached, setCached, CacheKeys, CACHE_TTL } from '../cache';
import { format } from 'date-fns';

const NBA_INJURY_PAGE_URL =
  'https://official.nba.com/nba-injury-report-2025-26-season/';
const NBA_PDF_BASE = 'https://ak-static.cms.nba.com/referee/injury/';

// NBA team name (from PDF) -> NBA stats.nba.com team ID
const NBA_TEAM_NAME_TO_ID: Record<string, number> = {
  'Atlanta Hawks': 1610612737,
  'Boston Celtics': 1610612738,
  'Brooklyn Nets': 1610612751,
  'Charlotte Hornets': 1610612766,
  'Chicago Bulls': 1610612741,
  'Cleveland Cavaliers': 1610612739,
  'Dallas Mavericks': 1610612742,
  'Denver Nuggets': 1610612743,
  'Detroit Pistons': 1610612765,
  'Golden State Warriors': 1610612744,
  'Houston Rockets': 1610612745,
  'Indiana Pacers': 1610612754,
  'LA Clippers': 1610612746,
  'Los Angeles Clippers': 1610612746,
  'Los Angeles Lakers': 1610612747,
  'Memphis Grizzlies': 1610612763,
  'Miami Heat': 1610612748,
  'Milwaukee Bucks': 1610612749,
  'Minnesota Timberwolves': 1610612750,
  'New Orleans Pelicans': 1610612740,
  'New York Knicks': 1610612752,
  'Oklahoma City Thunder': 1610612760,
  'Orlando Magic': 1610612753,
  'Philadelphia 76ers': 1610612755,
  'Phoenix Suns': 1610612756,
  'Portland Trail Blazers': 1610612757,
  'Sacramento Kings': 1610612758,
  'San Antonio Spurs': 1610612759,
  'Toronto Raptors': 1610612761,
  'Utah Jazz': 1610612762,
  'Washington Wizards': 1610612764,
};

const STATUSES: InjuryEntry['status'][] = [
  'Out',
  'Doubtful',
  'Questionable',
  'Probable',
  'Available',
];

function mapStatus(text: string): InjuryEntry['status'] {
  const t = text.trim();
  for (const s of STATUSES) {
    if (t === s || t.startsWith(s + ' ')) return s;
  }
  const lower = t.toLowerCase();
  if (lower.includes('out')) return 'Out';
  if (lower.includes('doubtful')) return 'Doubtful';
  if (lower.includes('questionable') || lower.includes('game time decision'))
    return 'Questionable';
  if (lower.includes('probable')) return 'Probable';
  if (lower.includes('available') || lower.includes('active')) return 'Available';
  return 'Questionable';
}

/** TTL in seconds: after 1pm game day = 10 min, before 1pm game day = 30 min, non-game day = 6h */
export function getInjuryReportTtl(
  reportDate: Date,
  isGameDay: boolean
): number {
  if (!isGameDay) return CACHE_TTL.INJURIES_NON_GAME_DAY;
  const etStr = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
  });
  const match = etStr.match(/(\d+):(\d+)/);
  const hour = match ? parseInt(match[1], 10) : 12;
  const isPM = /PM/i.test(etStr);
  const hour24 = isPM && hour !== 12 ? hour + 12 : !isPM && hour === 12 ? 0 : hour;
  return hour24 >= 13
    ? CACHE_TTL.INJURIES_GAME_DAY_AFTER_1PM
    : CACHE_TTL.INJURIES_GAME_DAY;
}

const LEAGUE_PDF_CACHE_PREFIX = 'nba:injuries:pdf:';

export async function fetchInjuryReport(
  teamId: number,
  reportDate: Date,
  options?: { isGameDay?: boolean }
): Promise<InjuryEntry[]> {
  const dateStr = format(reportDate, 'yyyy-MM-dd');
  const cacheKey = CacheKeys.injuries(teamId, dateStr);

  const isGameDay = options?.isGameDay ?? false;
  const ttl = getInjuryReportTtl(reportDate, isGameDay);
  const leagueKey = `${LEAGUE_PDF_CACHE_PREFIX}${dateStr}`;

  const cached = await getCached<InjuryEntry[]>(cacheKey);
  if (cached !== null) return cached;

  const byTeam = await fetchNbaPdfInjuries(reportDate, leagueKey, ttl);
  const injuries = byTeam.get(teamId) ?? [];
  await setCached(cacheKey, injuries, ttl);
  return injuries;
}

/** Fetch NBA injury page, get latest PDF URL for date, parse and return by teamId */
async function fetchNbaPdfInjuries(
  reportDate: Date,
  leagueCacheKey: string,
  ttlSeconds: number
): Promise<Map<number, InjuryEntry[]>> {
  type Cached = { byTeam: Record<string, InjuryEntry[]> };
  const cached = await getCached<Cached>(leagueCacheKey);
  if (cached && typeof cached === 'object' && Object.keys(cached.byTeam).length > 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[injuries] using cached NBA PDF data');
    }
    return new Map(
      Object.entries(cached.byTeam).map(([k, v]) => [Number(k), v])
    );
  }

  const pdfUrl = await getLatestPdfUrlForDate(reportDate);
  if (!pdfUrl) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[injuries] no PDF URL found for date', format(reportDate, 'yyyy-MM-dd'));
    }
    return new Map();
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[injuries] fetching NBA PDF:', pdfUrl);
  }

  let byTeam: Map<number, InjuryEntry[]>;
  try {
    const res = await fetch(pdfUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (!res.ok) {
      console.warn('[injuries] PDF fetch failed:', res.status, pdfUrl);
      return new Map();
    }
    const buffer = await res.arrayBuffer();
    const { pdf } = await import('pdf-parse');
    const result = await pdf(Buffer.from(buffer));
    const text = typeof (result as { text?: string })?.text === 'string' ? (result as { text: string }).text : '';
    byTeam = parseNbaPdfText(text);
  } catch (e) {
    console.warn('[injuries] PDF fetch/parse error:', e);
    return new Map();
  }

  const asPlain: Record<string, InjuryEntry[]> = {};
  byTeam.forEach((entries, id) => {
    asPlain[String(id)] = entries;
  });
  await setCached(leagueCacheKey, { byTeam: asPlain }, ttlSeconds);

  if (process.env.NODE_ENV === 'development') {
    const total = [...byTeam.values()].reduce((s, arr) => s + arr.length, 0);
    console.log('[injuries] NBA PDF parse: %s teams, %s total entries', byTeam.size, total);
  }
  return byTeam;
}

/** Scrape NBA injury page for PDF links for the given date; return the latest PDF URL. */
async function getLatestPdfUrlForDate(reportDate: Date): Promise<string | null> {
  const dateStr = format(reportDate, 'yyyy-MM-dd');

  try {
    const res = await fetch(NBA_INJURY_PAGE_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const matches = [...html.matchAll(/Injury-Report_(\d{4}-\d{2}-\d{2})_(\d{2})_(\d{2})(AM|PM)\.pdf/gi)];
    const forDate = matches.filter((m) => m[1] === dateStr);
    if (forDate.length === 0) {
      return buildPdfUrlForDate(reportDate);
    }
    forDate.sort((a, b) => {
      const [ah, am, ap] = [parseInt(a[2], 10), parseInt(a[3], 10), a[4].toUpperCase()];
      const [bh, bm, bp] = [parseInt(b[2], 10), parseInt(b[3], 10), b[4].toUpperCase()];
      const aMin = (ap === 'PM' && ah !== 12 ? ah + 12 : ap === 'AM' && ah === 12 ? 0 : ah) * 60 + am;
      const bMin = (bp === 'PM' && bh !== 12 ? bh + 12 : bp === 'AM' && bh === 12 ? 0 : bh) * 60 + bm;
      return aMin - bMin;
    });
    const last = forDate[forDate.length - 1];
    const filename = `Injury-Report_${last[1]}_${last[2]}_${last[3]}${last[4]}.pdf`;
    return `${NBA_PDF_BASE}${filename}`;
  } catch (e) {
    console.warn('[injuries] failed to scrape NBA page for PDF links:', e);
    return buildPdfUrlForDate(reportDate);
  }
}

/** Build PDF URL for the newest 15-min slot up to now (ET). Fallback when scrape fails. */
function buildPdfUrlForDate(reportDate: Date): string | null {
  const etStr = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
  });
  const match = etStr.match(/(\d+):(\d+):?\d*\s*(AM|PM)/i);
  if (!match) return null;
  let hour24 = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  if (match[3].toUpperCase() === 'PM' && hour24 !== 12) hour24 += 12;
  if (match[3].toUpperCase() === 'AM' && hour24 === 12) hour24 = 0;
  const minRounded = Math.floor(min / 15) * 15;
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const dateStr = format(reportDate, 'yyyy-MM-dd');
  const filename = `Injury-Report_${dateStr}_${hour12.toString().padStart(2, '0')}_${minRounded.toString().padStart(2, '0')}${ampm}.pdf`;
  return `${NBA_PDF_BASE}${filename}`;
}

/** Parse PDF text into teamId -> InjuryEntry[]. */
function parseNbaPdfText(text: string): Map<number, InjuryEntry[]> {
  const byTeam = new Map<number, InjuryEntry[]>();
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  let currentTeamId: number | null = null;
  let pendingReason: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (/^Injury Report:/.test(line) || /^Page \d+ of \d+/.test(line)) continue;
    if (/^Game Date\s+Game Time\s+Matchup/.test(line)) continue;
    if (line === 'NOT YET SUBMITTED') {
      pendingReason = [];
      continue;
    }

    const teamId = NBA_TEAM_NAME_TO_ID[line];
    if (teamId != null) {
      currentTeamId = teamId;
      pendingReason = [];
      continue;
    }

    if (currentTeamId == null) continue;

    const statusMatch = line.match(
      new RegExp(
        `^(.+?)\\s+(${STATUSES.join('|')})(?:\\s+(.*))?$`,
        'i'
      )
    );
    if (statusMatch) {
      const [, namePart, status, reasonPart] = statusMatch;
      const playerName = namePart?.trim().replace(/\s+/g, ' ') ?? '';
      if (!playerName || playerName.length < 2) continue;
      let reason = reasonPart?.trim() ?? '';
      if (pendingReason.length) {
        reason = (reason + ' ' + pendingReason.join(' ')).trim();
        pendingReason = [];
      }
      const entry: InjuryEntry = {
        playerName,
        position: '',
        status: mapStatus(status),
        reason,
      };
      const list = byTeam.get(currentTeamId) ?? [];
      list.push(entry);
      byTeam.set(currentTeamId, list);
      continue;
    }

    if (/^[A-Za-z\d\s\/\-',.;()]+$/i.test(line) && !/^\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s+\(ET\)/.test(line)) {
      const list = byTeam.get(currentTeamId);
      if (list?.length) {
        const last = list[list.length - 1];
        last.reason = (last.reason + ' ' + line).trim();
      } else {
        pendingReason.push(line);
      }
    }
  }

  return byTeam;
}
