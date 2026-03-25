import {
  CardInstance,
  getDemoAppState,
  getPlayerById,
  MarketplaceListing,
  Notification,
  OfferPurchaseResult,
  PackDefinition,
  PackInventory,
  PackOpenResult,
  Player,
  PlayerSnapshot,
  RankingSnapshot,
  ShopOffer,
  UserProfile,
  WalletBalance,
  WalletLedgerEntry
} from "@court-cash/domain";
import { rankPlayersByQuery } from "./playerSearch";

const demoState = getDemoAppState();
const demoUserId = "user-demo";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:8000";
const sessionEventName = "court-cash-session";

// Authentication helpers
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken');
  }
  return null;
}

export function getCurrentUserId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('userId');
  }
  return null;
}

export function isAuthenticated(): boolean {
  return !!getAuthToken() && !!getCurrentUserId();
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('displayName');
    localStorage.removeItem('walletBalance');
    emitSessionUpdate();
  }
}

export function saveSession(auth: AuthResponse) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem("authToken", auth.token);
  localStorage.setItem("userId", auth.user.id);
  localStorage.setItem("username", auth.user.username);
  localStorage.setItem("displayName", auth.user.displayName);
  storeWalletBalance(auth.wallet.balance);
}

export function storeWalletBalance(balance: number) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem("walletBalance", balance.toFixed(2));
  emitSessionUpdate();
}

export function getStoredWalletBalance(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("walletBalance");
}

function emitSessionUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(sessionEventName));
  }
}

export function getSessionEventName() {
  return sessionEventName;
}

// Authentication API functions
export interface AuthResponse {
  user: UserProfile;
  token: string;
  wallet: WalletBalance;
}

export interface LoginRequest {
  username: string;
}

export interface RegisterRequest {
  username: string;
  display_name: string;
  home_court?: string;
}

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${apiBase}/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Login failed');
  }

  return response.json();
}

export async function register(request: RegisterRequest): Promise<AuthResponse> {
  const response = await fetch(`${apiBase}/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Registration failed');
  }

  return response.json();
}

export async function getCurrentUser(): Promise<UserProfile> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Please sign in first.");
  }

  const response = await fetch(`${apiBase}/v1/auth/me`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      logout(); // Clear invalid token
    }
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to get user');
  }

  return response.json();
}

export async function searchPlayers(query: string, fallbackPlayers: Player[] = [], limit = 8): Promise<Player[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return fallbackPlayers.slice(0, limit);
  }

  const params = new URLSearchParams({
    query: trimmedQuery,
    limit: String(limit)
  });

  try {
    const response = await fetch(`${apiBase}/v1/players?${params.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return rankPlayersByQuery(fallbackPlayers, trimmedQuery).slice(0, limit);
    }

    return (await response.json()) as Player[];
  } catch {
    return rankPlayersByQuery(fallbackPlayers, trimmedQuery).slice(0, limit);
  }
}

export interface WebState {
  players: Player[];
  rankingSnapshot: RankingSnapshot;
  wallet: WalletBalance;
  walletLedger: WalletLedgerEntry[];
  profile: UserProfile;
  notifications: Notification[];
  cards: CardInstance[];
  packDefinitions: PackDefinition[];
  packInventory: PackInventory;
  shopOffers: ShopOffer[];
  marketplaceListings: MarketplaceListing[];
}

