import { cva } from "class-variance-authority";
import { InjuryEntry } from "@/lib/nba/types";
import Section from "@/components/Section";
import Subheading from "@/components/Subheading";
import PlayerRow from "@/components/PlayerRow";
import InjurySectionMobile from "@/components/InjurySectionMobile";

const injuryStatus = cva("", {
  variants: {
    status: {
      Out: "text-red-500",
      Questionable: "text-yellow-500",
      Doubtful: "text-orange-500",
      Probable: "text-green-500",
      Available: "text-green-500",
    },
  },
});

interface InjuryReportProps {
  cavaliers: InjuryEntry[];
  opponent: InjuryEntry[];
  opponentName: string;
}

export default function InjuryReport({
  cavaliers,
  opponent,
  opponentName,
}: InjuryReportProps) {
  return (
    <Section title="Injury report">
      <div className="grid grid-cols-2 gap-6 md:gap-12 md:hidden">
        <InjurySectionMobile team="Cavaliers" injuries={cavaliers} />
        <InjurySectionMobile team={opponentName} injuries={opponent} />
      </div>
      <div className="hidden md:grid grid-cols-2 gap-6 md:gap-12">
        <InjurySection team="Cavaliers" injuries={cavaliers} />
        <InjurySection team={opponentName} injuries={opponent} />
      </div>
    </Section>
  );
}

function InjurySection({
  team,
  injuries,
}: {
  team: string;
  injuries: InjuryEntry[];
}) {
  const statusOrder: InjuryEntry["status"][] = [
    "Out",
    "Doubtful",
    "Questionable",
    "Probable",
  ];
  const reported = injuries
    .filter(
      (e) =>
        e.status !== "Available" && !e.reason.includes("G League - Two-Way")
    )
    .sort(
      (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
    );
  if (reported.length === 0) {
    return (
      <div>
        <Subheading>{team}</Subheading>
        <p className="text-secondary">No injuries reported.</p>
      </div>
    );
  }

  return (
    <div>
      <Subheading>{team}</Subheading>
      <ul className="grid grid-cols-1 gap-1.5">
        {reported.map((injury, idx) => (
          <PlayerRow
            key={idx}
            playerName={injury.playerName}
            jerseyNumber={injury.jerseyNumber}
            right={
              <span className={injuryStatus({ status: injury.status })}>
                {injury.status}
              </span>
            }
          />
        ))}
      </ul>
    </div>
  );
}
