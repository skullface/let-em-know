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
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4 text-cavaliers-gold">
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
        <h3 className="font-semibold mb-2 text-gray-300">{team}</h3>
        <p className="text-sm text-gray-400">No injuries reported</p>
      </div>
    );
  }

  const statusColors: Record<InjuryEntry['status'], string> = {
    Out: 'text-red-400',
    Questionable: 'text-yellow-400',
    Doubtful: 'text-orange-400',
    Probable: 'text-green-400',
    Available: 'text-green-300',
  };

  return (
    <div>
      <h3 className="font-semibold mb-2 text-gray-300">{team}</h3>
      <div className="space-y-2">
        {injuries.map((injury, idx) => (
          <div key={idx} className="bg-gray-700/50 p-2 rounded text-sm">
            <div className="flex justify-between items-start mb-1">
              <span className="font-medium">
                {injury.playerName}
                {injury.jerseyNumber && (
                  <span className="text-gray-400 ml-2">#{injury.jerseyNumber}</span>
                )}
              </span>
              <span className={`font-semibold ${statusColors[injury.status]}`}>
                {injury.status}
              </span>
            </div>
            <div className="text-gray-400 text-xs">
              {injury.reason?.trim() || '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
