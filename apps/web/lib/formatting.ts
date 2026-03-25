import { CardTier, NotificationKind, PackType, WalletEntryType } from "@court-cash/domain";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

const walletEntryLabels: Record<WalletEntryType, string> = {
  ONBOARDING_GRANT: "Welcome bonus",
  DAILY_CLAIM: "Daily bonus",
  PACK_PURCHASE: "Pack bought",
  CARD_PURCHASE: "Card bought",
  MARKETPLACE_BUY: "Market buy",
  MARKETPLACE_SALE: "Card sold",
  MARKETPLACE_FEE: "Market fee",
  ADMIN_GRANT: "Added by the team"
};

const notificationLabels: Record<NotificationKind, string> = {
  SALE_COMPLETE: "Sale complete",
  SHOP_ROTATION: "Shop update",
  RANKING_REFRESH: "Player list update",
  MARKET_ALERT: "Market alert"
};

const packLabels: Record<PackType, string> = {
  STARTER: "Starter pack",
  COMMON: "Common pack",
  RARE: "Rare pack",
  LEGENDARY: "Legendary pack"
};

export function formatBalance(amount: number): string {
  return `${numberFormatter.format(amount)} CC`;
}

export function formatSignedBalance(amount: number): string {
  return `${amount > 0 ? "+" : ""}${numberFormatter.format(amount)} CC`;
}

export function formatTierLabel(tier: CardTier): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

export function formatWalletEntryLabel(entryType: WalletEntryType): string {
  return walletEntryLabels[entryType] ?? entryType.toLowerCase();
}

export function formatNotificationLabel(kind: NotificationKind): string {
  return notificationLabels[kind] ?? kind.toLowerCase();
}

export function formatPackLabel(packType: PackType): string {
  return packLabels[packType] ?? packType.toLowerCase();
}
