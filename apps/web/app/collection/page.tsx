import { AppShell } from "../../components/AppShell";
import { getPlayerMap, loadWebState } from "../../lib/api";
import { CardShelf, SectionCard } from "@court-cash/ui";

export default async function CollectionPage() {
  const state = await loadWebState();
  const playerMap = getPlayerMap(state.players);

  return (
    <AppShell>
      <SectionCard title="Serialized Collection" eyebrow={`${state.profile.displayName} · ${state.wallet.balance} CC`}>
        <CardShelf title="Owned cards" cards={state.cards} players={playerMap} />
      </SectionCard>

      <SectionCard title="Wallet History" eyebrow="Ledger">
        <div className="ledger-grid">
          {state.walletLedger.map((entry) => (
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
