"use client";

import { GameSummary, TeamInfo, LastH2HBoxScore } from "@/lib/nba/types";
import Section from "@/components/Section";
import Subheading from "@/components/Subheading";
import PlayerRow from "@/components/PlayerRow";
import GameRow from "@/components/GameRow";

interface HeadToHeadSectionProps {
  headToHead: GameSummary[];
  lastHeadToHeadBoxScore: LastH2HBoxScore | null;
  /** e.g. "Pacers" – used in empty state when there are no past matchups */
  opponentName?: string;
  emptyMessage?: string;
}

function formatTeamLabel(team: TeamInfo): string {
  const tricode = team?.teamTricode?.trim();
  if (tricode && tricode.length <= 4 && !/^\d+$/.test(tricode)) return tricode;
  const city = team?.teamCity?.trim();
  const name = team?.teamName?.trim();
  if (city || name) return [city, name].filter(Boolean).join(" ");
  return "—";
}

/** Full team name only, e.g. "Cavaliers", "Nuggets" */
function formatTeamName(team: TeamInfo): string {
  const name = team?.teamName?.trim();
  if (name) return name;
  return formatTeamLabel(team);
}

function TopPerformersBlock({
  box,
  firstGame,
}: {
  box: LastH2HBoxScore;
  firstGame: GameSummary;
}) {
  const homeLabel = formatTeamName(firstGame.homeTeam);
  const awayLabel = formatTeamName(firstGame.awayTeam);

  const playerList = (
    players: Array<{
      playerName: string;
      personId: number;
      value: number;
      jerseyNumber?: string;
      position?: string;
    }>,
    gameHighPersonId: number | null,
    valueSuffix: string
  ) => (
    <ul className="grid grid-cols-1 gap-1.5">
      {players.map((p) => (
        <PlayerRow
          key={p.personId}
          playerName={p.playerName}
          jerseyNumber={p.jerseyNumber}
          highlight={p.personId === gameHighPersonId}
          right={
            <span className="font-mono uppercase">
              {p.value} {valueSuffix}
            </span>
          }
        />
      ))}
      {players.length === 0 && <li>—</li>}
    </ul>
  );

  const renderStatColumn = (
    label: string,
    homePlayers: Array<{
      playerName: string;
      personId: number;
      value: number;
      jerseyNumber?: string;
      position?: string;
    }>,
    awayPlayers: Array<{
      playerName: string;
      personId: number;
      value: number;
      jerseyNumber?: string;
      position?: string;
    }>,
    gameHighPersonId: number | null,
    valueSuffix: string
  ) => (
    <div className="mb-6 last:mb-0">
      <h4 className="sr-only">{label}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 gap- md:gap-12">
        {playerList(homePlayers, gameHighPersonId, valueSuffix)}
        {playerList(awayPlayers, gameHighPersonId, valueSuffix)}
      </div>
    </div>
  );

  return (
    <div>
      <h3 className="sr-only">Top performers (last meeting)</h3>
      <div className="hidden md:grid grid-cols-2 gap-12">
        <Subheading>{homeLabel}</Subheading>
        <Subheading>{awayLabel}</Subheading>
      </div>
      {renderStatColumn(
        "Points",
        box.homeTopPts,
        box.awayTopPts,
        box.gameHighPtsPersonId ?? null,
        "pts"
      )}
      {renderStatColumn(
        "Rebounds",
        box.homeTopReb,
        box.awayTopReb,
        box.gameHighRebPersonId ?? null,
        "reb"
      )}
      {renderStatColumn(
        "Assists",
        box.homeTopAst,
        box.awayTopAst,
        box.gameHighAstPersonId ?? null,
        "ast"
      )}
    </div>
  );
}

export default function HeadToHeadSection({
  headToHead,
  lastHeadToHeadBoxScore,
  opponentName,
  emptyMessage,
}: HeadToHeadSectionProps) {
  const list = Array.isArray(headToHead) ? headToHead : [];
  const firstGame = list[0];
  const showTopPerformers =
    firstGame &&
    lastHeadToHeadBoxScore &&
    lastHeadToHeadBoxScore.gameId === firstGame.gameId;
  const defaultEmptyMessage = opponentName
    ? `No Cavaliers vs ${opponentName} matchups yet this season.`
    : "No matchups available this season.";

  return (
    <Section title="Head-to-head this season">
      {list.length === 0 ? (
        <p className="text-gray-400 text-sm">
          {emptyMessage ?? defaultEmptyMessage}
        </p>
      ) : (
        <>
          {list.map((game, index) => (
            <div key={game?.gameId || `h2h-${index}`}>
              <div className="mb-8">
                <GameRow game={game} />
              </div>
              {index === 0 && showTopPerformers && lastHeadToHeadBoxScore && (
                <TopPerformersBlock
                  box={lastHeadToHeadBoxScore}
                  firstGame={firstGame}
                />
              )}
            </div>
          ))}
        </>
      )}
    </Section>
  );
}
