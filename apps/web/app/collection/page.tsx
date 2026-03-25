'use client';

import { PackOpenResult, PackType } from "@court-cash/domain";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CardShelf, SectionCard } from "@court-cash/ui";
import { AppShell } from "../../components/AppShell";
import { getPlayerMap, isAuthenticated, loadWebState, openPack, WebState } from "../../lib/api";
import { formatBalance, formatPackLabel, formatSignedBalance, formatTierLabel, formatWalletEntryLabel } from "../../lib/formatting";

export default function CollectionPage() {
  const [state, setState] = useState<WebState | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [openingPack, setOpeningPack] = useState<PackType | null>(null);
  const [recentOpen, setRecentOpen] = useState<PackOpenResult | null>(null);
  const router = useRouter();

  useEffect(() => {
    const isAuth = isAuthenticated();
    setAuthenticated(isAuth);

    if (!isAuth) {
      router.push("/login");
      return;
    }

    loadWebState({ requireAuth: true })
      .then((data) => {
        setState(data);
        setError("");
      })
      .catch((error) => {
        setState(null);
        setError(error instanceof Error ? error.message : "We couldn't load your cards.");
      });
  }, [router]);

  const handleOpenPack = async (packType: PackType) => {
    setOpeningPack(packType);
    setMessage("");

    try {
      const openedPack = await openPack({ packType });
      const nextState = await loadWebState({ requireAuth: true });
      setState(nextState);
      setRecentOpen(openedPack);
      setMessage(`${formatPackLabel(packType)} opened. ${openedPack.pulls.length} new cards added.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't open that pack.");
    } finally {
      setOpeningPack(null);
    }
  };

  if (authenticated === null) {
    return (
      <AppShell>
        <div className="loading">Loading your cards...</div>
      </AppShell>
    );
  }

  if (!authenticated) {
    return (
      <AppShell>
        <div className="auth-required">
          <h2>Sign in to see your cards</h2>
          <p>Use your username, then come back here.</p>
        </div>
      </AppShell>
    );
  }

  if (!state) {
    return (
      <AppShell>
        <div className="auth-required">
          <h2>We couldn’t load your cards</h2>
          <p>{error || "Please try again in a moment."}</p>
        </div>
      </AppShell>
    );
  }

  const playerMap = getPlayerMap(state.players);
  const availablePacks = state.packDefinitions.filter(
    (definition) => (state.packInventory[definition.packType] ?? 0) > 0
  );

  return (
    <AppShell>
      {message ? <div className="shop-feedback">{message}</div> : null}

      <div className="two-up">
        <SectionCard title="Your Cards" eyebrow={`${state.profile.displayName} · ${formatBalance(state.wallet.balance)}`}>
          <CardShelf title="Cards you own" cards={state.cards} players={playerMap} />
        </SectionCard>

        <SectionCard title="Packs Ready" eyebrow="Open what you already own">
          {availablePacks.length > 0 ? (
            <div className="offer-grid">
              {availablePacks.map((definition) => {
                const count = state.packInventory[definition.packType] ?? 0;
                return (
                  <article className="offer-card" key={definition.id}>
                    <p className="cc-eyebrow">{formatPackLabel(definition.packType)}</p>
                    <h3>{definition.title}</h3>
                    <p>{definition.description}</p>
                    <div className="offer-footer">
                      <strong>{count} ready</strong>
                      <button
                        className="buy-button"
                        type="button"
                        onClick={() => handleOpenPack(definition.packType)}
                        disabled={openingPack === definition.packType}
                      >
                        {openingPack === definition.packType ? "Opening..." : "Open Pack"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">No packs waiting. Buy one in the shop when you’re ready.</p>
          )}
        </SectionCard>
      </div>

      {recentOpen ? (
        <SectionCard title="New Cards" eyebrow={formatPackLabel(recentOpen.packType)}>
          <div className="ledger-grid">
            {recentOpen.pulls.map((pull) => {
              const player = playerMap.get(pull.playerId);
              return (
                <article className="ledger-card" key={pull.cardId}>
                  <p className="cc-eyebrow">{formatTierLabel(pull.tier)}</p>
                  <h3>{player?.fullName ?? pull.playerId}</h3>
                  <p>Card #{pull.serialNumber}</p>
                </article>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Balance History" eyebrow="What came in and what went out">
        <div className="ledger-grid">
          {state.walletLedger.map((entry) => (
            <article className="ledger-card" key={entry.id}>
              <p className="cc-eyebrow">{formatWalletEntryLabel(entry.entryType)}</p>
              <h3>{formatSignedBalance(entry.amount)}</h3>
              <p>{entry.description}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
