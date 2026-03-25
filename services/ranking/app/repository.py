from __future__ import annotations

import hashlib
import random
import re
import threading
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from typing import Any

from .models import (
    AdminState,
    AuthResponse,
    BuyListingRequest,
    CancelListingRequest,
    CardInstance,
    CardTemplate,
    CreateListingRequest,
    DailyClaimRequest,
    MarketplaceListing,
    MarketplacePurchase,
    Notification,
    OfferPurchaseResult,
    PackDefinition,
    PackOpenRequest,
    PackOpenResult,
    PackPullResult,
    Player,
    PlayerFeatureSet,
    RankingSnapshot,
    ShopOffer,
    ShopPurchaseRequest,
    UserProfile,
    WalletBalance,
    WalletLedgerEntry,
)
from .ranking import RankingSeed, build_snapshot


class StoreError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class InMemoryGameStore:
    marketplace_fee_rate = 0.05

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._idempotent: dict[str, Any] = {}
        self._serial_numbers: dict[str, int] = defaultdict(int)
        self._seed()

    def list_players(self, query: str | None = None, limit: int | None = None) -> list[Player]:
        players = [deepcopy(self.players[snapshot.player_id]) for snapshot in self.ranking_snapshot.players]
        if not query:
            return players[:limit] if limit else players

        normalized_query = _normalize_search_text(query)
        if not normalized_query:
            return players[:limit] if limit else players

        scored_matches = sorted(
            (
                (_player_search_score(player, normalized_query), index, player)
                for index, player in enumerate(players)
            ),
            key=lambda item: (-item[0], item[1]),
        )

        strong_matches = [player for score, _, player in scored_matches if score >= 200.0]
        ordered_matches = strong_matches or [player for _, _, player in scored_matches[:5]]
        return ordered_matches[:limit] if limit else ordered_matches

    def current_ranking(self) -> RankingSnapshot:
        return deepcopy(self.ranking_snapshot)

    def get_card(self, card_id: str) -> CardInstance:
        return deepcopy(self._require_card(card_id))

    def list_shop_offers(self) -> list[ShopOffer]:
        return [deepcopy(offer) for offer in self.shop_offers.values() if offer.active]

    def list_pack_definitions(self) -> list[PackDefinition]:
        return [deepcopy(definition) for definition in self.pack_definitions.values()]

    def list_marketplace_listings(self) -> list[MarketplaceListing]:
        self._expire_listings()
        active = [listing for listing in self.marketplace_listings.values() if listing.status == "ACTIVE"]
        return sorted((deepcopy(listing) for listing in active), key=lambda listing: listing.listed_at)

    def get_wallet(self, user_id: str) -> WalletBalance:
        return deepcopy(self._require_wallet(user_id))

    def get_wallet_ledger(self, user_id: str) -> list[WalletLedgerEntry]:
        self._require_user(user_id)
        return [deepcopy(entry) for entry in self.wallet_ledger if entry.user_id == user_id]

    def get_pack_inventory(self, user_id: str) -> dict[str, int]:
        self._require_user(user_id)
        inventory = self.pack_inventory[user_id]
        return {pack_type: int(inventory.get(pack_type, 0)) for pack_type in self.pack_definitions}

    def get_user_cards(self, user_id: str) -> list[CardInstance]:
        self._require_user(user_id)
        owned = [card for card in self.cards.values() if card.owner_user_id == user_id]
        return sorted((deepcopy(card) for card in owned), key=lambda card: (card.player_id, card.serial_number))

    def get_notifications(self, user_id: str) -> list[Notification]:
        self._require_user(user_id)
        return [deepcopy(item) for item in self.notifications if item.user_id == user_id]

    def get_admin_state(self) -> AdminState:
        self._expire_listings()
        return AdminState(
            marketplace_enabled=self.marketplace_enabled,
            marketplace_fee_bps=int(self.marketplace_fee_rate * 10_000),
            active_shop_offer_count=len([offer for offer in self.shop_offers.values() if offer.active]),
            active_listing_count=len([listing for listing in self.marketplace_listings.values() if listing.status == "ACTIVE"]),
            ranking_snapshot_id=self.ranking_snapshot.id,
        )

    def claim_daily(self, request: DailyClaimRequest) -> WalletBalance:
        with self._lock:
            wallet = self._require_wallet(request.user_id)
            now = self._now()
            if wallet.last_claimed_at and wallet.last_claimed_at.date() == now.date():
                raise StoreError("Daily claim already collected today.", status_code=409)

            wallet.last_claimed_at = now
            self._post_ledger(
                request.user_id,
                200.0,
                "DAILY_CLAIM",
                "Daily bonus.",
            )
            return deepcopy(wallet)

    def purchase_offer(self, offer_id: str, request: ShopPurchaseRequest) -> OfferPurchaseResult:
        with self._lock:
            user = self._require_user(request.user_id)
            offer = self.shop_offers.get(offer_id)
            if not offer or not offer.active:
                raise StoreError("Offer not found.", status_code=404)

            self._debit(request.user_id, offer.price, "You don't have enough Court Cash for that yet.")
            entry_type = "PACK_PURCHASE" if offer.offer_type == "PACK" else "CARD_PURCHASE"
            self._post_ledger(request.user_id, -offer.price, entry_type, f"Bought {offer.title}.", offer.id)

            minted_card = None
            pack_inventory = None
            if offer.offer_type == "PACK" and offer.pack_type:
                self.pack_inventory[request.user_id][offer.pack_type] += 1
                pack_inventory = dict(self.pack_inventory[request.user_id])
            elif offer.player_id:
                minted_card = self._mint_card(request.user_id, offer.player_id)

            return OfferPurchaseResult(
                offer=deepcopy(offer),
                wallet=deepcopy(self._require_wallet(user.id)),
                pack_inventory=pack_inventory,
                minted_card=deepcopy(minted_card) if minted_card else None,
            )

    def open_pack(self, request: PackOpenRequest) -> PackOpenResult:
        idempotency_key = request.idempotency_key
        cache_key = f"pack_open:{idempotency_key}" if idempotency_key else None
        if cache_key and cache_key in self._idempotent:
            return deepcopy(self._idempotent[cache_key])

        with self._lock:
            self._require_user(request.user_id)
            count = self.pack_inventory[request.user_id][request.pack_type]
            if count <= 0:
                raise StoreError("No packs of that type available.", status_code=409)

            definition = self.pack_definitions[request.pack_type]
            rng = random.Random(_seed_from_key(idempotency_key or f"{request.user_id}:{request.pack_type}:{self._now().isoformat()}"))
            self.pack_inventory[request.user_id][request.pack_type] -= 1

            pulls: list[PackPullResult] = []
            seen_players: set[str] = set()
            for _ in range(definition.cards_per_pack):
                tier = _roll_tier(rng, definition.odds_by_tier)
                pool = [snapshot.player_id for snapshot in self.ranking_snapshot.players if snapshot.tier == tier]
                if not pool:
                    pool = [snapshot.player_id for snapshot in self.ranking_snapshot.players]

                available = [player_id for player_id in pool if player_id not in seen_players] or pool
                player_id = rng.choice(available)
                card = self._mint_card(request.user_id, player_id, forced_tier=tier)
                pulls.append(
                    PackPullResult(
                        card_id=card.id,
                        player_id=player_id,
                        tier=card.tier_at_mint,
                        serial_number=card.serial_number,
                    )
                )
                seen_players.add(player_id)

            result = PackOpenResult(
                pack_type=request.pack_type,
                opened_at=self._now(),
                remaining_balance=self._require_wallet(request.user_id).balance,
                pulls=pulls,
            )
            if cache_key:
                self._idempotent[cache_key] = deepcopy(result)
            return result

    def create_listing(self, request: CreateListingRequest) -> MarketplaceListing:
        with self._lock:
            if not self.marketplace_enabled:
                raise StoreError("Marketplace is currently paused.", status_code=409)

            card = self._require_card(request.card_instance_id)
            if card.owner_user_id != request.user_id:
                raise StoreError("Card ownership mismatch.", status_code=403)

            if any(
                listing.card_instance_id == request.card_instance_id and listing.status == "ACTIVE"
                for listing in self.marketplace_listings.values()
            ):
                raise StoreError("Card is already listed.", status_code=409)

            listing = MarketplaceListing(
                id=f"listing-{len(self.marketplace_listings) + 1}",
                seller_user_id=request.user_id,
                card_instance_id=card.id,
                player_id=card.player_id,
                tier_at_mint=card.tier_at_mint,
                serial_number=card.serial_number,
                asking_price=round(request.asking_price, 2),
                listed_at=self._now(),
                expires_at=request.expires_at or (self._now() + timedelta(days=2)),
                status="ACTIVE",
            )
            self.marketplace_listings[listing.id] = listing
            return deepcopy(listing)

    def buy_listing(self, listing_id: str, request: BuyListingRequest) -> MarketplacePurchase:
        cache_key = f"listing_buy:{request.idempotency_key}" if request.idempotency_key else None
        if cache_key and cache_key in self._idempotent:
            return deepcopy(self._idempotent[cache_key])

        with self._lock:
            if not self.marketplace_enabled:
                raise StoreError("Marketplace is currently paused.", status_code=409)

            self._expire_listings()
            listing = self.marketplace_listings.get(listing_id)
            if not listing:
                raise StoreError("Listing not found.", status_code=404)
            if listing.status != "ACTIVE":
                raise StoreError("Listing is no longer available.", status_code=409)
            if listing.seller_user_id == request.user_id:
                raise StoreError("Seller cannot buy their own listing.", status_code=409)

            self._debit(request.user_id, listing.asking_price, "You don't have enough Court Cash for that yet.")

            seller_proceeds = round(listing.asking_price * (1 - self.marketplace_fee_rate), 2)
            fee_paid = round(listing.asking_price - seller_proceeds, 2)

            self._post_ledger(
                request.user_id,
                -listing.asking_price,
                "MARKETPLACE_BUY",
                f"Bought {listing.player_id} #{listing.serial_number}.",
                listing.id,
            )
            self._post_ledger(
                listing.seller_user_id,
                seller_proceeds,
                "MARKETPLACE_SALE",
                f"Sold {listing.player_id} #{listing.serial_number}.",
                listing.id,
            )
            self._post_ledger(
                "system",
                fee_paid,
                "MARKETPLACE_FEE",
                "Marketplace burn fee.",
                listing.id,
            )

            card = self._require_card(listing.card_instance_id)
            card.owner_user_id = request.user_id
            listing.status = "SOLD"
            purchase = MarketplacePurchase(
                id=f"purchase-{len(self.marketplace_purchases) + 1}",
                listing_id=listing.id,
                buyer_user_id=request.user_id,
                seller_user_id=listing.seller_user_id,
                card_instance_id=listing.card_instance_id,
                price=listing.asking_price,
                fee_paid=fee_paid,
                purchased_at=self._now(),
            )
            self.marketplace_purchases[purchase.id] = purchase
            self.notifications.append(
                Notification(
                    id=f"notification-{len(self.notifications) + 1}",
                    user_id=listing.seller_user_id,
                    kind="SALE_COMPLETE",
                    title="Card sold",
                    body=f"{listing.player_id} #{listing.serial_number} sold for {listing.asking_price} Court Cash.",
                    created_at=self._now(),
                    read=False,
                )
            )
            if cache_key:
                self._idempotent[cache_key] = deepcopy(purchase)
            return deepcopy(purchase)

    def cancel_listing(self, listing_id: str, request: CancelListingRequest) -> MarketplaceListing:
        with self._lock:
            listing = self.marketplace_listings.get(listing_id)
            if not listing:
                raise StoreError("Listing not found.", status_code=404)
            if listing.seller_user_id != request.user_id:
                raise StoreError("Only the seller can cancel this listing.", status_code=403)
            if listing.status != "ACTIVE":
                raise StoreError("Only active listings can be cancelled.", status_code=409)

            listing.status = "CANCELLED"
            return deepcopy(listing)

    def _seed(self) -> None:
        self.users = {
            "user-demo": UserProfile(
                id="user-demo",
                username="fullcourtwill",
                display_name="Will Desai",
                avatar_seed="midrange-sun",
                home_court="Vancouver",
                joined_at=datetime(2026, 3, 1, 8, 0, tzinfo=UTC).isoformat(),
            ),
            "user-rival": UserProfile(
                id="user-rival",
                username="baselineboss",
                display_name="Baseline Boss",
                avatar_seed="trade-floor",
                home_court="Seattle",
                joined_at=datetime(2026, 2, 20, 8, 0, tzinfo=UTC).isoformat(),
            ),
            "system": UserProfile(
                id="system",
                username="house",
                display_name="Court Cash House",
                avatar_seed="house-ledger",
                home_court="Cloud",
                joined_at=datetime(2026, 1, 1, 0, 0, tzinfo=UTC).isoformat(),
            ),
        }

        seeds = [
            self._seed_player("nikola-jokic", "Nikola Jokic", "DEN", "C", 47.4, 44.8, 0.31, 0.97, 98.7, 4),
            self._seed_player("shai-gilgeous-alexander", "Shai Gilgeous-Alexander", "OKC", "G", 43.1, 41.9, 0.24, 0.96, 100.4, 4),
            self._seed_player("luka-doncic", "Luka Doncic", "LAL", "G", 45.2, 43.7, 0.12, 0.84, 99.6, 3),
            self._seed_player("giannis-antetokounmpo", "Giannis Antetokounmpo", "MIL", "F", 44.3, 42.8, 0.18, 0.89, 100.1, 4),
            self._seed_player("victor-wembanyama", "Victor Wembanyama", "SAS", "C", 42.8, 39.5, 0.65, 0.9, 101.9, 4),
            self._seed_player("jayson-tatum", "Jayson Tatum", "BOS", "F", 39.9, 38.7, 0.05, 0.98, 99.1, 3),
            self._seed_player("anthony-edwards", "Anthony Edwards", "MIN", "G", 37.3, 36.1, 0.27, 0.95, 98.8, 4),
            self._seed_player("jalen-brunson", "Jalen Brunson", "NYK", "G", 36.5, 35.8, 0.11, 0.87, 97.8, 4),
            self._seed_player("paolo-banchero", "Paolo Banchero", "ORL", "F", 34.2, 33.8, 0.33, 0.9, 98.5, 4),
            self._seed_player("donovan-mitchell", "Donovan Mitchell", "CLE", "G", 34.8, 34.4, -0.06, 0.82, 97.2, 3),
            self._seed_player("tyrese-haliburton", "Tyrese Haliburton", "IND", "G", 33.1, 32.7, 0.09, 0.8, 102.3, 4),
            self._seed_player("amen-thompson", "Amen Thompson", "HOU", "F", 26.4, 24.1, 0.74, 0.95, 100.8, 4),
        ]

        self.players = {seed.player.id: seed.player for seed in seeds}
        self.ranking_snapshot = build_snapshot(
            seeds,
            snapshot_id="ranking-2026-week-13",
            label="Week 13 Projection",
            published_at=datetime(2026, 3, 24, 6, 0, tzinfo=UTC),
            week_start="2026-03-24",
            week_end="2026-03-30",
            model_version="predictive-v1",
        )
        self.snapshot_by_player = {item.player_id: item for item in self.ranking_snapshot.players}

        self.card_templates = {
            player_id: CardTemplate(
                id=f"template-{player_id}",
                player_id=player_id,
                season="2025-26",
                edition="Founders" if index < 4 else "Pulse",
                card_style="Lacquer Foil" if index % 2 == 0 else "Concrete Prism",
                accent_color=["#f05a28", "#0a6c74", "#d4a017", "#b23a48"][index % 4],
            )
            for index, player_id in enumerate(self.players.keys())
        }

        self.cards: dict[str, CardInstance] = {}
        self._seed_card("card-jokic-11", "nikola-jokic", "user-demo", 11)
        self._seed_card("card-wemby-84", "victor-wembanyama", "user-demo", 84)
        self._seed_card("card-banchero-131", "paolo-banchero", "user-demo", 131)
        self._seed_card("card-brunson-201", "jalen-brunson", "user-demo", 201)
        self._seed_card("card-haliburton-301", "tyrese-haliburton", "user-rival", 301)
        self._seed_card("card-ant-72", "anthony-edwards", "user-rival", 72)
        self._seed_card("card-shai-16", "shai-gilgeous-alexander", "user-rival", 16)
        self._seed_card("card-amen-401", "amen-thompson", "user-rival", 401)

        self.wallets = {
            user_id: WalletBalance(user_id=user_id, balance=0.0, last_claimed_at=None)
            for user_id in self.users
        }
        self.wallet_ledger: list[WalletLedgerEntry] = []
        self._post_ledger("user-demo", 2000.0, "ONBOARDING_GRANT", "Welcome bonus.")
        self._post_ledger("user-rival", 2200.0, "ONBOARDING_GRANT", "Welcome bonus.")
        self._post_ledger("user-demo", 200.0, "DAILY_CLAIM", "Daily bonus.")
        self.wallets["user-demo"].last_claimed_at = datetime(2026, 3, 23, 8, 0, tzinfo=UTC)

        self.pack_definitions = {
            "STARTER": PackDefinition(
                id="pack-starter",
                pack_type="STARTER",
                title="Starter Crate",
                description="A free starter pack with 3 player cards.",
                price=0.0,
                cards_per_pack=3,
                odds_by_tier={
                    "DIAMOND": 0.01,
                    "PLATINUM": 0.04,
                    "GOLD": 0.2,
                    "SILVER": 0.35,
                    "BRONZE": 0.28,
                    "IRON": 0.12,
                },
            ),
            "COMMON": PackDefinition(
                id="pack-common",
                pack_type="COMMON",
                title="Common Run",
                description="A low-cost pack with 5 player cards.",
                price=120.0,
                cards_per_pack=5,
                odds_by_tier={
                    "DIAMOND": 0.015,
                    "PLATINUM": 0.05,
                    "GOLD": 0.18,
                    "SILVER": 0.3,
                    "BRONZE": 0.29,
                    "IRON": 0.165,
                },
            ),
            "RARE": PackDefinition(
                id="pack-rare",
                pack_type="RARE",
                title="Rare Run",
                description="A stronger pack with better odds for top players.",
                price=560.0,
                cards_per_pack=5,
                odds_by_tier={
                    "DIAMOND": 0.04,
                    "PLATINUM": 0.11,
                    "GOLD": 0.34,
                    "SILVER": 0.28,
                    "BRONZE": 0.16,
                    "IRON": 0.07,
                },
            ),
            "LEGENDARY": PackDefinition(
                id="pack-legendary",
                pack_type="LEGENDARY",
                title="Legendary Vault",
                description="The biggest pack, with your best shot at star cards.",
                price=2200.0,
                cards_per_pack=5,
                odds_by_tier={
                    "DIAMOND": 0.1,
                    "PLATINUM": 0.24,
                    "GOLD": 0.32,
                    "SILVER": 0.19,
                    "BRONZE": 0.1,
                    "IRON": 0.05,
                },
            ),
        }
        self.pack_inventory: dict[str, Counter[str]] = defaultdict(Counter)
        self.pack_inventory["user-demo"].update({"STARTER": 1, "COMMON": 1})
        self.pack_inventory["user-rival"].update({"COMMON": 2, "RARE": 1})

        self.shop_offers = {
            "offer-pack-common": ShopOffer(
                id="offer-pack-common",
                offer_type="PACK",
                title="Common Run",
                description="A low-cost pack with 5 player cards.",
                price=120.0,
                active=True,
                pack_type="COMMON",
            ),
            "offer-pack-rare": ShopOffer(
                id="offer-pack-rare",
                offer_type="PACK",
                title="Rare Run",
                description="A stronger pack with better odds for top players.",
                price=560.0,
                active=True,
                pack_type="RARE",
            ),
            "offer-featured-wemby": ShopOffer(
                id="offer-featured-wemby",
                offer_type="FEATURED_CARD",
                title="Victor Wembanyama Special",
                description="A one-of-a-kind Victor card for this week's shop.",
                price=1350.0,
                active=True,
                player_id="victor-wembanyama",
                tier=self.snapshot_by_player["victor-wembanyama"].tier,
            ),
        }

        self.marketplace_enabled = True
        self.marketplace_listings: dict[str, MarketplaceListing] = {
            "listing-ant-72": MarketplaceListing(
                id="listing-ant-72",
                seller_user_id="user-rival",
                card_instance_id="card-ant-72",
                player_id="anthony-edwards",
                tier_at_mint=self.snapshot_by_player["anthony-edwards"].tier,
                serial_number=72,
                asking_price=910.0,
                listed_at=datetime(2026, 3, 24, 9, 0, tzinfo=UTC),
                expires_at=datetime(2026, 3, 26, 9, 0, tzinfo=UTC),
                status="ACTIVE",
            ),
            "listing-haliburton-301": MarketplaceListing(
                id="listing-haliburton-301",
                seller_user_id="user-rival",
                card_instance_id="card-haliburton-301",
                player_id="tyrese-haliburton",
                tier_at_mint=self.snapshot_by_player["tyrese-haliburton"].tier,
                serial_number=301,
                asking_price=420.0,
                listed_at=datetime(2026, 3, 24, 11, 0, tzinfo=UTC),
                expires_at=datetime(2026, 3, 27, 11, 0, tzinfo=UTC),
                status="ACTIVE",
            ),
        }
        self.marketplace_purchases: dict[str, MarketplacePurchase] = {}

        self.notifications = [
            Notification(
                id="notification-1",
                user_id="user-demo",
                kind="RANKING_REFRESH",
                title="New player list is up",
                body="Victor Wembanyama is one of the hottest cards in the game right now.",
                created_at=datetime(2026, 3, 24, 6, 10, tzinfo=UTC),
                read=False,
            )
        ]

    def _seed_player(
        self,
        player_id: str,
        full_name: str,
        team: str,
        position: str,
        recent_pra: float,
        season_pra: float,
        minutes_trend: float,
        availability_score: float,
        team_pace: float,
        upcoming_games: int,
    ) -> RankingSeed:
        return RankingSeed(
            player=Player(
                id=player_id,
                slug=player_id,
                full_name=full_name,
                team=team,
                position=position,
            ),
            features=PlayerFeatureSet(
                recent_pra=recent_pra,
                season_pra=season_pra,
                minutes_trend=minutes_trend,
                availability_score=availability_score,
                team_pace=team_pace,
                upcoming_games=upcoming_games,
            ),
        )

    def _seed_card(self, card_id: str, player_id: str, owner_user_id: str, serial_number: int) -> None:
        snapshot = self.snapshot_by_player[player_id]
        self._serial_numbers[player_id] = max(self._serial_numbers[player_id], serial_number)
        self.cards[card_id] = CardInstance(
            id=card_id,
            template_id=f"template-{player_id}",
            owner_user_id=owner_user_id,
            player_id=player_id,
            season="2025-26",
            edition="Founders" if serial_number < 100 else "Pulse",
            serial_number=serial_number,
            tier_at_mint=snapshot.tier,
            minted_ranking_snapshot_id=self.ranking_snapshot.id,
            minted_at=datetime(2026, 3, 24, 6, 5, tzinfo=UTC),
        )

    def _mint_card(self, user_id: str, player_id: str, forced_tier: str | None = None) -> CardInstance:
        snapshot = self.snapshot_by_player[player_id]
        next_serial = self._serial_numbers[player_id] + 1
        self._serial_numbers[player_id] = next_serial
        card = CardInstance(
            id=f"card-{player_id}-{next_serial}",
            template_id=f"template-{player_id}",
            owner_user_id=user_id,
            player_id=player_id,
            season="2025-26",
            edition="Founders" if next_serial < 100 else "Pulse",
            serial_number=next_serial,
            tier_at_mint=forced_tier or snapshot.tier,
            minted_ranking_snapshot_id=self.ranking_snapshot.id,
            minted_at=self._now(),
        )
        self.cards[card.id] = card
        return card

    def _post_ledger(
        self,
        user_id: str,
        amount: float,
        entry_type: str,
        description: str,
        related_entity_id: str | None = None,
    ) -> None:
        wallet = self._require_wallet(user_id)
        wallet.balance = round(wallet.balance + amount, 2)
        self.wallet_ledger.append(
            WalletLedgerEntry(
                id=f"ledger-{len(self.wallet_ledger) + 1}",
                user_id=user_id,
                amount=round(amount, 2),
                entry_type=entry_type,  # type: ignore[arg-type]
                description=description,
                created_at=self._now(),
                related_entity_id=related_entity_id,
            )
        )

    def _debit(self, user_id: str, amount: float, failure_message: str) -> None:
        wallet = self._require_wallet(user_id)
        if wallet.balance < amount:
            raise StoreError(failure_message, status_code=409)

    def _expire_listings(self) -> None:
        now = self._now()
        for listing in self.marketplace_listings.values():
            if listing.status == "ACTIVE" and listing.expires_at <= now:
                listing.status = "EXPIRED"

    def _require_user(self, user_id: str) -> UserProfile:
        user = self.users.get(user_id)
        if not user:
            raise StoreError("User not found.", status_code=404)
        return user

    def _require_wallet(self, user_id: str) -> WalletBalance:
        wallet = self.wallets.get(user_id)
        if not wallet:
            raise StoreError("Wallet not found.", status_code=404)
        return wallet

    def _require_card(self, card_id: str) -> CardInstance:
        card = self.cards.get(card_id)
        if not card:
            raise StoreError("Card not found.", status_code=404)
        return card

    def _now(self) -> datetime:
        return datetime.now(tz=UTC)

    def register_user(self, username: str, display_name: str = "", home_court: str = "") -> UserProfile:
        with self._lock:
            cleaned_username = _clean_username(username)
            username_key = _normalize_username(username)
            cleaned_display_name = " ".join(display_name.split()) or cleaned_username
            cleaned_home_court = " ".join(home_court.split()) or "Unknown"

            if not cleaned_username:
                raise StoreError("Username is required.", status_code=422)

            # Check if username already exists
            if any(_normalize_username(user.username) == username_key for user in self.users.values()):
                raise StoreError("Username already taken.", status_code=409)

            # Create new user
            user_id = f"user-{len(self.users) + 1}"
            user = UserProfile(
                id=user_id,
                username=cleaned_username,
                display_name=cleaned_display_name,
                avatar_seed=cleaned_username.casefold(),
                home_court=cleaned_home_court,
                joined_at=self._now().isoformat(),
            )
            self.users[user_id] = user

            # Create wallet for new user
            self.wallets[user_id] = WalletBalance(user_id=user_id, balance=0.0, last_claimed_at=None)
            self._post_ledger(user_id, 2000.0, "ONBOARDING_GRANT", "Welcome bonus.")

            # Give starter pack
            self.pack_inventory[user_id].update({"STARTER": 1})

            return user

    def login_user(self, username: str) -> AuthResponse:
        with self._lock:
            username_key = _normalize_username(username)

            # Find user by username
            user = None
            for u in self.users.values():
                if _normalize_username(u.username) == username_key:
                    user = u
                    break

            if not user:
                raise StoreError("We couldn't find that username.", status_code=401)

            token = f"token-{user.id}-{int(self._now().timestamp())}"

            return AuthResponse(
                user=user,
                token=token,
                wallet=deepcopy(self._require_wallet(user.id)),
            )

    def get_current_user(self, token: str) -> UserProfile:
        with self._lock:
            # Extract user ID from token (simple implementation)
            if not token.startswith("token-"):
                raise StoreError("Invalid token.", status_code=401)

            parts = token.split("-")
            if len(parts) < 3:
                raise StoreError("Invalid token.", status_code=401)

            user_id = f"{parts[1]}-{parts[2]}"  # Reconstruct user ID

            user = self.users.get(user_id)
            if not user:
                raise StoreError("User not found.", status_code=401)

            return user