export async function loadWebState(options: { requireAuth?: boolean } = {}): Promise<WebState> {
  const fallback = buildFallbackState();
  const token = getAuthToken();
  const userId = getCurrentUserId();
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders.Authorization = `Bearer ${token}`;
  }

  const [rankingSnapshot, players, shopOffers, marketplaceListings, packDefinitions] = await Promise.all([
    fetchOptionalJson<RankingSnapshot>("/v1/rankings/current"),
    fetchOptionalJson<Player[]>("/v1/players"),
    fetchOptionalJson<ShopOffer[]>("/v1/shop/offers"),
    fetchOptionalJson<MarketplaceListing[]>("/v1/marketplace/listings"),
    fetchOptionalJson<PackDefinition[]>("/v1/packs/definitions")
  ]);

  const publicState = {
    rankingSnapshot: rankingSnapshot ?? fallback.rankingSnapshot,
    players: players ?? fallback.players,
    shopOffers: shopOffers ?? fallback.shopOffers,
    marketplaceListings: marketplaceListings ?? fallback.marketplaceListings,
    packDefinitions: packDefinitions ?? fallback.packDefinitions
  };

  if (!token || !userId) {
    if (options.requireAuth) {
      throw new Error("Please sign in first.");
    }

    return {
      ...fallback,
      ...publicState
    };
  }

  try {
    const [wallet, walletLedger, notifications, cards, packInventory, profile] =
      await Promise.all([
        fetchRequiredJson<WalletBalance>(`/v1/wallet?user_id=${userId}`, authHeaders),
        fetchRequiredJson<WalletLedgerEntry[]>(`/v1/wallet/ledger?user_id=${userId}`, authHeaders),
        fetchRequiredJson<Notification[]>(`/v1/notifications?user_id=${userId}`, authHeaders),
        fetchRequiredJson<CardInstance[]>(`/v1/users/${userId}/cards`, authHeaders),
        fetchRequiredJson<PackInventory>(`/v1/packs/inventory?user_id=${userId}`, authHeaders),
        fetchRequiredJson<UserProfile>("/v1/auth/me", authHeaders)
      ]);

    storeWalletBalance(wallet.balance);

    if (typeof window !== "undefined") {
      localStorage.setItem("username", profile.username);
      localStorage.setItem("displayName", profile.displayName);
    }

    return {
      ...publicState,
      wallet,
      walletLedger,
      cards,
      packInventory,
      profile,
      notifications
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      logout();
    }

    if (options.requireAuth) {
      throw error;
    }

    return {
      ...fallback,
      ...publicState
    };
  }
}

export function getSnapshotMap(snapshot: RankingSnapshot): Map<string, PlayerSnapshot> {
  return new Map(snapshot.players.map((player) => [player.playerId, player]));
}

export function getPlayerMap(players: Player[]): Map<string, Player> {
  return new Map(players.map((player) => [player.id, player]));
}

export async function purchaseOffer(offerId: string): Promise<OfferPurchaseResult> {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error("Please sign in first.");
  }

  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase}/v1/shop/offers/${offerId}/purchase`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: userId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "We couldn't finish that purchase.");
  }

  const payload = (await response.json()) as OfferPurchaseResult;
  storeWalletBalance(payload.wallet.balance);
  return payload;
}

export async function openPack(request: { packType: string; userId?: string }): Promise<PackOpenResult> {
  const userId = getCurrentUserId() || request.userId;
  if (!userId) {
    throw new Error("Please sign in first.");
  }

  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase}/v1/packs/open`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: userId,
      pack_type: request.packType,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "We couldn't open that pack.");
  }

  const payload = (await response.json()) as PackOpenResult;
  if (typeof payload?.remainingBalance === "number") {
    storeWalletBalance(payload.remainingBalance);
  }
  return payload;
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
    packDefinitions: demoState.packDefinitions,
    packInventory: demoState.packInventoryByUser[demoUserId] ?? {},
    shopOffers: demoState.shopOffers,
    marketplaceListings: demoState.marketplaceListings.filter((listing) => listing.status === "ACTIVE")
  };
}

class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchOptionalJson<T>(path: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      cache: "no-store",
      headers: headers || {}
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchRequiredJson<T>(path: string, headers?: Record<string, string>): Promise<T> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      cache: "no-store",
      headers: headers || {}
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ApiError(errorData?.detail || "Request failed.", response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError("We couldn't reach the server.");
  }
}
