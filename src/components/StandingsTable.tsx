import { StandingsEntry } from '@/lib/nba/types';

interface StandingsTableProps {
  cavaliers: StandingsEntry;
  opponent: StandingsEntry;
}

export default function StandingsTable({
  cavaliers,
  opponent,
}: StandingsTableProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4 text-cavaliers-gold">Standings</h2>
      <div className="space-y-4">
        <StandingsRow
          team={cavaliers}
          label="Cavaliers"
          isHighlighted={true}
        />
        <StandingsRow team={opponent} label={`${opponent.teamCity} ${opponent.teamName}`} />
      </div>
    </div>
  );
}

function StandingsRow({
  team,
  label,
  isHighlighted = false,
}: {
  team: StandingsEntry;
  label: string;
  isHighlighted?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded ${
        isHighlighted ? 'bg-cavaliers-wine/30' : 'bg-gray-700/50'
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">{label}</span>
        <span className="text-cavaliers-gold font-bold">
          {team.wins}-{team.losses}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm text-gray-300">
        <div>
          <span className="text-gray-400">Conference:</span> #{team.conferenceRank}
        </div>
        <div>
          <span className="text-gray-400">Division:</span> #{team.divisionRank}
        </div>
        <div>
          <span className="text-gray-400">League:</span> #{team.leagueRank}
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-400">
        {team.conference} Conference • {team.division} Division
      </div>
    </div>
  );
}
