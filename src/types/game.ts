export type TileColor = 'red' | 'black' | 'orange' | 'blue';

export interface Tile {
  id: string;          // Unique ID, e.g. "red-7-1", "joker-1"
  color?: TileColor;   // undefined for Joker
  value?: number;      // 1-13, undefined for Joker
  isJoker: boolean;
}

export interface GridTile {
  tile: Tile;
  row: number;
  col: number;
}

export type SetType = 'group' | 'run' | 'invalid';

export interface TileSet {
  id: string;
  tiles: Tile[];
  isValid?: boolean;
}

export interface Player {
  id: string;
  name: string;
  hand: Tile[];
  hasMelded: boolean;  // Has completed Initial Meld (破冰 >= 30 pts)
  isHost: boolean;
  isDisconnected?: boolean;
}

export type TimerOption = 30 | 45 | 60 | 90 | 120 | 0; // 0 = unlimited
export type TurnOrderOption = 'join' | 'random';

export interface RoomSettings {
  turnTimer: TimerOption;
  orderOption: TurnOrderOption;
}

export type GameStatus = 'lobby' | 'playing' | 'ended';

export interface TurnSnapshot {
  hand: Tile[];
  tableGrid: GridTile[];
  hasMelded: boolean;
}

export interface GameState {
  roomId: string;
  status: GameStatus;
  players: Player[];
  currentTurnIndex: number;
  drawPile: Tile[];
  tableGrid: GridTile[]; // Transparent 2D grid board tiles
  tableSets?: TileSet[]; // Legacy fallback if needed
  turnTimerRemaining: number;
  settings: RoomSettings;
  winnerId?: string | null;
  endReason?: string;
  endGameScores?: Record<string, { handSum: number; detail: string }>;
  turnSnapshot?: TurnSnapshot;
}

// PeerJS Signaling & Message payloads
export type PeerMessageType = 
  | 'JOIN_REQUEST'
  | 'GAME_STATE_UPDATE'
  | 'ACTION_MOVE'
  | 'ACTION_END_TURN'
  | 'ACTION_DRAW'
  | 'ACTION_RESET_TURN'
  | 'ACTION_ERROR'
  | 'START_GAME'
  | 'SETTINGS_UPDATE'
  | 'HOST_LEAVING';

export interface PeerMessage {
  type: PeerMessageType;
  senderId: string;
  senderName?: string;
  payload?: any;
}
