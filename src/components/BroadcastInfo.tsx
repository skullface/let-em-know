import { Broadcast } from '@/lib/nba/types';

interface BroadcastInfoProps {
  broadcasts: Broadcast[];
}

export default function BroadcastInfo({ broadcasts }: BroadcastInfoProps) {
  if (broadcasts.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-bold mb-4 text-cavaliers-gold">
          Broadcast Information
        </h2>
        <p className="text-gray-400">Broadcast information not available</p>
      </div>
    );
  }

  const national = broadcasts.filter((b) => b.broadcasterScope === 'natl');
  const local = broadcasts.filter((b) => b.broadcasterScope !== 'natl');

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4 text-cavaliers-gold">
        Broadcast Information
      </h2>
      <div className="space-y-3">
        {national.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">
              National Broadcast
            </h3>
            <div className="flex flex-wrap gap-2">
              {national.map((broadcast, idx) => (
                <span
                  key={idx}
                  className="bg-cavaliers-wine px-3 py-1 rounded text-sm"
                >
                  {broadcast.broadcasterDisplay}
                </span>
              ))}
            </div>
          </div>
        )}
        {local.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">
              Local Broadcast
            </h3>
            <div className="flex flex-wrap gap-2">
              {local.map((broadcast, idx) => (
                <span
                  key={idx}
                  className="bg-gray-700 px-3 py-1 rounded text-sm"
                >
                  {broadcast.broadcasterDisplay}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
