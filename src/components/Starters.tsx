import { Player } from "@/lib/nba/types";
import Subheading from "@/components/Subheading";
import PlayerRow from "@/components/PlayerRow";

interface StartersProps {
  teamName: string;
  players: Player[];
  isHome: boolean;
}

export default function Starters({ teamName, players, isHome }: StartersProps) {
  return (
    <div>
      <Subheading>{teamName}</Subheading>
      {players.length === 0 ? (
        <p className="text-gray-400 text-sm">Lineup not available yet</p>
      ) : (
        <ul className="space-y-2">
          {players.map((player, idx) => (
            <PlayerRow
              key={player.personId || idx}
              playerName={`${player.firstName} ${player.lastName}`}
              jerseyNumber={player.jerseyNumber}
              right={player.position}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
