from fastapi.testclient import TestClient

from app.main import app
from app.repository import InMemoryGameStore


def make_client() -> TestClient:
    app.state.store = InMemoryGameStore()
    return TestClient(app)


def test_current_ranking_is_sorted_and_tiered() -> None:
    client = make_client()

    response = client.get("/v1/rankings/current")
    assert response.status_code == 200

    payload = response.json()
    scores = [player["playerPowerScore"] for player in payload["players"]]
    assert scores == sorted(scores, reverse=True)
    assert payload["players"][0]["playerId"] == "nikola-jokic"
    assert payload["players"][0]["tier"] == "DIAMOND"
    assert payload["modelVersion"] == "predictive-v1"


def test_pack_open_is_idempotent_and_mints_only_once() -> None:
    client = make_client()

    before_cards = client.get("/v1/users/user-demo/cards").json()
    response = client.post(
      "/v1/packs/open",
      json={
          "user_id": "user-demo",
          "pack_type": "COMMON",
          "idempotency_key": "pack-open-0001"
      },
    )
    replay = client.post(
      "/v1/packs/open",
      json={
          "user_id": "user-demo",
          "pack_type": "COMMON",
          "idempotency_key": "pack-open-0001"
      },
    )

    assert response.status_code == 200
    assert replay.status_code == 200
    assert response.json() == replay.json()

    after_cards = client.get("/v1/users/user-demo/cards").json()
    assert len(after_cards) == len(before_cards) + 5


def test_marketplace_buy_applies_fee_and_transfers_card() -> None:
    client = make_client()

    buyer_before = client.get("/v1/wallet", params={"user_id": "user-demo"}).json()["balance"]
    seller_before = client.get("/v1/wallet", params={"user_id": "user-rival"}).json()["balance"]

    purchase = client.post(
        "/v1/marketplace/listings/listing-ant-72/buy",
        json={"user_id": "user-demo", "idempotency_key": "listing-buy-0001"},
    )
    assert purchase.status_code == 200

    replay = client.post(
        "/v1/marketplace/listings/listing-ant-72/buy",
        json={"user_id": "user-demo", "idempotency_key": "listing-buy-0001"},
    )
    assert replay.status_code == 200
    assert purchase.json() == replay.json()

    buyer_after = client.get("/v1/wallet", params={"user_id": "user-demo"}).json()["balance"]
    seller_after = client.get("/v1/wallet", params={"user_id": "user-rival"}).json()["balance"]
    system_after = client.get("/v1/wallet", params={"user_id": "system"}).json()["balance"]
    card = client.get("/v1/cards/card-ant-72").json()

    assert buyer_after == round(buyer_before - 910.0, 2)
    assert seller_after == round(seller_before + 864.5, 2)
    assert system_after == 45.5
    assert card["ownerUserId"] == "user-demo"


def test_stale_listing_cannot_be_bought_twice_with_new_key() -> None:
    client = make_client()

    first = client.post(
        "/v1/marketplace/listings/listing-haliburton-301/buy",
        json={"user_id": "user-demo", "idempotency_key": "first-buy"},
    )
    second = client.post(
        "/v1/marketplace/listings/listing-haliburton-301/buy",
        json={"user_id": "user-rival", "idempotency_key": "second-buy"},
    )

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"] == "Listing is no longer available."


def test_daily_claim_only_once_per_day() -> None:
    client = make_client()

    first = client.post("/v1/wallet/daily-claim", json={"user_id": "user-rival"})
    second = client.post("/v1/wallet/daily-claim", json={"user_id": "user-rival"})

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"] == "Daily claim already collected today."


def test_registration_and_login_ignore_username_capitalization() -> None:
    client = make_client()

    register = client.post(
        "/v1/auth/register",
        json={
            "username": "CourtVision",
            "display_name": "Court Vision",
            "home_court": "Minneapolis",
        },
    )
    duplicate = client.post(
        "/v1/auth/register",
        json={
            "username": "courtvision",
            "display_name": "Duplicate",
            "home_court": "Saint Paul",
        },
    )
    login = client.post(
        "/v1/auth/login",
        json={
            "username": "COURTVISION",
        },
    )

    assert register.status_code == 200
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Username already taken."
    assert login.status_code == 200
    assert login.json()["user"]["username"] == "CourtVision"
    assert login.json()["wallet"]["balance"] == 2000.0


def test_new_user_starts_with_a_visible_starter_pack() -> None:
    client = make_client()

    register = client.post(
        "/v1/auth/register",
        json={
            "username": "starterlineup",
            "display_name": "Starter Lineup",
            "home_court": "Portland",
        },
    )
    assert register.status_code == 200

    user_id = register.json()["user"]["id"]
    inventory = client.get("/v1/packs/inventory", params={"user_id": user_id})

    assert inventory.status_code == 200
    assert inventory.json()["STARTER"] == 1
    assert inventory.json()["COMMON"] == 0


def test_player_search_returns_closest_name_for_typos() -> None:
    client = make_client()

    response = client.get("/v1/players", params={"query": "anthny edwrds", "limit": 3})

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["id"] == "anthony-edwards"
    assert payload[0]["fullName"] == "Anthony Edwards"
