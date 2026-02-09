import { cva } from "class-variance-authority";
import { InjuryEntry } from "@/lib/nba/types";
import Section from "@/components/Section";
import Subheading from "@/components/Subheading";
import PlayerRow from "@/components/PlayerRow";

const injuryStatus = cva("", {
  variants: {
    status: {
      Out: "text-red-400",
      Questionable: "text-yellow-400",
      Doubtful: "text-orange-400",
      Probable: "text-green-400",
      Available: "text-green-300",
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
      <div className="grid grid-cols-2 gap-12">
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
  const reported = injuries.filter((e) => e.status !== "Available");
  if (reported.length === 0) {
    return (
      <div>
        <Subheading>{team}</Subheading>
        <p>No injuries reported</p>
      </div>
    );
  }

  return (
    <div>
      <Subheading>{team}</Subheading>
      <ul>
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
