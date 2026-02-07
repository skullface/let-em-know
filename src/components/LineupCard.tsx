import { Player } from "@/lib/nba/types";

interface LineupCardProps {
  teamName: string;
  players: Player[];
  isHome: boolean;
}

export default function LineupCard({
  teamName,
  players,
  isHome,
}: LineupCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4 text-white">
        Expected {teamName} Lineup
      </h2>
      {players.length === 0 ? (
        <p className="text-zinc-500 text-sm">Lineup not available yet</p>
      ) : (
        <div className="space-y-2">
          {players.map((player, idx) => (
            <div
              key={player.personId || idx}
              className="bg-zinc-800/50 border border-zinc-700/50 p-2 rounded flex justify-between items-center"
            >
              <div>
                <span className="font-medium text-white">
                  {player.firstName} {player.lastName}
                </span>
                {player.jerseyNumber && (
                  <span className="text-zinc-500 ml-2">
                    #{player.jerseyNumber}
                  </span>
                )}
              </div>
              <span className="text-sm text-zinc-400">{player.position}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
