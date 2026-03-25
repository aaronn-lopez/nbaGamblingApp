import { CardTier, Player, PlayerFeatureSet, PlayerSnapshot, RankingSnapshot } from "./types";

export interface RankingSeed extends Player, PlayerFeatureSet {}

const tierShares: Array<{ share: number; tier: CardTier }> = [
  { share: 0.075, tier: "DIAMOND" },
  { share: 0.125, tier: "PLATINUM" },
  { share: 0.17, tier: "GOLD" },
  { share: 0.19, tier: "SILVER" },
  { share: 0.21, tier: "BRONZE" }
];

export function scorePlayer(features: PlayerFeatureSet): number {
  const minutesAdjustment = clamp(features.minutesTrend, -1, 1) * 2.8;
  const availabilityBoost = clamp(features.availabilityScore, 0, 1) * 8.5;
  const paceBoost = ((features.teamPace - 95) / 10) * 2.1;
  const scheduleBoost = clamp(features.upcomingGames, 2, 5) * 1.6;

  return round(
    features.recentPra * 0.44 +
      features.seasonPra * 0.28 +
      minutesAdjustment +
      availabilityBoost +
      paceBoost +
      scheduleBoost,
    2
  );
}

export function buildRankingSnapshot(
  seeds: RankingSeed[],
  options: {
    id: string;
    label: string;
    publishedAt: string;
    weekStart: string;
    weekEnd: string;
    modelVersion: string;
  }
): RankingSnapshot {
  const tierAssignments = buildTierAssignments(seeds.length);
  const scored = seeds
    .map((seed) => ({
      ...seed,
      playerPowerScore: scorePlayer(seed)
    }))
    .sort((left, right) => right.playerPowerScore - left.playerPowerScore);

  const players: PlayerSnapshot[] = scored.map((player, index) => {
    const percentile = round(((index + 1) / scored.length) * 100, 1);
    const tier = tierAssignments[index] ?? "IRON";

    return {
      playerId: player.id,
      weekLabel: options.label,
      recentPra: player.recentPra,
      seasonPra: player.seasonPra,
      minutesTrend: player.minutesTrend,
      availabilityScore: player.availabilityScore,
      teamPace: player.teamPace,
      upcomingGames: player.upcomingGames,
      playerPowerScore: player.playerPowerScore,
      percentile,
      tier,
      trendLabel: describeTrend(player.minutesTrend, player.availabilityScore)
    };
  });

  return {
    id: options.id,
    label: options.label,
    publishedAt: options.publishedAt,
    weekStart: options.weekStart,
    weekEnd: options.weekEnd,
    cadence: "WEEKLY",
    modelVersion: options.modelVersion,
    active: true,
    players
  };
}

function buildTierAssignments(totalPlayers: number): CardTier[] {
  const assignments: CardTier[] = [];
  let assigned = 0;

  for (const band of tierShares) {
    const remainingPlayers = totalPlayers - assigned;
    if (remainingPlayers <= 0) {
      break;
    }

    const count = Math.min(remainingPlayers, Math.max(1, Math.ceil(totalPlayers * band.share)));
    for (let index = 0; index < count; index += 1) {
      assignments.push(band.tier);
    }
    assigned += count;
  }

  while (assignments.length < totalPlayers) {
    assignments.push("IRON");
  }

  return assignments;
}

function describeTrend(minutesTrend: number, availabilityScore: number): string {
  if (minutesTrend > 0.55 && availabilityScore > 0.92) {
    return "surging";
  }

  if (minutesTrend < -0.25 || availabilityScore < 0.75) {
    return "watchlist";
  }

  return "steady";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 0): number {
  const precision = 10 ** decimals;
  return Math.round(value * precision) / precision;
}
