import type { Tile, TileColor, Player } from '../types/game';

export const COLORS: TileColor[] = ['red', 'black', 'orange', 'blue'];

/**
 * Generates a full Rummikub deck of 106 tiles (104 regular tiles + 2 Jokers).
 */
export function generateFullDeck(): Tile[] {
  const deck: Tile[] = [];

  // Generate 104 regular tiles (4 colors * 13 numbers * 2 copies)
  COLORS.forEach((color) => {
    for (let val = 1; val <= 13; val++) {
      for (let copy = 1; copy <= 2; copy++) {
        deck.push({
          id: `${color}-${val}-${copy}`,
          color,
          value: val,
          isJoker: false,
        });
      }
    }
  });

  // Generate 2 Jokers
  deck.push({
    id: 'joker-1',
    isJoker: true,
  });
  deck.push({
    id: 'joker-2',
    isJoker: true,
  });

  return deck;
}

/**
 * Shuffles an array of tiles using Fisher-Yates algorithm.
 */
export function shuffleDeck(deck: Tile[]): Tile[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deals 14 initial tiles to each player and returns the remaining draw pile.
 */
export function dealInitialHands(
  players: Player[],
  shuffledDeck: Tile[]
): { players: Player[]; drawPile: Tile[] } {
  const deck = [...shuffledDeck];
  const updatedPlayers = players.map((player) => {
    const hand = deck.splice(0, 14);
    return {
      ...player,
      hand,
      hasMelded: false,
    };
  });

  return {
    players: updatedPlayers,
    drawPile: deck,
  };
}

/**
 * Sorts player's hand tiles by color or by value.
 */
export function sortHand(hand: Tile[], sortBy: 'color' | 'value'): Tile[] {
  const colorOrder: Record<TileColor, number> = {
    red: 1,
    black: 2,
    orange: 3,
    blue: 4,
  };

  return [...hand].sort((a, b) => {
    // Jokers always at the end
    if (a.isJoker) return 1;
    if (b.isJoker) return -1;

    if (sortBy === 'color') {
      const colorA = colorOrder[a.color!];
      const colorB = colorOrder[b.color!];
      if (colorA !== colorB) {
        return colorA - colorB;
      }
      return (a.value || 0) - (b.value || 0);
    } else {
      // sort by value
      const valA = a.value || 0;
      const valB = b.value || 0;
      if (valA !== valB) {
        return valA - valB;
      }
      return colorOrder[a.color!] - colorOrder[b.color!];
    }
  });
}
