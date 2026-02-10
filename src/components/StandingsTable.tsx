import { type ReactNode } from "react";
import { cva } from "class-variance-authority";
import { StandingsEntry } from "@/lib/nba/types";
import Section from "@/components/Section";
import Subheading from "@/components/Subheading";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const star = cva("inline-flex shrink-0", {
  variants: {
    rank: {
      1: "text-amber-400",
      2: "text-neutral-500",
      3: "text-amber-800",
    },
  },
});

function Star({ rank }: { rank: 1 | 2 | 3 }) {
  return (
    <span className={star({ rank })} aria-hidden>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 14 13"
        width="14"
        height="13"
        fill="currentColor"
        className="size-4"
        aria-hidden
      >
        <path d="M7 0L9.16 4.28L14 4.96L10.5 8.30L11.33 13L7 10.78L2.67 13L3.5 8.3L0 4.96L4.84 4.28L7 0Z" />
      </svg>
    </span>
  );
}

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
      <div className="grid grid-cols-2 gap-6 md:gap-12">
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
  label: (team: StandingsEntry) => ReactNode;
}[] = [
  { key: "leagueRank", label: () => "in the league" },
  {
    key: "conferenceRank",
    label: (team) => (
      <>
        in {team.conference} <span className="md:hidden">Conf.</span>
        <span className="hidden md:inline">Conference</span>
      </>
    ),
  },
  {
    key: "divisionRank",
    label: (team) => (
      <>
        in {team.division} <span className="md:hidden">Div.</span>
        <span className="hidden md:inline">Division</span>
      </>
    ),
  },
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
              {(rank === 1 || rank === 2 || rank === 3) && (
                <Star rank={rank as 1 | 2 | 3} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
