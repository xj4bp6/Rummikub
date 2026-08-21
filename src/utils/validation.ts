import type { Tile, TileSet, GridTile } from '../types/game';

export interface SetValidationResult {
  isValid: boolean;
  type?: 'group' | 'run';
  score?: number;
  jokerValues?: Record<string, number>; // tileId -> represented value
  errorReason?: string;
}

export const GRID_ROWS = 10;
export const GRID_COLS = 16;

/**
 * Scans a 2D Grid of tiles and extracts all horizontal contiguous tile sets.
 */
export function extractTileSetsFromGrid(gridTiles: GridTile[]): {
  sets: TileSet[];
  singleTiles: GridTile[];
} {
  // Build lookup map: `${row}_${col}` -> Tile
  const gridMap = new Map<string, Tile>();
  const tileToPosMap = new Map<string, GridTile>();

  gridTiles.forEach((gt) => {
    const key = `${gt.row}_${gt.col}`;
    gridMap.set(key, gt.tile);
    tileToPosMap.set(gt.tile.id, gt);
  });

  const extractedSets: TileSet[] = [];
  const singleTiles: GridTile[] = [];

  for (let r = 0; r < GRID_ROWS; r++) {
    let currentSequence: Tile[] = [];

    for (let c = 0; c < GRID_COLS; c++) {
      const key = `${r}_${c}`;
      const tile = gridMap.get(key);

      if (tile) {
        currentSequence.push(tile);
      } else {
        if (currentSequence.length > 0) {
          if (currentSequence.length < 3) {
            currentSequence.forEach((t) => {
              const pos = tileToPosMap.get(t.id);
              if (pos) singleTiles.push(pos);
            });
          } else {
            extractedSets.push({
              id: `grid-set-${r}-${c}-${Math.random().toString(36).substr(2, 4)}`,
              tiles: currentSequence,
            });
          }
          currentSequence = [];
        }
      }
    }

    // End of row check
    if (currentSequence.length > 0) {
      if (currentSequence.length < 3) {
        currentSequence.forEach((t) => {
          const pos = tileToPosMap.get(t.id);
          if (pos) singleTiles.push(pos);
        });
      } else {
        extractedSets.push({
          id: `grid-set-${r}-end-${Math.random().toString(36).substr(2, 4)}`,
          tiles: currentSequence,
        });
      }
    }
  }

  return { sets: extractedSets, singleTiles };
}

/**
 * Validates all tiles placed on the grid board.
 */
export function validateGridBoard(gridTiles: GridTile[]): {
  allValid: boolean;
  extractedSets: TileSet[];
  errorReason?: string;
} {
  const { sets, singleTiles } = extractTileSetsFromGrid(gridTiles);

  if (singleTiles.length > 0) {
    return {
      allValid: false,
      extractedSets: sets,
      errorReason: `牌桌上存在不滿 3 張的單獨卡牌 (${singleTiles.length} 張)`,
    };
  }

  for (const set of sets) {
    const res = validateTileSet(set);
    if (!res.isValid) {
      return {
        allValid: false,
        extractedSets: sets,
        errorReason: res.errorReason || '牌桌存在不合法的組合！',
      };
    }
  }

  return {
    allValid: true,
    extractedSets: sets,
  };
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

  const len = tiles.length;
  for (let startVal = 1; startVal <= 13 - len + 1; startVal++) {
    let possible = true;
    const currentJokerValues: Record<string, number> = {};
    let currentScore = 0;

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
 * Validates a single TileSet (Group or Run).
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
 * Calculates total initial meld points from newly played sets.
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

/**
 * Utility: Checks if adjacent tiles in hand form a valid chain (consecutive run or matching group).
 */
export function findConnectedChain(tiles: Tile[], startIndex: number): Tile[] {
  if (startIndex < 0 || startIndex >= tiles.length) return [];
  const chain: Tile[] = [tiles[startIndex]];

  for (let i = startIndex + 1; i < tiles.length; i++) {
    const prev = chain[chain.length - 1];
    const curr = tiles[i];

    // Check if curr can extend run (same color, +1) or group (same value, diff color)
    if (!prev.isJoker && !curr.isJoker) {
      const isConsecutiveRun = prev.color === curr.color && (curr.value || 0) === (prev.value || 0) + 1;
      const isMatchingGroup = (prev.value || 0) === (curr.value || 0) && prev.color !== curr.color;

      if (isConsecutiveRun || isMatchingGroup) {
        chain.push(curr);
      } else {
        break;
      }
    } else {
      chain.push(curr);
    }
  }

  return chain;
}
