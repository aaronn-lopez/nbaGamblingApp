"use client";

import { PackOpenResult, PackType } from "@court-cash/domain";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@court-cash/ui";
import { AppShell } from "../../components/AppShell";
import { getPlayerMap, isAuthenticated, loadWebState, openPack, purchaseOffer, WebState } from "../../lib/api";
import { formatBalance, formatPackLabel, formatTierLabel } from "../../lib/formatting";

export default function ShopPage() {
  const [state, setState] = useState<WebState | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [openingPack, setOpeningPack] = useState<PackType | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
        setError(error instanceof Error ? error.message : "We couldn't load the shop.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handlePurchase = async (offerId: string) => {
    if (!state || !authenticated) {
      return;
    }

    setPurchasing(offerId);
    setMessage("");

    try {
      const purchase = await purchaseOffer(offerId);
      const nextState = await loadWebState({ requireAuth: true });
      setState(nextState);

      if (purchase.offer.offerType === "PACK" && purchase.offer.packType) {
        const packCount = nextState.packInventory[purchase.offer.packType] ?? 0;
        setMessage(`${purchase.offer.title} bought. ${packCount} ready to open above.`);
        return;
      }

      setMessage(`${purchase.offer.title} added to your cards.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't finish that purchase.");
    } finally {
      setPurchasing(null);
    }
  };

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

  if (loading) {
    return (
      <AppShell>
        <div className="loading">Loading shop...</div>
      </AppShell>
    );
  }

  if (!authenticated) {
    return (
      <AppShell>
        <div className="auth-required">
          <h2>Sign in to open the shop</h2>
          <p>Use your username, then come back here.</p>
        </div>
      </AppShell>
    );
  }

  if (!state) {
    return (
      <AppShell>
        <div className="auth-required">
          <h2>We couldn’t load the shop</h2>
          <p>{error || "Please try again in a moment."}</p>
        </div>
      </AppShell>
    );
  }

  const playerMap = getPlayerMap(state.players);
  const packOffers = state.shopOffers.filter((offer) => offer.offerType === "PACK");
  const featuredOffers = state.shopOffers.filter((offer) => offer.offerType === "FEATURED_CARD");
  const availablePacks = state.packDefinitions.filter(
    (definition) => (state.packInventory[definition.packType] ?? 0) > 0
  );

  return (
    <AppShell>
      <section className="hero compact">
        <div className="cc-ribbon cc-ribbon-warm">
          <span>Current balance</span>
          <strong>{formatBalance(state.wallet.balance)}</strong>
        </div>
        <div className="cc-ribbon cc-ribbon-cool">
          <span>Packs ready</span>
          <strong>{availablePacks.reduce((total, definition) => total + (state.packInventory[definition.packType] ?? 0), 0)}</strong>
        </div>
        <div className="cc-ribbon cc-ribbon-gold">
          <span>Cards owned</span>
          <strong>{state.cards.length}</strong>
        </div>
      </section>

      {message ? <div className="shop-feedback">{message}</div> : null}

      <SectionCard title="Open Your Packs" eyebrow="Starter packs and bought packs show up here">
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
          <p className="empty-state">No packs ready right now. Buy one below.</p>
        )}
      </SectionCard>

      {recentOpen ? (
        <SectionCard title="Last Pack" eyebrow={formatPackLabel(recentOpen.packType)}>
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

      <SectionCard title="Packs to Buy" eyebrow="Buy now, then open them above">
        <div className="offer-grid">
          {packOffers.map((offer) => (
            <article className="offer-card" key={offer.id}>
              <p className="cc-eyebrow">{offer.packType ? formatPackLabel(offer.packType) : "Pack"}</p>
              <h3>{offer.title}</h3>
              <p>{offer.description}</p>
              <div className="offer-footer">
                <strong>{formatBalance(offer.price)}</strong>
                <button
                  className="buy-button"
                  onClick={() => handlePurchase(offer.id)}
                  disabled={purchasing === offer.id || state.wallet.balance < offer.price}
                >
                  {purchasing === offer.id ? "Buying..." : "Buy Pack"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Featured Cards" eyebrow="Buy a player card right away">
        <div className="offer-grid">
          {featuredOffers.map((offer) => (
            <article className="offer-card" key={offer.id}>
              <p className="cc-eyebrow">{offer.tier ? formatTierLabel(offer.tier) : "Featured"}</p>
              <h3>{offer.title}</h3>
              <p>{offer.description}</p>
              <div className="offer-footer">
                <strong>{formatBalance(offer.price)}</strong>
                <button
                  className="buy-button"
                  onClick={() => handlePurchase(offer.id)}
                  disabled={purchasing === offer.id || state.wallet.balance < offer.price}
                >
                  {purchasing === offer.id ? "Buying..." : "Buy Card"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
