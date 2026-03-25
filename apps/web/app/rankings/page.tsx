import { AppShell } from "../../components/AppShell";
import { getPlayerMap, loadWebState } from "../../lib/api";
import { RankingsTable } from "../../components/RankingsTable";
import { SectionCard } from "@court-cash/ui";

export default async function RankingsPage() {
  const state = await loadWebState();
  const playerMap = getPlayerMap(state.players);
  const rankedPlayers = state.rankingSnapshot.players
    .map((snapshot) => playerMap.get(snapshot.playerId))
    .filter((player): player is (typeof state.players)[number] => Boolean(player));

  return (
    <AppShell>
      <SectionCard title="Players to Watch" eyebrow={state.rankingSnapshot.label}>
        <RankingsTable players={rankedPlayers} snapshots={state.rankingSnapshot.players} />
      </SectionCard>
    </AppShell>
  );
}
