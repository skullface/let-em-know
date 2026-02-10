import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const playerRow = cva("flex justify-between");

export interface PlayerRowProps {
  playerName: string;
  jerseyNumber?: string | number;
  /** Content for the right side (e.g. status, or stat value) */
  right: React.ReactNode;
  /** Use for “game high” or similar emphasis (e.g. in HeadToHead top performers) */
  highlight?: boolean;
}

export default function PlayerRow({
  playerName,
  jerseyNumber,
  right,
  highlight = false,
}: PlayerRowProps) {
  return (
    <li className={playerRow()}>
      <span className="flex">
        <span
          className={cn(
            "w-[3ch] mr-3 font-mono",
            highlight ? "text-green-500" : "text-secondary"
          )}
        >
          {jerseyNumber != null && jerseyNumber !== "" ? (
            <>#{jerseyNumber}</>
          ) : (
            <>#</>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-inherit">
          {playerName}
          {highlight && (
            <span className="rounded-full w-2 h-2 bg-green-500 block" />
          )}
        </span>
      </span>
      <span className={cn("md:w-fit font-mono", highlight && "text-green-500")}>
        {right}
      </span>
    </li>
  );
}
