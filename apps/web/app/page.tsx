'use client';

import { useEffect, useState } from "react";
import { getPlayerMap, loadWebState, WebState } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { CardShelf, ListingRow, MetricRibbon, PlayerSpotlight, SectionCard } from "@court-cash/ui";
import { formatBalance, formatSignedBalance, formatWalletEntryLabel } from "../lib/formatting";

export default function HomePage() {
  const [state, setState] = useState<WebState | null>(null);

  useEffect(() => {
    loadWebState().then(setState).catch(() => setState(null));
  }, []);

  if (!state) {
    return (
      <AppShell>
        <div className="loading">Loading home...</div>
      </AppShell>
    );
  }

  const playerMap = getPlayerMap(state.players);
  const topPlayer = state.rankingSnapshot.players[0];
  const topPerformer = playerMap.get(topPlayer.playerId);

  return (
    <AppShell>
      <section className="hero">
        <div className="hero-copy">
          <p className="cc-eyebrow">Build your collection</p>
          <h2>Open packs, buy the players you want, and watch your balance as you go.</h2>
          <p>
            Start with free Court Cash, open your starter pack, and keep tabs on your cards in one place.
          </p>
        </div>
        <div className="hero-ribbons">
          <MetricRibbon label="Your balance" value={formatBalance(state.wallet.balance)} />
          <MetricRibbon label="Items in shop" value={String(state.shopOffers.length)} tone="cool" />
          <MetricRibbon label="Cards for sale" value={String(state.marketplaceListings.length)} tone="gold" />
        </div>
      </section>

      <div className="two-up">
        {topPerformer ? (
          <PlayerSpotlight
            player={topPerformer}
            snapshot={topPlayer}
            subtitle={`${topPerformer.fullName} is one of the hottest names in the game right now.`}
          />
        ) : null}
        <SectionCard title="How it works" eyebrow="Quick start">
          <ul className="plain-list">
            <li>Create a username and get free Court Cash.</li>
            <li>Open your starter pack or buy another pack from the shop.</li>
            <li>Keep the cards you like and watch your collection grow.</li>
            <li>Check the players page to see who is moving up.</li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Your Cards" eyebrow={`${state.profile.displayName} · ${state.cards.length} cards`}>
        <CardShelf title="Collection" cards={state.cards} players={playerMap} />
      </SectionCard>

      <SectionCard title="Cards People Are Selling" eyebrow="Card market">
        <div className="listing-stack">
          {state.marketplaceListings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} player={playerMap.get(listing.playerId)} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Recent Money Moves" eyebrow="Your balance">
        <div className="ledger-grid">
          {state.walletLedger.slice(0, 4).map((entry) => (
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
