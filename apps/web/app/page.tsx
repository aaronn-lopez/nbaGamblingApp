import { getPlayerMap, getSnapshotMap, loadWebState } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { CardShelf, ListingRow, MetricRibbon, PlayerSpotlight, SectionCard } from "@court-cash/ui";

export default async function HomePage() {
  const state = await loadWebState();
  const playerMap = getPlayerMap(state.players);
  const snapshotMap = getSnapshotMap(state.rankingSnapshot);
  const topPlayer = state.rankingSnapshot.players[0];
  const topPerformer = playerMap.get(topPlayer.playerId);

  return (
    <AppShell>
      <section className="hero">
        <div className="hero-copy">
          <p className="cc-eyebrow">Mobile-first collectible market</p>
          <h2>Trade serialized NBA cards across web and mobile with a weekly predictive ranking engine.</h2>
          <p>
            The economy runs on Court Cash, every pack mint is tied to a published ranking snapshot, and every
            market purchase settles through the backend ledger.
          </p>
        </div>
        <div className="hero-ribbons">
          <MetricRibbon label="Live wallet" value={`${state.wallet.balance} CC`} />
          <MetricRibbon label="Weekly model" value={state.rankingSnapshot.modelVersion} tone="cool" />
          <MetricRibbon label="Listings" value={String(state.marketplaceListings.length)} tone="gold" />
        </div>
      </section>

      <div className="two-up">
        {topPerformer ? (
          <PlayerSpotlight
            player={topPerformer}
            snapshot={topPlayer}
            subtitle={`${topPerformer.team} ${topPerformer.position} leads the Week 13 projection board.`}
          />
        ) : null}
        <SectionCard title="Release shape" eyebrow="What ships now">
          <ul className="plain-list">
            <li>Serialized cards with immutable tier at mint.</li>
            <li>Weekly predictive rankings published after the Sunday slate.</li>
            <li>Pack shop, featured shop drops, and fixed-price player listings.</li>
            <li>Shared contracts across web, mobile, and API service.</li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Collection Preview" eyebrow="Demo inventory">
        <CardShelf title="Will Desai" cards={state.cards} players={playerMap} />
      </SectionCard>

      <SectionCard title="Market Pulse" eyebrow="Active listings">
        <div className="listing-stack">
          {state.marketplaceListings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} player={playerMap.get(listing.playerId)} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Ledger Preview" eyebrow="Court Cash">
        <div className="ledger-grid">
          {state.walletLedger.slice(0, 4).map((entry) => (
            <article className="ledger-card" key={entry.id}>
              <p className="cc-eyebrow">{entry.entryType.replaceAll("_", " ")}</p>
              <h3>{entry.amount > 0 ? `+${entry.amount}` : `${entry.amount}`} CC</h3>
              <p>{entry.description}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
