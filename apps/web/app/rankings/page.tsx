import { AppShell } from "../../components/AppShell";
import { getPlayerMap, loadWebState } from "../../lib/api";
import { SectionCard } from "@court-cash/ui";

export default async function RankingsPage() {
  const state = await loadWebState();
  const playerMap = getPlayerMap(state.players);

  return (
    <AppShell>
      <SectionCard title="Weekly Ranking Snapshot" eyebrow={state.rankingSnapshot.label}>
        <div className="table-shell">
          <table className="rank-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Tier</th>
                <th>Projection</th>
                <th>Percentile</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {state.rankingSnapshot.players.map((snapshot, index) => {
                const player = playerMap.get(snapshot.playerId);

                return (
                  <tr key={snapshot.playerId}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{player?.fullName}</strong>
                      <span>{player?.team}</span>
                    </td>
                    <td>{snapshot.tier}</td>
                    <td>{snapshot.playerPowerScore}</td>
                    <td>{snapshot.percentile}%</td>
                    <td>{snapshot.trendLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
