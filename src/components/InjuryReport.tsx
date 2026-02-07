import { InjuryEntry } from '@/lib/nba/types';

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
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4 text-white">
        Injury Report
      </h2>
      <div className="space-y-4">
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
  if (injuries.length === 0) {
    return (
      <div>
        <h3 className="font-semibold mb-2 text-zinc-300">{team}</h3>
        <p className="text-sm text-zinc-500">No injuries reported</p>
      </div>
    );
  }

  const statusColors: Record<InjuryEntry['status'], string> = {
    Out: 'text-red-500',
    Questionable: 'text-yellow-500',
    Doubtful: 'text-orange-500',
    Probable: 'text-green-500',
    Available: 'text-green-500',
  };

  return (
    <div>
      <h3 className="font-semibold mb-2 text-zinc-300">{team}</h3>
      <div className="space-y-2">
        {injuries.map((injury, idx) => (
          <div key={idx} className="bg-zinc-800/50 border border-zinc-700/50 p-2 rounded text-sm">
            <div className="flex justify-between items-start mb-1">
              <span className="font-medium text-white">
                {injury.playerName}
                {injury.jerseyNumber && (
                  <span className="text-zinc-500 ml-2">#{injury.jerseyNumber}</span>
                )}
              </span>
              <span className={`font-semibold ${statusColors[injury.status]}`}>
                {injury.status}
              </span>
            </div>
            <div className="text-zinc-500 text-xs">
              {injury.reason?.trim() || '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
