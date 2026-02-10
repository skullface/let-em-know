import Section from "@/components/Section";
import Starters from "@/components/Starters";
import { Player } from "@/lib/nba/types";

interface StartingLineupSectionProps {
  cavaliersPlayers: Player[];
  opponentPlayers: Player[];
  opponentName: string;
}

export default function StartingLineupSection({
  cavaliersPlayers,
  opponentPlayers,
  opponentName,
}: StartingLineupSectionProps) {
  return (
    <Section title="Expected starting lineup">
      <div className="grid grid-cols-2 gap-6 md:gap-12">
        <Starters teamName="Cavaliers" players={cavaliersPlayers} />
        <Starters teamName={opponentName} players={opponentPlayers} />
      </div>
    </Section>
  );
}
