import type { Tile, TileSet } from '../types/game';

export interface SetValidationResult {
  isValid: boolean;
  type?: 'group' | 'run';
  score?: number;
  jokerValues?: Record<string, number>; // tileId -> represented value
  errorReason?: string;
}

/**
 * Validates if a group of tiles forms a valid Group (同數不同色, 3-4 tiles).
 */
export function validateGroup(tiles: Tile[]): SetValidationResult {
  if (tiles.length < 3 || tiles.length > 4) {
    return { isValid: false, errorReason: 'Group length must be 3 or 4 tiles' };
  }

  const nonJokers = tiles.filter((t) => !t.isJoker);
  if (nonJokers.length === 0) {
    // Only jokers (e.g. 3 jokers) - not possible as there are only 2 jokers in a 106 deck
    return { isValid: false, errorReason: 'Group cannot consist only of Jokers' };
  }

  // All non-jokers must have the same value
  const targetValue = nonJokers[0].value!;
  const sameValue = nonJokers.every((t) => t.value === targetValue);
  if (!sameValue) {
    return { isValid: false, errorReason: 'All tiles in a group must have the same number' };
  }

  // All non-jokers must have distinct colors
  const colorsUsed = new Set<string>();
  for (const t of nonJokers) {
    if (colorsUsed.has(t.color!)) {
      return { isValid: false, errorReason: 'Duplicate colors in group' };
    }
    colorsUsed.add(t.color!);
  }

  // Valid Group!
  const jokerValues: Record<string, number> = {};
  tiles.forEach((t) => {
    if (t.isJoker) {
      jokerValues[t.id] = targetValue;
    }
  });

  const totalScore = targetValue * tiles.length;

  return {
    isValid: true,
    type: 'group',
    score: totalScore,
    jokerValues,
  };
}

/**
 * Validates if a group of tiles forms a valid Run (同色連續數, 3+ tiles).
 */
export function validateRun(tiles: Tile[]): SetValidationResult {
  if (tiles.length < 3) {
    return { isValid: false, errorReason: 'Run must be at least 3 tiles' };
  }

  const nonJokers = tiles.filter((t) => !t.isJoker);
  if (nonJokers.length === 0) {
    return { isValid: false, errorReason: 'Run cannot consist only of Jokers' };
  }

  // All non-jokers must have the same color
  const targetColor = nonJokers[0].color!;
  const sameColor = nonJokers.every((t) => t.color === targetColor);
  if (!sameColor) {
    return { isValid: false, errorReason: 'All tiles in a run must have the same color' };
  }

  // Check if non-jokers can form a strictly ascending consecutive sequence within tiles.length range
  // Try all possible starting values for the run (from 1 to 13 - tiles.length + 1)
  const len = tiles.length;
  for (let startVal = 1; startVal <= 13 - len + 1; startVal++) {
    let possible = true;
    const currentJokerValues: Record<string, number> = {};
    let currentScore = 0;

    // Check if `tiles` can match the sequence [startVal, startVal+1, ..., startVal+len-1]
    // Note: order of tiles in array matters, or we can check if there exists a valid sequence.
    // In Rummikub, tiles in a run on the table are arranged in sequential order.
    // Let's check positional matching for tiles array order:
    for (let i = 0; i < len; i++) {
      const expectedVal = startVal + i;
      const tile = tiles[i];

      if (tile.isJoker) {
        currentJokerValues[tile.id] = expectedVal;
        currentScore += expectedVal;
      } else {
        if (tile.value !== expectedVal) {
          possible = false;
          break;
        }
        currentScore += expectedVal;
      }
    }

    if (possible) {
      return {
        isValid: true,
        type: 'run',
        score: currentScore,
        jokerValues: currentJokerValues,
      };
    }
  }

  return { isValid: false, errorReason: 'Tiles do not form a valid consecutive run' };
}

/**
 * Validates a single TileSet (can be either a Group or a Run).
 */
export function validateTileSet(set: TileSet): SetValidationResult {
  const groupRes = validateGroup(set.tiles);
  if (groupRes.isValid) return groupRes;

  const runRes = validateRun(set.tiles);
  if (runRes.isValid) return runRes;

  return {
    isValid: false,
    errorReason: groupRes.errorReason || runRes.errorReason || 'Invalid set',
  };
}

/**
 * Validates all sets on the table. Returns true if EVERY set is valid.
 */
export function validateTableSets(sets: TileSet[]): { allValid: boolean; invalidSetIds: string[] } {
  const invalidSetIds: string[] = [];

  for (const set of sets) {
    if (set.tiles.length === 0) continue; // Ignore empty sets
    const res = validateTileSet(set);
    if (!res.isValid) {
      invalidSetIds.push(set.id);
    }
  }

  return {
    allValid: invalidSetIds.length === 0,
    invalidSetIds,
  };
}

/**
 * Calculates total initial meld points from tiles played from hand.
 */
export function calculateMeldPoints(playedSets: TileSet[]): { totalPoints: number; isValidMelds: boolean } {
  let totalPoints = 0;
  let isValidMelds = true;

  for (const set of playedSets) {
    const res = validateTileSet(set);
    if (!res.isValid) {
      isValidMelds = false;
      break;
    }
    totalPoints += res.score || 0;
  }

  return { totalPoints, isValidMelds };
}

/**
 * Calculates endgame score for remaining hand tiles.
 * Regular tiles = face value. Joker = 30 points penalty!
 */
export function calculateHandEndgamePoints(hand: Tile[]): { totalPoints: number; detail: string } {
  let totalPoints = 0;
  const parts: string[] = [];

  for (const tile of hand) {
    if (tile.isJoker) {
      totalPoints += 30;
      parts.push('鬼牌(30分)');
    } else {
      const val = tile.value || 0;
      totalPoints += val;
      parts.push(`${tile.color}${val}`);
    }
  }

  return {
    totalPoints,
    detail: parts.length > 0 ? parts.join(', ') : '無手牌(0分)',
  };
}
