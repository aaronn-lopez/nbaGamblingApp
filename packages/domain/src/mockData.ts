import {
  CardInstance,
  CardTemplate,
  DemoAppState,
  MarketplaceListing,
  Notification,
  PackDefinition,
  Player,
  ShopOffer,
  UserProfile,
  WalletBalance,
  WalletLedgerEntry
} from "./types";
import { buildRankingSnapshot, RankingSeed } from "./ranking";

const users: UserProfile[] = [
  {
    id: "user-demo",
    username: "fullcourtwill",
    displayName: "Will Desai",
    avatarSeed: "midrange-sun",
    homeCourt: "Vancouver",
    joinedAt: "2026-03-01T08:00:00Z"
  },
  {
    id: "user-rival",
    username: "baselineboss",
    displayName: "Baseline Boss",
    avatarSeed: "trade-floor",
    homeCourt: "Seattle",
    joinedAt: "2026-02-20T08:00:00Z"
  }
];

const rankingSeeds: RankingSeed[] = [
  {
    id: "nikola-jokic",
    slug: "nikola-jokic",
    fullName: "Nikola Jokic",
    team: "DEN",
    position: "C",
    recentPra: 47.4,
    seasonPra: 44.8,
    minutesTrend: 0.31,
    availabilityScore: 0.97,
    teamPace: 98.7,
    upcomingGames: 4
  },
  {
    id: "shai-gilgeous-alexander",
    slug: "shai-gilgeous-alexander",
    fullName: "Shai Gilgeous-Alexander",
    team: "OKC",
    position: "G",
    recentPra: 43.1,
    seasonPra: 41.9,
    minutesTrend: 0.24,
    availabilityScore: 0.96,
    teamPace: 100.4,
    upcomingGames: 4
  },
  {
    id: "luka-doncic",
    slug: "luka-doncic",
    fullName: "Luka Doncic",
    team: "LAL",
    position: "G",
    recentPra: 45.2,
    seasonPra: 43.7,
    minutesTrend: 0.12,
    availabilityScore: 0.84,
    teamPace: 99.6,
    upcomingGames: 3
  },
  {
    id: "giannis-antetokounmpo",
    slug: "giannis-antetokounmpo",
    fullName: "Giannis Antetokounmpo",
    team: "MIL",
    position: "F",
    recentPra: 44.3,
    seasonPra: 42.8,
    minutesTrend: 0.18,
    availabilityScore: 0.89,
    teamPace: 100.1,
    upcomingGames: 4
  },
  {
    id: "victor-wembanyama",
    slug: "victor-wembanyama",
    fullName: "Victor Wembanyama",
    team: "SAS",
    position: "C",
    recentPra: 42.8,
    seasonPra: 39.5,
    minutesTrend: 0.65,
    availabilityScore: 0.9,
    teamPace: 101.9,
    upcomingGames: 4
  },
  {
    id: "jayson-tatum",
    slug: "jayson-tatum",
    fullName: "Jayson Tatum",
    team: "BOS",
    position: "F",
    recentPra: 39.9,
    seasonPra: 38.7,
    minutesTrend: 0.05,
    availabilityScore: 0.98,
    teamPace: 99.1,
    upcomingGames: 3
  },
  {
    id: "anthony-edwards",
    slug: "anthony-edwards",
    fullName: "Anthony Edwards",
    team: "MIN",
    position: "G",
    recentPra: 37.3,
    seasonPra: 36.1,
    minutesTrend: 0.27,
    availabilityScore: 0.95,
    teamPace: 98.8,
    upcomingGames: 4
  },
  {
    id: "jalen-brunson",
    slug: "jalen-brunson",
    fullName: "Jalen Brunson",
    team: "NYK",
    position: "G",
    recentPra: 36.5,
    seasonPra: 35.8,
    minutesTrend: 0.11,
    availabilityScore: 0.87,
    teamPace: 97.8,
    upcomingGames: 4
  },
  {
    id: "paolo-banchero",
    slug: "paolo-banchero",
    fullName: "Paolo Banchero",
    team: "ORL",
    position: "F",
    recentPra: 34.2,
    seasonPra: 33.8,
    minutesTrend: 0.33,
    availabilityScore: 0.9,
    teamPace: 98.5,
    upcomingGames: 4
  },
  {
    id: "donovan-mitchell",
    slug: "donovan-mitchell",
    fullName: "Donovan Mitchell",
    team: "CLE",
    position: "G",
    recentPra: 34.8,
    seasonPra: 34.4,
    minutesTrend: -0.06,
    availabilityScore: 0.82,
    teamPace: 97.2,
    upcomingGames: 3
  },
  {
    id: "tyrese-haliburton",
    slug: "tyrese-haliburton",
    fullName: "Tyrese Haliburton",
    team: "IND",
    position: "G",
    recentPra: 33.1,
    seasonPra: 32.7,
    minutesTrend: 0.09,
    availabilityScore: 0.8,
    teamPace: 102.3,
    upcomingGames: 4
  },
  {
    id: "amen-thompson",
    slug: "amen-thompson",
    fullName: "Amen Thompson",
    team: "HOU",
    position: "F",
    recentPra: 26.4,
    seasonPra: 24.1,
    minutesTrend: 0.74,
    availabilityScore: 0.95,
    teamPace: 100.8,
    upcomingGames: 4
  }
];

