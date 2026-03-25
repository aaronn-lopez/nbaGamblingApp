import type { PropsWithChildren } from "react";

interface PlayerLike {
  fullName?: string;
  team?: string;
}

interface PlayerSnapshotLike {
  tier: string;
  playerPowerScore: number;
  trendLabel: string;
}

interface CardLike {
  id: string;
  playerId: string;
  tierAtMint: string;
  serialNumber: number;
  edition: string;
}

interface ListingLike {
  id: string;
  playerId: string;
  tierAtMint: string;
  serialNumber: number;
  askingPrice: number;
  expiresAt: string;
}

export function SectionCard({
  title,
  eyebrow,
  className,
  children
}: PropsWithChildren<{ title: string; eyebrow?: string; className?: string }>) {
  return (
    <section className={["cc-surface", className].filter(Boolean).join(" ")}>
      {eyebrow ? <p className="cc-eyebrow">{eyebrow}</p> : null}
      <div className="cc-section-head">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function MetricRibbon({
  label,
  value,
  tone = "warm"
}: {
  label: string;
  value: string;
  tone?: "warm" | "cool" | "gold";
}) {
  return (
    <div className={`cc-ribbon cc-ribbon-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PlayerSpotlight({
  player,
  snapshot,
  subtitle
}: {
  player: PlayerLike;
  snapshot: PlayerSnapshotLike;
  subtitle: string;
}) {
  return (
    <article className="cc-player-spotlight">
      <div>
        <p className="cc-eyebrow">{snapshot.tier}</p>
        <h3>{player.fullName}</h3>
        <p>{subtitle}</p>
      </div>
      <dl>
        <div>
          <dt>Projection</dt>
          <dd>{snapshot.playerPowerScore}</dd>
        </div>
        <div>
          <dt>Trend</dt>
          <dd>{snapshot.trendLabel}</dd>
        </div>
      </dl>
    </article>
  );
}

export function CardShelf({
  title,
  cards,
  players
}: {
  title: string;
  cards: CardLike[];
  players: Map<string, PlayerLike>;
}) {
  return (
    <div className="cc-card-shelf">
      <div className="cc-card-shelf-head">
        <h3>{title}</h3>
        <span>{cards.length} cards</span>
      </div>
      <div className="cc-grid">
        {cards.map((card) => {
          const player = players.get(card.playerId);
          return (
            <article className="cc-collectible" key={card.id}>
              <p className="cc-eyebrow">
                {card.tierAtMint} · #{card.serialNumber}
              </p>
              <h4>{player?.fullName ?? card.playerId}</h4>
              <p>
                {player?.team} · {card.edition}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function ListingRow({
  listing,
  player
}: {
  listing: ListingLike;
  player: PlayerLike | undefined;
}) {
  return (
    <article className="cc-listing-row">
      <div>
        <p className="cc-eyebrow">{listing.tierAtMint}</p>
        <h4>{player?.fullName ?? listing.playerId}</h4>
        <p>
          #{listing.serialNumber} · expires {new Date(listing.expiresAt).toLocaleDateString()}
        </p>
      </div>
      <strong>{listing.askingPrice} CC</strong>
    </article>
  );
}
