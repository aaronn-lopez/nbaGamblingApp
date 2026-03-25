from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

from .models import CardTier, Player, PlayerFeatureSet, PlayerSnapshot, RankingSnapshot


@dataclass(frozen=True)
class RankingSeed:
    player: Player
    features: PlayerFeatureSet


TIER_SHARES: list[tuple[float, CardTier]] = [
    (0.075, "DIAMOND"),
    (0.125, "PLATINUM"),
    (0.17, "GOLD"),
    (0.19, "SILVER"),
    (0.21, "BRONZE"),
]


def score_player(features: PlayerFeatureSet) -> float:
    minutes_adjustment = _clamp(features.minutes_trend, -1.0, 1.0) * 2.8
    availability_boost = _clamp(features.availability_score, 0.0, 1.0) * 8.5
    pace_boost = ((features.team_pace - 95.0) / 10.0) * 2.1
    schedule_boost = _clamp(float(features.upcoming_games), 2.0, 5.0) * 1.6

    return round(
        features.recent_pra * 0.44
        + features.season_pra * 0.28
        + minutes_adjustment
        + availability_boost
        + pace_boost
        + schedule_boost,
        2,
    )


def build_snapshot(
    seeds: list[RankingSeed],
    *,
    snapshot_id: str,
    label: str,
    published_at: datetime,
    week_start: str,
    week_end: str,
    model_version: str,
) -> RankingSnapshot:
    tier_assignments = _build_tier_assignments(len(seeds))
    scored = sorted(
        [
            {
                "player": seed.player,
                "features": seed.features,
                "score": score_player(seed.features),
            }
            for seed in seeds
        ],
        key=lambda entry: entry["score"],
        reverse=True,
    )

    players: list[PlayerSnapshot] = []
    for index, entry in enumerate(scored):
        percentile = round(((index + 1) / len(scored)) * 100, 1)
        tier = tier_assignments[index] if index < len(tier_assignments) else "IRON"
        features = entry["features"]
        players.append(
            PlayerSnapshot(
                player_id=entry["player"].id,
                week_label=label,
                recent_pra=features.recent_pra,
                season_pra=features.season_pra,
                minutes_trend=features.minutes_trend,
                availability_score=features.availability_score,
                team_pace=features.team_pace,
                upcoming_games=features.upcoming_games,
                player_power_score=entry["score"],
                percentile=percentile,
                tier=tier,
                trend_label=_describe_trend(features.minutes_trend, features.availability_score),
            )
        )

    return RankingSnapshot(
        id=snapshot_id,
        label=label,
        published_at=published_at,
        week_start=week_start,
        week_end=week_end,
        model_version=model_version,
        active=True,
        players=players,
    )


def _describe_trend(minutes_trend: float, availability_score: float) -> str:
    if minutes_trend > 0.55 and availability_score > 0.92:
        return "surging"
    if minutes_trend < -0.25 or availability_score < 0.75:
        return "watchlist"
    return "steady"


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def _build_tier_assignments(total_players: int) -> list[CardTier]:
    assignments: list[CardTier] = []
    assigned = 0

    for share, tier in TIER_SHARES:
        remaining_players = total_players - assigned
        if remaining_players <= 0:
            break

        count = min(remaining_players, max(1, math.ceil(total_players * share)))
        assignments.extend([tier] * count)
        assigned += count

    while len(assignments) < total_players:
        assignments.append("IRON")

    return assignments
