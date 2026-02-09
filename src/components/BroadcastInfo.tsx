import { Broadcast } from "@/lib/nba/types";

interface BroadcastInfoProps {
  broadcasts: Broadcast[];
  /** When true, Cavs are home so Cleveland local = home broadcasters; when false, Cleveland local = away broadcasters */
  isHomeGame?: boolean;
}

export default function BroadcastInfo({
  broadcasts,
  isHomeGame = true,
}: BroadcastInfoProps) {
  const national = broadcasts.filter(
    (b) => b.broadcasterScope === "natl" && b.broadcasterMedia === "tv"
  );
  const clevelandLocal = broadcasts.filter((b) =>
    isHomeGame ? b.broadcasterScope === "home" : b.broadcasterScope === "away"
  );
  const toShow = [...national, ...clevelandLocal];
  if (toShow.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-1 text-secondary text-sm border-t pt-3 mt-3 border-subtle">
      <h2 className="sr-only">Broadcast information</h2>
      Streaming on
      <ul>
        {toShow.map((broadcast, idx) => (
          <li key={idx}>
            {idx > 0 && " and "}
            {broadcast.broadcasterDisplay}
          </li>
        ))}
      </ul>
    </div>
  );
}
