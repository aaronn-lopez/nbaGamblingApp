import { useDeferredValue, useEffect, useMemo, useState, startTransition } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { loadMobileState, MobileState } from "./src/api";
import { NavButton, StatChip, Surface } from "./src/components/Surface";

type Tab = "home" | "rankings" | "collection" | "market" | "admin";

export default function App() {
  const [state, setState] = useState<MobileState | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let cancelled = false;

    loadMobileState().then((nextState) => {
      if (!cancelled) {
        setState(nextState);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSnapshots = useMemo(() => {
    if (!state) {
      return [];
    }

    const term = deferredSearch.trim().toLowerCase();
    if (!term) {
      return state.rankingSnapshot.players;
    }

    return state.rankingSnapshot.players.filter((snapshot) => {
      const player = state.players.find((entry) => entry.id === snapshot.playerId);
      return player?.fullName.toLowerCase().includes(term) ?? false;
    });
  }, [deferredSearch, state]);

  if (!state) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#f05a28" />
          <Text style={styles.loadingText}>Loading Court Cash HQ…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const topSnapshot = state.rankingSnapshot.players[0];
  const topPlayer = state.players.find((player) => player.id === topSnapshot.playerId);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Court Cash HQ</Text>
          <Text style={styles.heroTitle}>Trade serialized NBA cards with a weekly predictive board.</Text>
          <Text style={styles.heroBody}>
            Mobile and web stay aligned through shared domain types, backend-settled purchases, and snapshot-based
            minting.
          </Text>
        </View>

        <View style={styles.navRow}>
          {(["home", "rankings", "collection", "market", "admin"] as Tab[]).map((nextTab) => (
            <NavButton key={nextTab} active={tab === nextTab} label={labelForTab(nextTab)} onPress={() => setTab(nextTab)} />
          ))}
        </View>

        <View style={styles.metricRow}>
          <StatChip label="Wallet" value={`${state.wallet.balance} CC`} />
          <StatChip label="Model" value={state.rankingSnapshot.modelVersion} tone="cool" />
          <StatChip label="Listings" value={String(state.listings.length)} tone="gold" />
        </View>

        {tab === "home" ? (
          <>
            <Surface eyebrow="Top projection" title={topPlayer?.fullName ?? "Unknown"}>
              <Text style={styles.copy}>
                {topPlayer?.team} {topPlayer?.position} leads the board at {topSnapshot.playerPowerScore} power score
                with a {topSnapshot.trendLabel} signal.
              </Text>
            </Surface>
            <Surface eyebrow="Unread" title="Notification center">
              {state.notifications.map((entry) => (
                <View key={entry.id} style={styles.itemCard}>
                  <Text style={styles.itemEyebrow}>{entry.kind.replaceAll("_", " ")}</Text>
                  <Text style={styles.itemTitle}>{entry.title}</Text>
                  <Text style={styles.copy}>{entry.body}</Text>
                </View>
              ))}
            </Surface>
          </>
        ) : null}

        {tab === "rankings" ? (
          <Surface eyebrow={state.rankingSnapshot.label} title="Weekly rankings">
            <TextInput
              placeholder="Search players"
              placeholderTextColor="rgba(17,17,17,0.45)"
              style={styles.searchInput}
              value={search}
              onChangeText={(value) => {
                startTransition(() => setSearch(value));
              }}
            />
            {filteredSnapshots.map((snapshot, index) => {
              const player = state.players.find((entry) => entry.id === snapshot.playerId);
              return (
                <View style={styles.itemCard} key={snapshot.playerId}>
                  <Text style={styles.itemEyebrow}>
                    #{index + 1} · {snapshot.tier}
                  </Text>
                  <Text style={styles.itemTitle}>{player?.fullName}</Text>
                  <Text style={styles.copy}>
                    {player?.team} · {snapshot.playerPowerScore} projection · {snapshot.percentile}% percentile ·{" "}
                    {snapshot.trendLabel}
                  </Text>
                </View>
              );
            })}
          </Surface>
        ) : null}

        {tab === "collection" ? (
          <Surface eyebrow="Owned cards" title="Serialized collection">
            {state.cards.map((card) => {
              const player = state.players.find((entry) => entry.id === card.playerId);
              return (
                <View style={styles.itemCard} key={card.id}>
                  <Text style={styles.itemEyebrow}>
                    {card.tierAtMint} · #{card.serialNumber}
                  </Text>
                  <Text style={styles.itemTitle}>{player?.fullName}</Text>
                  <Text style={styles.copy}>
                    {player?.team} · {card.edition} edition · minted from {card.mintedRankingSnapshotId}
                  </Text>
                </View>
              );
            })}
          </Surface>
        ) : null}

        {tab === "market" ? (
          <>
            <Surface eyebrow="Live offers" title="Shop">
              {state.shopOffers.map((offer) => (
                <View style={styles.itemCard} key={offer.id}>
                  <Text style={styles.itemEyebrow}>{offer.offerType}</Text>
                  <Text style={styles.itemTitle}>{offer.title}</Text>
                  <Text style={styles.copy}>{offer.description}</Text>
                  <Text style={styles.price}>{offer.price} CC</Text>
                </View>
              ))}
            </Surface>
            <Surface eyebrow="Fixed price" title="Marketplace">
              {state.listings.map((listing) => {
                const player = state.players.find((entry) => entry.id === listing.playerId);
                return (
                  <View style={styles.itemCard} key={listing.id}>
                    <Text style={styles.itemEyebrow}>
                      {listing.tierAtMint} · #{listing.serialNumber}
                    </Text>
                    <Text style={styles.itemTitle}>{player?.fullName}</Text>
                    <Text style={styles.copy}>
                      Expires {new Date(listing.expiresAt).toLocaleDateString()} · settled server-side
                    </Text>
                    <Text style={styles.price}>{listing.askingPrice} CC</Text>
                  </View>
                );
              })}
            </Surface>
          </>
        ) : null}

        {tab === "admin" ? (
          <Surface eyebrow="Operations" title="Admin pulse">
            <View style={styles.itemCard}>
              <Text style={styles.itemEyebrow}>Ranking publish</Text>
              <Text style={styles.itemTitle}>{state.rankingSnapshot.modelVersion}</Text>
              <Text style={styles.copy}>Snapshot cadence is weekly with Sunday-close publish and tier recomputation.</Text>
            </View>
            <View style={styles.itemCard}>
              <Text style={styles.itemEyebrow}>Market controls</Text>
              <Text style={styles.itemTitle}>5% marketplace burn</Text>
              <Text style={styles.copy}>Listings, purchases, and fee routing remain API-gated for atomic settlement.</Text>
            </View>
            <Pressable style={styles.adminButton}>
              <Text style={styles.adminButtonText}>Review flagged listings</Text>
            </Pressable>
          </Surface>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function labelForTab(tab: Tab): string {
  switch (tab) {
    case "home":
      return "Home";
    case "rankings":
      return "Rank";
    case "collection":
      return "Cards";
    case "market":
      return "Market";
    case "admin":
      return "Admin";
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7f2e8"
  },
  content: {
    padding: 16,
    gap: 18
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14
  },
  loadingText: {
    fontSize: 16,
    color: "#111111"
  },
  hero: {
    padding: 24,
    borderRadius: 32,
    backgroundColor: "#111111",
    gap: 12
  },
  eyebrow: {
    color: "rgba(255, 250, 243, 0.72)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    fontWeight: "700"
  },
  heroTitle: {
    color: "#fffaf3",
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "800"
  },
  heroBody: {
    color: "rgba(255, 250, 243, 0.78)",
    fontSize: 15,
    lineHeight: 22
  },
  navRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metricRow: {
    flexDirection: "row",
    gap: 12
  },
  copy: {
    fontSize: 15,
    color: "rgba(17, 17, 17, 0.72)",
    lineHeight: 22
  },
  itemCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.68)",
    gap: 8
  },
  itemEyebrow: {
    fontSize: 12,
    color: "rgba(17, 17, 17, 0.56)",
    textTransform: "uppercase",
    letterSpacing: 1.3,
    fontWeight: "700"
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111111"
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    color: "#b33a1f"
  },
  searchInput: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "rgba(17,17,17,0.06)",
    color: "#111111"
  },
  adminButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: "#111111",
    alignItems: "center"
  },
  adminButtonText: {
    color: "#fffaf3",
    fontWeight: "700"
  }
});
