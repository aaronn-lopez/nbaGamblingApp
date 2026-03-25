import {
  CardInstance,
  getDemoAppState,
  getPlayerById,
  MarketplaceListing,
  Notification,
  Player,
  PlayerSnapshot,
  RankingSnapshot,
  ShopOffer,
  UserProfile,
  WalletBalance,
  WalletLedgerEntry
} from "@court-cash/domain";

const demoState = getDemoAppState();
const demoUserId = "user-demo";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface WebState {
  players: Player[];
  rankingSnapshot: RankingSnapshot;
  wallet: WalletBalance;
  walletLedger: WalletLedgerEntry[];
  profile: UserProfile;
  notifications: Notification[];
  cards: CardInstance[];
  shopOffers: ShopOffer[];
  marketplaceListings: MarketplaceListing[];
}

export async function loadWebState(): Promise<WebState> {
  const fallback = buildFallbackState();

  if (!apiBase) {
    return fallback;
  }

  try {
    const [rankingSnapshot, players, wallet, walletLedger, cards, shopOffers, marketplaceListings] =
      await Promise.all([
        fetchJson<RankingSnapshot>("/v1/rankings/current"),
        fetchJson<Player[]>("/v1/players"),
        fetchJson<WalletBalance>(`/v1/wallet?user_id=${demoUserId}`),
        fetchJson<WalletLedgerEntry[]>(`/v1/wallet/ledger?user_id=${demoUserId}`),
        fetchJson<CardInstance[]>(`/v1/users/${demoUserId}/cards`),
        fetchJson<ShopOffer[]>("/v1/shop/offers"),
        fetchJson<MarketplaceListing[]>("/v1/marketplace/listings")
      ]);

    return {
      rankingSnapshot: rankingSnapshot ?? fallback.rankingSnapshot,
      players: players ?? fallback.players,
      wallet: wallet ?? fallback.wallet,
      walletLedger: walletLedger ?? fallback.walletLedger,
      cards: cards ?? fallback.cards,
      shopOffers: shopOffers ?? fallback.shopOffers,
      marketplaceListings: marketplaceListings ?? fallback.marketplaceListings,
      profile: fallback.profile,
      notifications: fallback.notifications
    };
  } catch {
    return fallback;
  }
}

export function getSnapshotMap(snapshot: RankingSnapshot): Map<string, PlayerSnapshot> {
  return new Map(snapshot.players.map((player) => [player.playerId, player]));
}

export function getPlayerMap(players: Player[]): Map<string, Player> {
  return new Map(players.map((player) => [player.id, player]));
}

function buildFallbackState(): WebState {
  const profile = demoState.users.find((user) => user.id === demoUserId);
  const wallet = demoState.wallets.find((entry) => entry.userId === demoUserId);

  if (!profile || !wallet) {
    throw new Error("Missing demo state");
  }

  const players = demoState.rankingSnapshot.players
    .map((snapshot) => getPlayerById(snapshot.playerId))
    .filter((player): player is Player => Boolean(player));

  return {
    players,
    rankingSnapshot: demoState.rankingSnapshot,
    wallet,
    walletLedger: demoState.walletLedger.filter((entry) => entry.userId === demoUserId),
    profile,
    notifications: demoState.notifications.filter((entry) => entry.userId === demoUserId),
    cards: demoState.cards.filter((card) => card.ownerUserId === demoUserId),
    shopOffers: demoState.shopOffers,
    marketplaceListings: demoState.marketplaceListings.filter((listing) => listing.status === "ACTIVE")
  };
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`${apiBase}${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}
