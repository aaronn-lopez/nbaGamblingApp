from __future__ import annotations

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import (
    AdminState,
    AuthResponse,
    BuyListingRequest,
    CancelListingRequest,
    CardInstance,
    CreateListingRequest,
    DailyClaimRequest,
    LoginRequest,
    MarketplaceListing,
    MarketplacePurchase,
    Notification,
    OfferPurchaseResult,
    PackDefinition,
    PackOpenRequest,
    PackOpenResult,
    Player,
    RankingSnapshot,
    RegisterRequest,
    ShopOffer,
    ShopPurchaseRequest,
    UserProfile,
    WalletBalance,
    WalletLedgerEntry,
)
from .repository import InMemoryGameStore, StoreError

app = FastAPI(title="Court Cash Ranking Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.state.store = InMemoryGameStore()


def get_store(request: Request) -> InMemoryGameStore:
    return request.app.state.store


@app.exception_handler(StoreError)
async def store_error_handler(_: Request, error: StoreError) -> JSONResponse:
    return JSONResponse({"detail": error.message}, status_code=error.status_code)


@app.get("/test")
def test_endpoint(store: InMemoryGameStore = Depends(get_store)):
    user = store.users.get("user-demo")
    return {"user": user, "type": str(type(user))}


@app.get("/test-auth", response_model=AuthResponse)
def test_auth_endpoint(store: InMemoryGameStore = Depends(get_store)):
    user = store.users.get("user-demo")
    wallet = store.wallets.get("user-demo")
    return AuthResponse(user=user, token="test-token", wallet=wallet)


@app.get("/test-simple")
def test_simple_endpoint():
    return {"token": "test-token"}


@app.get("/v1/players", response_model=list[Player])
def list_players(
    query: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=50),
    store: InMemoryGameStore = Depends(get_store),
) -> list[Player]:
    return store.list_players(query=query, limit=limit)


@app.get("/v1/rankings/current", response_model=RankingSnapshot)
def get_current_ranking(store: InMemoryGameStore = Depends(get_store)) -> RankingSnapshot:
    return store.current_ranking()


@app.get("/v1/cards/{card_id}", response_model=CardInstance)
def get_card(card_id: str, store: InMemoryGameStore = Depends(get_store)) -> CardInstance:
    return store.get_card(card_id)


@app.get("/v1/users/{user_id}/cards", response_model=list[CardInstance])
def list_user_cards(user_id: str, store: InMemoryGameStore = Depends(get_store)) -> list[CardInstance]:
    return store.get_user_cards(user_id)


@app.get("/v1/notifications", response_model=list[Notification])
def list_notifications(
    user_id: str = Query(...),
    store: InMemoryGameStore = Depends(get_store),
) -> list[Notification]:
    return store.get_notifications(user_id)


@app.get("/v1/shop/offers", response_model=list[ShopOffer])
def get_shop_offers(store: InMemoryGameStore = Depends(get_store)) -> list[ShopOffer]:
    return store.list_shop_offers()


@app.get("/v1/packs/definitions", response_model=list[PackDefinition])
def get_pack_definitions(store: InMemoryGameStore = Depends(get_store)) -> list[PackDefinition]:
    return store.list_pack_definitions()


@app.get("/v1/packs/inventory", response_model=dict[str, int])
def get_pack_inventory(
    user_id: str = Query(...),
    store: InMemoryGameStore = Depends(get_store),
) -> dict[str, int]:
    return store.get_pack_inventory(user_id)


@app.post("/v1/shop/offers/{offer_id}/purchase", response_model=OfferPurchaseResult)
def purchase_offer(
    offer_id: str,
    request: ShopPurchaseRequest,
    store: InMemoryGameStore = Depends(get_store),
) -> OfferPurchaseResult:
    return store.purchase_offer(offer_id, request)


@app.post("/v1/packs/open", response_model=PackOpenResult)
def open_pack(request: PackOpenRequest, store: InMemoryGameStore = Depends(get_store)) -> PackOpenResult:
    return store.open_pack(request)


@app.get("/v1/marketplace/listings", response_model=list[MarketplaceListing])
def list_marketplace(store: InMemoryGameStore = Depends(get_store)) -> list[MarketplaceListing]:
    return store.list_marketplace_listings()


@app.post("/v1/marketplace/listings", response_model=MarketplaceListing)
def create_listing(
    request: CreateListingRequest,
    store: InMemoryGameStore = Depends(get_store),
) -> MarketplaceListing:
    return store.create_listing(request)


@app.post("/v1/marketplace/listings/{listing_id}/buy", response_model=MarketplacePurchase)
def buy_listing(
    listing_id: str,
    request: BuyListingRequest,
    store: InMemoryGameStore = Depends(get_store),
) -> MarketplacePurchase:
    return store.buy_listing(listing_id, request)


@app.post("/v1/marketplace/listings/{listing_id}/cancel", response_model=MarketplaceListing)
def cancel_listing(
    listing_id: str,
    request: CancelListingRequest,
    store: InMemoryGameStore = Depends(get_store),
) -> MarketplaceListing:
    return store.cancel_listing(listing_id, request)


@app.get("/v1/wallet", response_model=WalletBalance)
def get_wallet(
    user_id: str = Query(...),
    store: InMemoryGameStore = Depends(get_store),
) -> WalletBalance:
    return store.get_wallet(user_id)


@app.get("/v1/wallet/ledger", response_model=list[WalletLedgerEntry])
def get_wallet_ledger(
    user_id: str = Query(...),
    store: InMemoryGameStore = Depends(get_store),
) -> list[WalletLedgerEntry]:
    return store.get_wallet_ledger(user_id)


@app.post("/v1/wallet/daily-claim", response_model=WalletBalance)
def claim_daily(
    request: DailyClaimRequest,
    store: InMemoryGameStore = Depends(get_store),
) -> WalletBalance:
    return store.claim_daily(request)


@app.get("/v1/admin/state", response_model=AdminState)
def get_admin_state(store: InMemoryGameStore = Depends(get_store)) -> AdminState:
    return store.get_admin_state()


@app.post("/v1/auth/register", response_model=AuthResponse)
def register_user(
    request: RegisterRequest,
    store: InMemoryGameStore = Depends(get_store),
) -> AuthResponse:
    store.register_user(request.username, request.display_name, request.home_court)
    return store.login_user(request.username)


@app.post("/v1/auth/login", response_model=AuthResponse)
def login_user(
    request: LoginRequest,
    store: InMemoryGameStore = Depends(get_store),
) -> AuthResponse:
    return store.login_user(request.username)


@app.get("/v1/auth/me", response_model=UserProfile)
def get_current_user(
    authorization: str = Header(None),
    store: InMemoryGameStore = Depends(get_store),
) -> UserProfile:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.replace("Bearer ", "")
    return store.get_current_user(token)
