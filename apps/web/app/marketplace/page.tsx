import { AppShell } from "../../components/AppShell";
import { getPlayerMap, loadWebState } from "../../lib/api";
import { ListingRow, MetricRibbon, SectionCard } from "@court-cash/ui";

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
        <MetricRibbon label="Marketplace fee" value="5%" />
        <MetricRibbon label="Average ask" value={`${averageAsk} CC`} tone="cool" />
        <MetricRibbon label="Settlement mode" value="Atomic" tone="gold" />
      </section>

      <SectionCard title="Live Listings" eyebrow="Fixed-price market">
        <div className="listing-stack">
          {state.marketplaceListings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} player={playerMap.get(listing.playerId)} />
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