export const rankingSnapshot = buildRankingSnapshot(rankingSeeds, {
  id: "ranking-2026-week-13",
  label: "Week 13 Projection",
  publishedAt: "2026-03-24T06:00:00Z",
  weekStart: "2026-03-24",
  weekEnd: "2026-03-30",
  modelVersion: "predictive-v1"
});

const playerIndex = new Map<string, Player>(
  rankingSeeds.map((player) => [
    player.id,
    {
      id: player.id,
      slug: player.slug,
      fullName: player.fullName,
      team: player.team,
      position: player.position
    }
  ])
);
const snapshotIndex = new Map(rankingSnapshot.players.map((snapshot) => [snapshot.playerId, snapshot]));

export const cardTemplates: CardTemplate[] = rankingSeeds.map((player, index) => ({
  id: `template-${player.id}`,
  playerId: player.id,
  season: "2025-26",
  edition: index < 4 ? "Founders" : "Pulse",
  cardStyle: index % 2 === 0 ? "Lacquer Foil" : "Concrete Prism",
  accentColor: ["#f05a28", "#0a6c74", "#d4a017", "#b23a48"][index % 4]
}));

export const cards: CardInstance[] = [
  createCard("card-jokic-11", "nikola-jokic", "user-demo", 11),
  createCard("card-wemby-84", "victor-wembanyama", "user-demo", 84),
  createCard("card-banchero-131", "paolo-banchero", "user-demo", 131),
  createCard("card-brunson-201", "jalen-brunson", "user-demo", 201),
  createCard("card-haliburton-301", "tyrese-haliburton", "user-rival", 301),
  createCard("card-ant-72", "anthony-edwards", "user-rival", 72),
  createCard("card-shai-16", "shai-gilgeous-alexander", "user-rival", 16),
  createCard("card-amen-401", "amen-thompson", "user-rival", 401)
];

export const packDefinitions: PackDefinition[] = [
  {
    id: "pack-starter",
    packType: "STARTER",
    title: "Starter Crate",
    description: "One-time onboarding grant with rookie-safe odds and three serialized pulls.",
    price: 0,
    cardsPerPack: 3,
    oddsByTier: {
      DIAMOND: 0.01,
      PLATINUM: 0.04,
      GOLD: 0.2,
      SILVER: 0.35,
      BRONZE: 0.28,
      IRON: 0.12
    }
  },
  {
    id: "pack-common",
    packType: "COMMON",
    title: "Common Run",
    description: "Entry pack for daily grinders with five cards and a steady bronze floor.",
    price: 120,
    cardsPerPack: 5,
    oddsByTier: {
      DIAMOND: 0.015,
      PLATINUM: 0.05,
      GOLD: 0.18,
      SILVER: 0.3,
      BRONZE: 0.29,
      IRON: 0.165
    }
  },
  {
    id: "pack-rare",
    packType: "RARE",
    title: "Rare Run",
    description: "Five-card premium pack tuned for gold and platinum inventory.",
    price: 560,
    cardsPerPack: 5,
    oddsByTier: {
      DIAMOND: 0.04,
      PLATINUM: 0.11,
      GOLD: 0.34,
      SILVER: 0.28,
      BRONZE: 0.16,
      IRON: 0.07
    }
  },
  {
    id: "pack-legendary",
    packType: "LEGENDARY",
    title: "Legendary Vault",
    description: "High-stakes premium pack with elevated diamond exposure and founders-card odds.",
    price: 2200,
    cardsPerPack: 5,
    oddsByTier: {
      DIAMOND: 0.1,
      PLATINUM: 0.24,
      GOLD: 0.32,
      SILVER: 0.19,
      BRONZE: 0.1,
      IRON: 0.05
    }
  }
];

export const shopOffers: ShopOffer[] = [
  {
    id: "offer-pack-common",
    offerType: "PACK",
    title: "Common Run",
    description: "Five cards with stable bronze and silver density.",
    price: 120,
    active: true,
    packType: "COMMON"
  },
  {
    id: "offer-pack-rare",
    offerType: "PACK",
    title: "Rare Run",
    description: "Gold-heavy weekly premium pack.",
    price: 560,
    active: true,
    packType: "RARE"
  },
  {
    id: "offer-featured-wemby",
    offerType: "FEATURED_CARD",
    title: "Victor Wembanyama Spotlight",
    description: "One serialized weekly featured card minted off the latest ranking snapshot.",
    price: 1350,
    active: true,
    playerId: "victor-wembanyama",
    tier: snapshotIndex.get("victor-wembanyama")?.tier
  },
  {
    id: "offer-featured-brunson",
    offerType: "FEATURED_CARD",
    title: "Jalen Brunson Spotlight",
    description: "Budget featured card for the active rotation tier.",
    price: 680,
    active: true,
    playerId: "jalen-brunson",
    tier: snapshotIndex.get("jalen-brunson")?.tier
  }
];

