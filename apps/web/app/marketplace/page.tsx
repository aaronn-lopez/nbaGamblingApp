import { AppShell } from "../../components/AppShell";
import { getPlayerMap, loadWebState } from "../../lib/api";
import { ListingRow, MetricRibbon, SectionCard } from "@court-cash/ui";
import { formatBalance } from "../../lib/formatting";

export default async function MarketplacePage() {
  const state = await loadWebState();
  const playerMap = getPlayerMap(state.players);
  const averageAsk = Math.round(
    state.marketplaceListings.reduce((total, listing) => total + listing.askingPrice, 0) /
      Math.max(state.marketplaceListings.length, 1)
  );

  return (
    <AppShell>
      <section className="hero compact">
        <MetricRibbon label="Selling fee" value="5%" />
        <MetricRibbon label="Average price" value={formatBalance(averageAsk)} tone="cool" />
        <MetricRibbon label="Cards for sale" value={String(state.marketplaceListings.length)} tone="gold" />
      </section>

      <SectionCard title="Cards for Sale" eyebrow="See what other players are selling">
        <div className="listing-stack">
          {state.marketplaceListings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} player={playerMap.get(listing.playerId)} />
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
