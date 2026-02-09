import { StandingsEntry } from "@/lib/nba/types";
import Section from "@/components/Section";
import Subheading from "@/components/Subheading";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

interface StandingsTableProps {
  cavaliers: StandingsEntry;
  opponent: StandingsEntry;
}

export default function StandingsTable({
  cavaliers,
  opponent,
}: StandingsTableProps) {
  return (
    <Section title="Standings">
      <div className="grid grid-cols-2 gap-12">
        <StandingsTeam team={cavaliers} label="Cavaliers" />
        <StandingsTeam team={opponent} label={opponent.teamName} />
      </div>
    </Section>
  );
}

const RANK_ITEMS: {
  key: keyof Pick<
    StandingsEntry,
    "leagueRank" | "conferenceRank" | "divisionRank"
  >;
  label: (team: StandingsEntry) => string;
}[] = [
  { key: "leagueRank", label: () => "in the league" },
  {
    key: "conferenceRank",
    label: (team) => `in ${team.conference} Conference`,
  },
  { key: "divisionRank", label: (team) => `in ${team.division} Division` },
];

function StandingsTeam({
  team,
  label,
}: {
  team: StandingsEntry;
  label: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-center relative">
        <Subheading className="flex-1">{label}</Subheading>
        <span
          aria-label={`Record: ${team.wins} wins, ${team.losses} losses`}
          className="font-mono absolute right-0 top-0"
        >
          {team.wins}–{team.losses}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-1">
        {RANK_ITEMS.map(({ key, label: getLabel }) => {
          const rank = team[key];
          return (
            <li
              key={key}
              className="flex flex-row items-center justify-between gap-2"
            >
              <span>
                <span className="font-mono text-secondary">
                  {ordinal(rank)}{" "}
                </span>
                {getLabel(team)}
              </span>
              {MEDALS[rank] && <span aria-hidden>{MEDALS[rank]}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
