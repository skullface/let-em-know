import { InjuryEntry } from './types';
import { getCached, setCached, CacheKeys, CACHE_TTL } from '../cache';
import { format } from 'date-fns';

const CBS_INJURIES_URL = 'https://www.cbssports.com/nba/injuries/';

// CBS team abbreviation (from URL slug) -> NBA stats.nba.com team ID
const CBS_ABBR_TO_TEAM_ID: Record<string, number> = {
  ATL: 1610612737,
  BOS: 1610612738,
  CLE: 1610612739,
  NOP: 1610612740,
  NO: 1610612740,
  CHI: 1610612741,
  DAL: 1610612742,
  DEN: 1610612743,
  GSW: 1610612744,
  GS: 1610612744,
  HOU: 1610612745,
  LAC: 1610612746,
  LAL: 1610612747,
  MIA: 1610612748,
  MIL: 1610612749,
  MIN: 1610612750,
  BKN: 1610612751,
  NYK: 1610612752,
  NY: 1610612752,
  ORL: 1610612753,
  IND: 1610612754,
  PHI: 1610612755,
  PHX: 1610612756,
  PHO: 1610612756,
  POR: 1610612757,
  SAC: 1610612758,
  SAS: 1610612759,
  OKC: 1610612760,
  TOR: 1610612761,
  UTA: 1610612762,
  MEM: 1610612763,
  WAS: 1610612764,
  DET: 1610612765,
  CHA: 1610612766,
};

function mapStatus(text: string): InjuryEntry['status'] {
  const t = text.toLowerCase();
  if (t.includes('out for the season') || t.includes('out indefinitely')) return 'Out';
  if (t.includes('out')) return 'Out';
  if (t.includes('doubtful')) return 'Doubtful';
  if (t.includes('game time decision') || t.includes('questionable') || t.includes('day to day')) return 'Questionable';
  if (t.includes('probable')) return 'Probable';
  if (t.includes('available') || t.includes('active')) return 'Available';
  return 'Questionable';
}

const LEAGUE_INJURIES_CACHE_KEY = 'nba:injuries:cbs';
const LEAGUE_INJURIES_TTL = 30 * 60; // 30 min

export async function fetchInjuryReport(
  teamId: number,
  _date: Date
): Promise<InjuryEntry[]> {
  const dateStr = format(_date, 'yyyy-MM-dd');
  const cacheKey = CacheKeys.injuries(teamId, dateStr);

  const cached = await getCached<InjuryEntry[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  if (process.env.NODE_ENV === 'development') {
    console.log('[injuries] cache miss teamId=%s, fetching CBS', teamId);
  }
  const allByTeam = await fetchCbsInjuries();
  const injuries = allByTeam.get(teamId) ?? [];
  if (injuries.length > 0) {
    await setCached(cacheKey, injuries, CACHE_TTL.INJURIES_NON_GAME_DAY);
  }
  return injuries;
}

/** Fetch CBS injuries page and return a map of teamId -> InjuryEntry[] */
async function fetchCbsInjuries(): Promise<Map<number, InjuryEntry[]>> {
  const cached = await getCached<Record<string, InjuryEntry[]>>(LEAGUE_INJURIES_CACHE_KEY);
  if (cached && typeof cached === 'object' && Object.keys(cached).length > 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[injuries] using cached CBS data (%s teams)', Object.keys(cached).length);
    }
    return new Map(
      Object.entries(cached).map(([k, v]) => [Number(k), v])
    );
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[injuries] fetching CBS URL:', CBS_INJURIES_URL);
  }
  let html: string;
  try {
    const res = await fetch(CBS_INJURIES_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      console.warn('[injuries] CBS fetch failed:', res.status, res.statusText);
      return new Map();
    }
    html = await res.text();
    if (process.env.NODE_ENV === 'development') {
      const hasTeams = html.includes('/nba/teams/');
      console.log('[injuries] CBS response length=%s hasTeams=%s', html.length, hasTeams);
    }
  } catch (e) {
    console.warn('[injuries] CBS fetch error:', e);
    return new Map();
  }

  const byTeam = parseCbsInjuriesHtml(html);
  if (process.env.NODE_ENV === 'development') {
    const total = [...byTeam.values()].reduce((s, arr) => s + arr.length, 0);
    console.log('[injuries] CBS parse: %s teams, %s total entries', byTeam.size, total);
  }
  if (byTeam.size > 0) {
    const asPlain: Record<string, InjuryEntry[]> = {};
    byTeam.forEach((entries, teamId) => {
      asPlain[String(teamId)] = entries;
    });
    await setCached(LEAGUE_INJURIES_CACHE_KEY, asPlain, LEAGUE_INJURIES_TTL);
  }
  return byTeam;
}