export const marketplaceListings: MarketplaceListing[] = [
  {
    id: "listing-ant-72",
    sellerUserId: "user-rival",
    cardInstanceId: "card-ant-72",
    playerId: "anthony-edwards",
    tierAtMint: getTier("anthony-edwards"),
    serialNumber: 72,
    askingPrice: 910,
    listedAt: "2026-03-24T09:00:00Z",
    expiresAt: "2026-03-26T09:00:00Z",
    status: "ACTIVE"
  },
  {
    id: "listing-haliburton-301",
    sellerUserId: "user-rival",
    cardInstanceId: "card-haliburton-301",
    playerId: "tyrese-haliburton",
    tierAtMint: getTier("tyrese-haliburton"),
    serialNumber: 301,
    askingPrice: 420,
    listedAt: "2026-03-24T11:00:00Z",
    expiresAt: "2026-03-27T11:00:00Z",
    status: "ACTIVE"
  }
];

export const walletLedger: WalletLedgerEntry[] = [
  {
    id: "ledger-1",
    userId: "user-demo",
    amount: 2000,
    entryType: "ONBOARDING_GRANT",
    description: "New account starter grant.",
    createdAt: "2026-03-01T08:05:00Z"
  },
  {
    id: "ledger-2",
    userId: "user-rival",
    amount: 2200,
    entryType: "ONBOARDING_GRANT",
    description: "New account starter grant.",
    createdAt: "2026-02-20T08:05:00Z"
  },
  {
    id: "ledger-3",
    userId: "user-demo",
    amount: -120,
    entryType: "PACK_PURCHASE",
    description: "Purchased Common Run.",
    createdAt: "2026-03-21T08:00:00Z",
    relatedEntityId: "offer-pack-common"
  },
  {
    id: "ledger-4",
    userId: "user-demo",
    amount: 200,
    entryType: "DAILY_CLAIM",
    description: "Daily claim bonus.",
    createdAt: "2026-03-23T08:00:00Z"
  }
];

export const wallets: WalletBalance[] = [
  buildWallet("user-demo", "2026-03-23T08:00:00Z"),
  buildWallet("user-rival"),
  buildWallet("system")
];

export const notifications: Notification[] = [
  {
    id: "notice-1",
    userId: "user-demo",
    kind: "RANKING_REFRESH",
    title: "Week 13 rankings are live",
    body: "Victor Wembanyama climbed into the diamond line after a surge in recent PRA and pace-adjusted minutes.",
    createdAt: "2026-03-24T06:10:00Z",
    read: false
  },
  {
    id: "notice-2",
    userId: "user-rival",
    kind: "SALE_COMPLETE",
    title: "Anthony Edwards sold",
    body: "Your Anthony Edwards #72 sold for 910 Court Cash. Fee withheld automatically.",
    createdAt: "2026-03-24T09:12:00Z",
    read: false
  }
];

export function getDemoAppState(): DemoAppState {
  return {
    users,
    rankingSnapshot,
    cardTemplates,
    cards,
    packDefinitions,
    shopOffers,
    marketplaceListings,
    marketplacePurchases: [],
    wallets,
    walletLedger,
    notifications
  };
}

function createCard(id: string, playerId: string, ownerUserId: string, serialNumber: number): CardInstance {
  return {
    id,
    templateId: `template-${playerId}`,
    ownerUserId,
    playerId,
    season: "2025-26",
    edition: serialNumber < 100 ? "Founders" : "Pulse",
    serialNumber,
    tierAtMint: getTier(playerId),
    mintedRankingSnapshotId: rankingSnapshot.id,
    mintedAt: "2026-03-24T06:05:00Z"
  };
}

function getTier(playerId: string) {
  const snapshot = snapshotIndex.get(playerId);
  if (!snapshot) {
    throw new Error(`Missing ranking snapshot for ${playerId}`);
  }
  return snapshot.tier;
}

function buildWallet(userId: string, lastClaimedAt?: string): WalletBalance {
  const balance = walletLedger
    .filter((entry) => entry.userId === userId)
    .reduce((total, entry) => total + entry.amount, 0);

  return {
    userId,
    currency: "COURT_CASH",
    balance: Number(balance.toFixed(2)),
    lastClaimedAt
  };
}

export function getPlayerName(playerId: string): string {
  return playerIndex.get(playerId)?.fullName ?? playerId;
}

export function getPlayerById(playerId: string) {
  return playerIndex.get(playerId);
}
