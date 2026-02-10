import { cva } from "class-variance-authority";
import { InjuryEntry } from "@/lib/nba/types";
import { cn } from "@/lib/utils";
import Subheading from "@/components/Subheading";
import PlayerRow from "@/components/PlayerRow";

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

interface InjurySectionMobileProps {
  team: string;
  injuries: InjuryEntry[];
}

const STATUS_ORDER: InjuryEntry["status"][] = [
  "Out",
  "Doubtful",
  "Questionable",
  "Probable",
];

export default function InjurySectionMobile({
  team,
  injuries,
}: InjurySectionMobileProps) {
  const reported = injuries
    .filter(
      (e) =>
        e.status !== "Available" && !e.reason.includes("G League - Two-Way")
    )
    .sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    );

  if (reported.length === 0) {
    return (
      <div>
        <Subheading>{team}</Subheading>
        <p className="text-secondary">No injuries reported.</p>
      </div>
    );
  }

  const byStatus = reported.reduce<Record<string, InjuryEntry[]>>((acc, e) => {
    if (!acc[e.status]) acc[e.status] = [];
    acc[e.status].push(e);
    return acc;
  }, {});

  return (
    <div>
      <Subheading>{team}</Subheading>
      <div className="flex flex-col gap-4">
        {STATUS_ORDER.filter((s) => byStatus[s]?.length).map((status) => (
          <div key={status}>
            <h4
              className={cn(
                "text-sm font-semibold font-mono mb-2",
                injuryStatus({ status })
              )}
            >
              {status}
            </h4>
            <ul className="grid grid-cols-1 gap-1">
              {byStatus[status].map((injury, idx) => (
                <PlayerRow
                  key={idx}
                  playerName={injury.playerName}
                  jerseyNumber={injury.jerseyNumber}
                  right={null}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
