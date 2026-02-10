import Section from "@/components/Section";
import Starters from "@/components/Starters";
import { Player } from "@/lib/nba/types";

interface StartingLineupSectionProps {
  cavaliersPlayers: Player[];
  opponentPlayers: Player[];
  opponentName: string;
  isHome: boolean;
}

export default function StartingLineupSection({
  cavaliersPlayers,
  opponentPlayers,
  opponentName,
  isHome,
}: StartingLineupSectionProps) {
  return (
    <Section title="Expected starting lineup">
      <div className="grid grid-cols-2 gap-12">
        <Starters
          teamName="Cavaliers"
          players={cavaliersPlayers}
          isHome={isHome}
        />
        <Starters
          teamName={opponentName}
          players={opponentPlayers}
          isHome={!isHome}
        />
      </div>
    </Section>
  );
}
