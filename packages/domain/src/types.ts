export type CardTier =
  | "DIAMOND"
  | "PLATINUM"
  | "GOLD"
  | "SILVER"
  | "BRONZE"
  | "IRON";

export type PackType = "STARTER" | "COMMON" | "RARE" | "LEGENDARY";

export type ShopOfferType = "PACK" | "FEATURED_CARD";

export type WalletEntryType =
  | "ONBOARDING_GRANT"
  | "DAILY_CLAIM"
  | "PACK_PURCHASE"
  | "CARD_PURCHASE"
  | "MARKETPLACE_BUY"
  | "MARKETPLACE_SALE"
  | "MARKETPLACE_FEE"
  | "ADMIN_GRANT";

export type ListingStatus = "ACTIVE" | "SOLD" | "CANCELLED" | "EXPIRED";

export type NotificationKind =
  | "SALE_COMPLETE"
  | "SHOP_ROTATION"
  | "RANKING_REFRESH"
  | "MARKET_ALERT";

export interface Player {
  id: string;
  slug: string;
  fullName: string;
  team: string;
  position: string;
}

export interface PlayerFeatureSet {
  recentPra: number;
  seasonPra: number;
  minutesTrend: number;
  availabilityScore: number;
  teamPace: number;
  upcomingGames: number;
}

export interface PlayerSnapshot extends PlayerFeatureSet {
  playerId: string;
  weekLabel: string;
  playerPowerScore: number;
  percentile: number;
  tier: CardTier;
  trendLabel: string;
}

export interface RankingSnapshot {
  id: string;
  label: string;
  publishedAt: string;
  weekStart: string;
  weekEnd: string;
  cadence: "WEEKLY";
  modelVersion: string;
  active: boolean;
  players: PlayerSnapshot[];
}

export interface CardTemplate {
  id: string;
  playerId: string;
  season: string;
  edition: string;
  cardStyle: string;
  accentColor: string;
}

export interface CardInstance {
  id: string;
  templateId: string;
  ownerUserId: string;
  playerId: string;
  season: string;
  edition: string;
  serialNumber: number;
  tierAtMint: CardTier;
  mintedRankingSnapshotId: string;
  mintedAt: string;
}

export interface PackDefinition {
  id: string;
  packType: PackType;
  title: string;
  description: string;
  price: number;
  cardsPerPack: number;
  oddsByTier: Record<CardTier, number>;
}

export interface PackPullResult {
  cardId: string;
  playerId: string;
  tier: CardTier;
  serialNumber: number;
}

export interface PackOpenResult {
  packType: PackType;
  openedAt: string;
  remainingBalance: number;
  pulls: PackPullResult[];
}

export interface ShopOffer {
  id: string;
  offerType: ShopOfferType;
  title: string;
  description: string;
  price: number;
  active: boolean;
  packType?: PackType;
  playerId?: string;
  tier?: CardTier;
}

export interface MarketplaceListing {
  id: string;
  sellerUserId: string;
  cardInstanceId: string;
  playerId: string;
  tierAtMint: CardTier;
  serialNumber: number;
  askingPrice: number;
  listedAt: string;
  expiresAt: string;
  status: ListingStatus;
}

export interface MarketplacePurchase {
  id: string;
  listingId: string;
  buyerUserId: string;
  sellerUserId: string;
  cardInstanceId: string;
  price: number;
  feePaid: number;
  purchasedAt: string;
}

export interface WalletBalance {
  userId: string;
  currency: "COURT_CASH";
  balance: number;
  lastClaimedAt?: string;
}

export interface WalletLedgerEntry {
  id: string;
  userId: string;
  amount: number;
  entryType: WalletEntryType;
  description: string;
  createdAt: string;
  relatedEntityId?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  homeCourt: string;
  joinedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface DemoAppState {
  users: UserProfile[];
  rankingSnapshot: RankingSnapshot;
  cardTemplates: CardTemplate[];
  cards: CardInstance[];
  packDefinitions: PackDefinition[];
  shopOffers: ShopOffer[];
  marketplaceListings: MarketplaceListing[];
  marketplacePurchases: MarketplacePurchase[];
  wallets: WalletBalance[];
  walletLedger: WalletLedgerEntry[];
  notifications: Notification[];
}
