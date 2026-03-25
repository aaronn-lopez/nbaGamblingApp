import { Player } from "@court-cash/domain";

const STRONG_MATCH_THRESHOLD = 200;

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function rankPlayersByQuery(players: Player[], rawQuery: string): Player[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) {
    return players;
  }

  const scoredMatches = players
    .map((player, index) => ({
      index,
      player,
      score: scorePlayerSearch(player, query)
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const strongMatches = scoredMatches.filter((entry) => entry.score >= STRONG_MATCH_THRESHOLD);
  const orderedMatches = (strongMatches.length > 0 ? strongMatches : scoredMatches.slice(0, 5)).map(
    (entry) => entry.player
  );

  return orderedMatches;
}

function scorePlayerSearch(player: Player, query: string): number {
  const normalizedName = normalizeSearchText(player.fullName);
  const normalizedSlug = normalizeSearchText(player.slug);
  const compactQuery = query.replaceAll(" ", "");
  const compactName = normalizedName.replaceAll(" ", "");

  if (query === normalizedName || query === normalizedSlug) {
    return 1000;
  }

  let score = 0;
  if (normalizedName.includes(query) || normalizedSlug.includes(query)) {
    score += 500;
  }

  const nameTokens = normalizedName.split(" ").filter(Boolean);
  const queryTokens = query.split(" ").filter(Boolean);

  for (const queryToken of queryTokens) {
    let bestTokenScore = 0;

    for (const candidateToken of nameTokens) {
      bestTokenScore = Math.max(bestTokenScore, tokenSimilarityScore(queryToken, candidateToken));
    }

    score += bestTokenScore;
  }

  score += similarityRatio(query, normalizedName) * 220;
  score += similarityRatio(compactQuery, compactName) * 160;
  return score;
}

function tokenSimilarityScore(queryToken: string, candidateToken: string): number {
  if (queryToken === candidateToken) {
    return 220;
  }

  const lengthDelta = Math.abs(candidateToken.length - queryToken.length);
  if (candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken)) {
    return Math.max(0, 190 - lengthDelta * 10);
  }
  if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) {
    return Math.max(0, 160 - lengthDelta * 10);
  }

  return similarityRatio(queryToken, candidateToken) * 150;
}

function similarityRatio(left: string, right: string): number {
  if (!left && !right) {
    return 1;
  }

  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 1;
  }

  return 1 - levenshteinDistance(left, right) / maxLength;
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const upper = previous[column];
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;

      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + cost
      );
      diagonal = upper;
    }
  }

  return previous[right.length];
}
