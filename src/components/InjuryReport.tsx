import { InjuryEntry } from "@/lib/nba/types";

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
    <div>
      <h2>Injury report</h2>
      <div className="grid grid-cols-2 gap-12">
        <InjurySection team="Cavaliers" injuries={cavaliers} />
        <InjurySection team={opponentName} injuries={opponent} />
      </div>
    </div>
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
        <h3>{team}</h3>
        <p>No injuries reported</p>
      </div>
    );
  }

  const statusColors: Record<InjuryEntry["status"], string> = {
    Out: "text-red-400",
    Questionable: "text-yellow-400",
    Doubtful: "text-orange-400",
    Probable: "text-green-400",
    Available: "text-green-300",
  };

  return (
    <div>
      <h3>{team}</h3>
      <div>
        {reported.map((injury, idx) => (
          <ul key={idx}>
            <li className="flex justify-between items-start mb-1">
              <span className="font-medium flex flex-row-reverse gap-2">
                {injury.playerName}
                <span className="w-[3ch] text-secondary font-mono">
                  {injury.jerseyNumber ? <>#{injury.jerseyNumber}</> : <>#</>}
                </span>
              </span>
              <span className={`${statusColors[injury.status]}`}>
                {injury.status}
              </span>
            </li>
          </ul>
        ))}
      </div>
    </div>
  );
}
