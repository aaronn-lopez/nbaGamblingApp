import { AppShell } from "../../components/AppShell";
import { loadWebState } from "../../lib/api";
import { SectionCard } from "@court-cash/ui";

export default async function ShopPage() {
  const state = await loadWebState();
  const packOffers = state.shopOffers.filter((offer) => offer.offerType === "PACK");
  const featuredOffers = state.shopOffers.filter((offer) => offer.offerType === "FEATURED_CARD");

  return (
    <AppShell>
      <SectionCard title="Pack Shop" eyebrow="Server-priced inventory">
        <div className="offer-grid">
          {packOffers.map((offer) => (
            <article className="offer-card" key={offer.id}>
              <p className="cc-eyebrow">{offer.packType}</p>
              <h3>{offer.title}</h3>
              <p>{offer.description}</p>
              <strong>{offer.price} CC</strong>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Featured Drops" eyebrow="Snapshot-bound cards">
        <div className="offer-grid">
          {featuredOffers.map((offer) => (
            <article className="offer-card" key={offer.id}>
              <p className="cc-eyebrow">{offer.tier}</p>
              <h3>{offer.title}</h3>
              <p>{offer.description}</p>
              <strong>{offer.price} CC</strong>
            </article>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
