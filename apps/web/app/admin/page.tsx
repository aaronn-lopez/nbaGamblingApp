import { AppShell } from "../../components/AppShell";
import { loadWebState } from "../../lib/api";
import { SectionCard } from "@court-cash/ui";

export default async function AdminPage() {
  const state = await loadWebState();

  return (
    <AppShell>
      <SectionCard title="Status" eyebrow="A quick look at what’s live">
        <div className="offer-grid">
          <article className="offer-card">
            <p className="cc-eyebrow">Player list</p>
            <h3>{state.rankingSnapshot.label}</h3>
            <p>Updated {new Date(state.rankingSnapshot.publishedAt).toLocaleString()}.</p>
            <strong>Ready now</strong>
          </article>
          <article className="offer-card">
            <p className="cc-eyebrow">Shop</p>
            <h3>{state.shopOffers.length} items live</h3>
            <p>Packs and featured cards are ready to buy.</p>
            <strong>Open now</strong>
          </article>
          <article className="offer-card">
            <p className="cc-eyebrow">Market</p>
            <h3>Open</h3>
            <p>Players can buy and sell cards right now.</p>
            <strong>Running normally</strong>
          </article>
        </div>
      </SectionCard>
    </AppShell>
  );
}
