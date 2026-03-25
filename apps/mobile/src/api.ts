import {
  CardInstance,
  getDemoAppState,
  getPlayerById,
  MarketplaceListing,
  Notification,
  Player,
  RankingSnapshot,
  ShopOffer,
  WalletBalance
} from "@court-cash/domain";

const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
const demoState = getDemoAppState();
const demoUserId = "user-demo";

export interface MobileState {
  players: Player[];
  rankingSnapshot: RankingSnapshot;
  wallet: WalletBalance;
  cards: CardInstance[];
  shopOffers: ShopOffer[];
  listings: MarketplaceListing[];
  notifications: Notification[];
}

export async function loadMobileState(): Promise<MobileState> {
  const fallback = buildFallbackState();

  if (!apiBase) {
    return fallback;
  }

  try {
    const [rankingSnapshot, players, wallet, cards, shopOffers, listings] = await Promise.all([
      fetchJson<RankingSnapshot>("/v1/rankings/current"),
      fetchJson<Player[]>("/v1/players"),
      fetchJson<WalletBalance>(`/v1/wallet?user_id=${demoUserId}`),
      fetchJson<CardInstance[]>(`/v1/users/${demoUserId}/cards`),
      fetchJson<ShopOffer[]>("/v1/shop/offers"),
      fetchJson<MarketplaceListing[]>("/v1/marketplace/listings")
    ]);

    return {
      rankingSnapshot: rankingSnapshot ?? fallback.rankingSnapshot,
      players: players ?? fallback.players,
      wallet: wallet ?? fallback.wallet,
      cards: cards ?? fallback.cards,
      shopOffers: shopOffers ?? fallback.shopOffers,
      listings: listings ?? fallback.listings,
      notifications: fallback.notifications
    };
  } catch {
    return fallback;
  }
}

function buildFallbackState(): MobileState {
  const wallet = demoState.wallets.find((entry) => entry.userId === demoUserId);

  if (!wallet) {
    throw new Error("Missing wallet state");
  }

  return {
    players: demoState.rankingSnapshot.players
      .map((snapshot) => getPlayerById(snapshot.playerId))
      .filter((player): player is Player => Boolean(player)),
    rankingSnapshot: demoState.rankingSnapshot,
    wallet,
    cards: demoState.cards.filter((card) => card.ownerUserId === demoUserId),
    shopOffers: demoState.shopOffers,
    listings: demoState.marketplaceListings.filter((listing) => listing.status === "ACTIVE"),
    notifications: demoState.notifications.filter((entry) => entry.userId === demoUserId)
  };
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}
