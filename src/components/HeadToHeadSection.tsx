"use client";

import { GameSummary, TeamInfo, LastH2HBoxScore } from "@/lib/nba/types";
import Section from "@/components/Section";
import Subheading from "@/components/Subheading";
import PlayerRow from "@/components/PlayerRow";
import GameRow from "@/components/GameRow";

const CAVALIERS_TEAM_ID = 1610612739;

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
  const cavaliersAreHome = firstGame.homeTeam?.teamId === CAVALIERS_TEAM_ID;
  const firstLabel = cavaliersAreHome
    ? formatTeamName(firstGame.homeTeam)
    : formatTeamName(firstGame.awayTeam);
  const secondLabel = cavaliersAreHome
    ? formatTeamName(firstGame.awayTeam)
    : formatTeamName(firstGame.homeTeam);

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
    <ul className="grid grid-cols-1 gap-1.5 mb-8">
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

  const firstPts = cavaliersAreHome ? box.homeTopPts : box.awayTopPts;
  const secondPts = cavaliersAreHome ? box.awayTopPts : box.homeTopPts;
  const firstReb = cavaliersAreHome ? box.homeTopReb : box.awayTopReb;
  const secondReb = cavaliersAreHome ? box.awayTopReb : box.homeTopReb;
  const firstAst = cavaliersAreHome ? box.homeTopAst : box.awayTopAst;
  const secondAst = cavaliersAreHome ? box.awayTopAst : box.homeTopAst;

  const renderStatColumn = (
    label: string,
    firstPlayers: Array<{
      playerName: string;
      personId: number;
      value: number;
      jerseyNumber?: string;
      position?: string;
    }>,
    secondPlayers: Array<{
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
        {playerList(firstPlayers, gameHighPersonId, valueSuffix)}
        {playerList(secondPlayers, gameHighPersonId, valueSuffix)}
      </div>
    </div>
  );

  return (
    <div>
      <h3 className="sr-only">Top performers (last meeting)</h3>
      <div className="hidden md:grid grid-cols-2 gap-12">
        <Subheading>{firstLabel}</Subheading>
        <Subheading>{secondLabel}</Subheading>
      </div>
      {renderStatColumn(
        "Points",
        firstPts,
        secondPts,
        box.gameHighPtsPersonId ?? null,
        "pts"
      )}
      {renderStatColumn(
        "Rebounds",
        firstReb,
        secondReb,
        box.gameHighRebPersonId ?? null,
        "reb"
      )}
      {renderStatColumn(
        "Assists",
        firstAst,
        secondAst,
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
            <div
              key={game?.gameId || `h2h-${index}`}
              className="grid grid-cols-1 gap-8"
            >
              <div>
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