function parseCbsInjuriesHtml(html: string): Map<number, InjuryEntry[]> {
  const byTeam = new Map<number, InjuryEntry[]>();

  // Primary: regex over raw HTML. Find each team's block (content after the team link, until next team).
  const teamSlugRegex = /\/nba\/teams\/([A-Za-z]{2,3})\/[^"'\s]*/gi;
  const teamMatches = [...html.matchAll(teamSlugRegex)];
  const abbrToLastIndex = new Map<string, number>();
  for (let i = 0; i < teamMatches.length; i++) {
    const abbr = teamMatches[i][1].toUpperCase();
    abbrToLastIndex.set(abbr, i);
  }
  for (const [abbr, lastIdx] of abbrToLastIndex) {
    const teamId = CBS_ABBR_TO_TEAM_ID[abbr];
    if (teamId == null) continue;
    const start = teamMatches[lastIdx].index! + teamMatches[lastIdx][0].length;
    const nextIdx = lastIdx + 1;
    const end = teamMatches[nextIdx]?.index ?? html.length;
    const block = html.slice(start, Math.min(end, start + 20000));
    const entries = parseInjuryBlock(block);
    if (entries.length) byTeam.set(teamId, entries);
  }

  if (byTeam.size > 0) return byTeam;

  // Cheerio path when HTML has real table structure
  try {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const teamLinkRegex = /\/nba\/teams\/([A-Za-z]{2,3})\//i;
    $('a[href*="/nba/teams/"]').each((_i: number, el: unknown) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const match = href.match(teamLinkRegex);
      if (!match) return;
      const abbr = match[1].toUpperCase();
      const teamId = CBS_ABBR_TO_TEAM_ID[abbr];
      if (teamId == null) return;
      const $section = $el.closest('section, [class*="TeamSection"], [class*="injury"], div');
      const $table = $section.length ? $section.find('table').first() : $el.siblings('table').first();
      const $rows = $table.find('tbody tr, tr');
      if ($rows.length === 0) return;
      const list: InjuryEntry[] = [];
      $rows.each((_ri: number, tr: unknown) => {
        const $tr = $(tr);
        const cells = $tr.find('td');
        if (cells.length < 4) return;
        const firstCell = cells.first();
        const playerName = (firstCell.find('a').last().text() || firstCell.text()).trim();
        if (!playerName || playerName === 'Player') return;
        list.push({
          playerName,
          position: $(cells[1]).text().trim(),
          status: mapStatus($(cells[4]).text().trim()),
          reason: $(cells[3]).text().trim() || $(cells[4]).text().trim(),
        });
      });
      if (list.length) byTeam.set(teamId, list);
    });
  } catch {
    // ignore
  }

  return byTeam;
}

/** Parse one team's block: HTML table rows or pipe-separated lines */
function parseInjuryBlock(block: string): InjuryEntry[] {
  const entries: InjuryEntry[] = [];

  // HTML: <tr>...<td>...<a>Short</a><a>Full Name</a>...</td><td>Pos</td><td>Date</td><td>Injury</td><td>Status</td>...
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(block)) !== null) {
    const rowHtml = rowMatch[1];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tdContents: string[] = [];
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      tdContents.push(tdMatch[1]);
    }
    if (tdContents.length < 5) continue;
    const firstCellHtml = tdContents[0];
    const linksInFirst = [...firstCellHtml.matchAll(/<a[^>]*>([^<]+)<\/a>/g)];
    const playerName = (linksInFirst.length >= 2
      ? linksInFirst[linksInFirst.length - 1][1]
      : linksInFirst[0]?.[1] || stripTags(firstCellHtml)).trim();
    if (!playerName || playerName === 'Player') continue;
    entries.push({
      playerName: playerName.replace(/\s+/g, ' '),
      position: stripTags(tdContents[1]),
      status: mapStatus(stripTags(tdContents[4])),
      reason: stripTags(tdContents[3]) || stripTags(tdContents[4]),
    });
  }

  if (entries.length > 0) return entries;

  // Pipe-separated (e.g. from some proxies or text version)
  for (const line of block.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('|')) continue;
    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length < 5) continue;
    const playerName = extractPlayerName(parts[0]);
    if (!playerName || playerName === 'Player') continue;
    entries.push({
      playerName,
      position: parts[1] || '',
      status: mapStatus(parts[4] || ''),
      reason: parts[3] || parts[4] || '',
    });
  }
  return entries;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractPlayerName(cell: string): string {
  const stripped = cell.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
  const parts = stripped.split(/\]\s*\[?/);
  const lastPart = parts[parts.length - 1]?.trim() || stripped;
  return lastPart.replace(/^\[/, '').trim() || stripped;
}
