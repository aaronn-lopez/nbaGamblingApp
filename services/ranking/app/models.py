from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

CardTier = Literal["DIAMOND", "PLATINUM", "GOLD", "SILVER", "BRONZE", "IRON"]
PackType = Literal["STARTER", "COMMON", "RARE", "LEGENDARY"]
ShopOfferType = Literal["PACK", "FEATURED_CARD"]
WalletEntryType = Literal[
    "ONBOARDING_GRANT",
    "DAILY_CLAIM",
    "PACK_PURCHASE",
    "CARD_PURCHASE",
    "MARKETPLACE_BUY",
    "MARKETPLACE_SALE",
    "MARKETPLACE_FEE",
    "ADMIN_GRANT",
]
ListingStatus = Literal["ACTIVE", "SOLD", "CANCELLED", "EXPIRED"]
NotificationKind = Literal["SALE_COMPLETE", "SHOP_ROTATION", "RANKING_REFRESH", "MARKET_ALERT"]


class Player(CamelModel):
    id: str
    slug: str
    full_name: str
    team: str
    position: str


class PlayerFeatureSet(CamelModel):
    recent_pra: float
    season_pra: float
    minutes_trend: float
    availability_score: float
    team_pace: float
    upcoming_games: int


class PlayerSnapshot(PlayerFeatureSet):
    player_id: str
    week_label: str
    player_power_score: float
    percentile: float
    tier: CardTier
    trend_label: str


class RankingSnapshot(CamelModel):
    id: str
    label: str
    published_at: datetime
    week_start: str
    week_end: str
    cadence: Literal["WEEKLY"] = "WEEKLY"
    model_version: str
    active: bool
    players: list[PlayerSnapshot]


class CardTemplate(CamelModel):
    id: str
    player_id: str
    season: str
    edition: str
    card_style: str
    accent_color: str


class CardInstance(CamelModel):
    id: str
    template_id: str
    owner_user_id: str
    player_id: str
    season: str
    edition: str
    serial_number: int
    tier_at_mint: CardTier
    minted_ranking_snapshot_id: str
    minted_at: datetime


class PackDefinition(CamelModel):
    id: str
    pack_type: PackType
    title: str
    description: str
    price: float
    cards_per_pack: int
    odds_by_tier: dict[CardTier, float]


class PackPullResult(CamelModel):
    card_id: str
    player_id: str
    tier: CardTier
    serial_number: int


class PackOpenResult(CamelModel):
    pack_type: PackType
    opened_at: datetime
    remaining_balance: float
    pulls: list[PackPullResult]


class ShopOffer(CamelModel):
    id: str
    offer_type: ShopOfferType
    title: str
    description: str
    price: float
    active: bool
    pack_type: PackType | None = None
    player_id: str | None = None
    tier: CardTier | None = None


class MarketplaceListing(CamelModel):
    id: str
    seller_user_id: str
    card_instance_id: str
    player_id: str
    tier_at_mint: CardTier
    serial_number: int
    asking_price: float
    listed_at: datetime
    expires_at: datetime
    status: ListingStatus


class MarketplacePurchase(CamelModel):
    id: str
    listing_id: str
    buyer_user_id: str
    seller_user_id: str
    card_instance_id: str
    price: float
    fee_paid: float
    purchased_at: datetime


class WalletBalance(CamelModel):
    user_id: str
    currency: Literal["COURT_CASH"] = "COURT_CASH"
    balance: float
    last_claimed_at: datetime | None = None


class WalletLedgerEntry(CamelModel):
    id: str
    user_id: str
    amount: float
    entry_type: WalletEntryType
    description: str
    created_at: datetime
    related_entity_id: str | None = None


class UserProfile(CamelModel):
    id: str
    username: str
    display_name: str
    avatar_seed: str
    home_court: str
    joined_at: datetime


class Notification(CamelModel):
    id: str
    user_id: str
    kind: NotificationKind
    title: str
    body: str
    created_at: datetime
    read: bool = False


class OfferPurchaseResult(CamelModel):
    offer: ShopOffer
    wallet: WalletBalance
    pack_inventory: dict[PackType, int] | None = None
    minted_card: CardInstance | None = None


class PackOpenRequest(CamelModel):
    user_id: str
    pack_type: PackType
    idempotency_key: str | None = Field(default=None, min_length=6)


class ShopPurchaseRequest(CamelModel):
    user_id: str


class CreateListingRequest(CamelModel):
    user_id: str
    card_instance_id: str
    asking_price: float = Field(gt=0)
    expires_at: datetime | None = None


class BuyListingRequest(CamelModel):
    user_id: str
    idempotency_key: str | None = Field(default=None, min_length=6)


class CancelListingRequest(CamelModel):
    user_id: str


class DailyClaimRequest(CamelModel):
    user_id: str


class AdminState(CamelModel):
    marketplace_enabled: bool
    marketplace_fee_bps: int
    active_shop_offer_count: int
    active_listing_count: int
    ranking_snapshot_id: str