def _seed_from_key(value: str) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def _roll_tier(rng: random.Random, odds_by_tier: dict[str, float]) -> str:
    tiers = list(odds_by_tier.keys())
    weights = list(odds_by_tier.values())
    return rng.choices(tiers, weights=weights, k=1)[0]


def _clean_username(value: str) -> str:
    return " ".join(value.split())


def _normalize_username(value: str) -> str:
    return _clean_username(value).casefold()


def _normalize_search_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def _token_similarity_score(query_token: str, candidate_token: str) -> float:
    if query_token == candidate_token:
        return 220.0

    length_delta = abs(len(candidate_token) - len(query_token))
    if candidate_token.startswith(query_token) or query_token.startswith(candidate_token):
        return max(0.0, 190.0 - (length_delta * 10.0))
    if query_token in candidate_token or candidate_token in query_token:
        return max(0.0, 160.0 - (length_delta * 10.0))

    return SequenceMatcher(None, query_token, candidate_token).ratio() * 150.0


def _player_search_score(player: Player, normalized_query: str) -> float:
    normalized_name = _normalize_search_text(player.full_name)
    normalized_slug = _normalize_search_text(player.slug)
    condensed_query = normalized_query.replace(" ", "")
    condensed_name = normalized_name.replace(" ", "")

    if normalized_query in {normalized_name, normalized_slug}:
        return 1_000.0

    score = 0.0
    if normalized_query in normalized_name or normalized_query in normalized_slug:
        score += 500.0

    name_tokens = normalized_name.split()
    query_tokens = normalized_query.split()
    for query_token in query_tokens:
        score += max((_token_similarity_score(query_token, token) for token in name_tokens), default=0.0)

    score += SequenceMatcher(None, normalized_query, normalized_name).ratio() * 220.0
    score += SequenceMatcher(None, condensed_query, condensed_name).ratio() * 160.0
    return score
