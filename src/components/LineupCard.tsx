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
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4 text-cavaliers-gold">
        Expected {teamName} Lineup
      </h2>
      {players.length === 0 ? (
        <p className="text-gray-400 text-sm">Lineup not available yet</p>
      ) : (
        <div className="space-y-2">
          {players.map((player, idx) => (
            <div
              key={player.personId || idx}
              className="bg-gray-700/50 p-2 rounded flex justify-between items-center"
            >
              <div>
                <span className="font-medium">
                  {player.firstName} {player.lastName}
                </span>
                {player.jerseyNumber && (
                  <span className="text-gray-400 ml-2">
                    #{player.jerseyNumber}
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-300">{player.position}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
