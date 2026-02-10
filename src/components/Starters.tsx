import { Player } from "@/lib/nba/types";
import Subheading from "@/components/Subheading";
import PlayerRow from "@/components/PlayerRow";

interface StartersProps {
  teamName: string;
  players: Player[];
}

export default function Starters({ teamName, players }: StartersProps) {
  return (
    <div>
      <Subheading>{teamName}</Subheading>
      {players.length === 0 ? (
        <p className="text-gray-400 text-sm">Lineup not available yet</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5">
          {players.map((player, idx) => (
            <PlayerRow
              key={player.personId || idx}
              playerName={`${player.firstName} ${player.lastName}`}
              jerseyNumber={player.jerseyNumber}
              right={null}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
