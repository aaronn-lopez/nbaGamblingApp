'use client';

import { Player, PlayerSnapshot } from "@court-cash/domain";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { searchPlayers } from "../lib/api";
import { formatTierLabel } from "../lib/formatting";

interface RankingsTableProps {
  players: Player[];
  snapshots: PlayerSnapshot[];
}

export function RankingsTable({ players, snapshots }: RankingsTableProps) {
  const [query, setQuery] = useState("");
  const [visiblePlayers, setVisiblePlayers] = useState<Player[]>(() => buildRankedPlayers(players, snapshots));
  const [isSearching, setIsSearching] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const rankedPlayers = buildRankedPlayers(players, snapshots);
    const trimmedQuery = deferredQuery.trim();

    if (!trimmedQuery) {
      setIsSearching(false);
      startTransition(() => setVisiblePlayers(rankedPlayers));
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    searchPlayers(trimmedQuery, rankedPlayers, 8)
      .then((matches) => {
        if (cancelled) {
          return;
        }

        const filteredMatches = matches.filter((player) =>
          snapshots.some((snapshot) => snapshot.playerId === player.id)
        );

        startTransition(() => setVisiblePlayers(filteredMatches));
      })
      .finally(() => {
        if (!cancelled) {
          setIsSearching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, players, snapshots]);

  return (
    <>
      <div className="search-shell">
        <label className="search-label" htmlFor="player-search">
          Find a player
        </label>
        <input
          id="player-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try 'anthny edwrds'"
          className="search-input"
          autoComplete="off"
        />
        <p className="search-meta">
          {query.trim()
            ? `${visiblePlayers.length} match${visiblePlayers.length === 1 ? "" : "es"} for "${query.trim()}"`
            : "Type a player name. Close spellings still find the right player."}
          {isSearching ? " Updating..." : ""}
        </p>
      </div>

      <div className="table-shell">
        <table className="rank-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Card tier</th>
              <th>Score</th>
              <th>Top %</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {visiblePlayers.length > 0 ? (
              visiblePlayers.map((player) => {
                const snapshot = snapshots.find((entry) => entry.playerId === player.id);
                const rankingIndex = snapshots.findIndex((entry) => entry.playerId === player.id);

                if (!snapshot || rankingIndex < 0) {
                  return null;
                }

                return (
                  <tr key={snapshot.playerId}>
                    <td>{rankingIndex + 1}</td>
                    <td>
                      <strong>{player.fullName}</strong>
                      <span>{player.team}</span>
                    </td>
                    <td>{formatTierLabel(snapshot.tier)}</td>
                    <td>{snapshot.playerPowerScore}</td>
                    <td>{snapshot.percentile}%</td>
                    <td>{snapshot.trendLabel}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="search-empty">
                  No players matched that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function buildRankedPlayers(players: Player[], snapshots: PlayerSnapshot[]): Player[] {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  return snapshots
    .map((snapshot) => playerMap.get(snapshot.playerId))
    .filter((player): player is Player => Boolean(player));
}
