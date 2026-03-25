import { AppShell } from "../../components/AppShell";
import { loadWebState } from "../../lib/api";
import { SectionCard } from "@court-cash/ui";

export default async function AdminPage() {
  const state = await loadWebState();

  return (
    <AppShell>
      <SectionCard title="Operations Console" eyebrow="Admin controls">
        <div className="offer-grid">
          <article className="offer-card">
            <p className="cc-eyebrow">Ranking publish</p>
            <h3>{state.rankingSnapshot.label}</h3>
            <p>Weekly snapshot published {new Date(state.rankingSnapshot.publishedAt).toLocaleString()}.</p>
            <strong>Model {state.rankingSnapshot.modelVersion}</strong>
          </article>
          <article className="offer-card">
            <p className="cc-eyebrow">Shop rotation</p>
            <h3>{state.shopOffers.length} active offers</h3>
            <p>Pack inventory and featured cards rotate off the published ranking snapshot.</p>
            <strong>Status live</strong>
          </article>
          <article className="offer-card">
            <p className="cc-eyebrow">Kill switch</p>
            <h3>Marketplace enabled</h3>
            <p>Atomic settlement and fee burn stay server-gated through the FastAPI service.</p>
            <strong>No incidents</strong>
          </article>
        </div>
      </SectionCard>
    </AppShell>
  );
}
