import Peer, { type DataConnection } from 'peerjs';
import type { GameState, PeerMessage, PeerMessageType, Player, RoomSettings, Tile, TileSet } from '../types/game';
import { generateFullDeck, shuffleDeck, dealInitialHands } from '../utils/deck';
import { validateTableSets, calculateMeldPoints, calculateHandEndgamePoints } from '../utils/validation';

export class PeerService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map(); // peerId -> DataConnection
  private isHost: boolean = false;
  private localPlayerId: string = '';

  private gameState: GameState | null = null;
  private turnTimerInterval: any = null;

  // Callbacks
  public onStateChange?: (state: GameState) => void;
  public onError?: (msg: string) => void;
  public onConnected?: (peerId: string) => void;

  /**
   * Initializes a Host Room (Room ID = peerId)
   */
  public createRoom(hostName: string, customRoomId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.isHost = true;

      // Clean ID format
      const roomId = customRoomId 
        ? customRoomId.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
        : Math.floor(100000 + Math.random() * 900000).toString();

      this.peer = new Peer(roomId, {
        debug: 1,
      });

      this.peer.on('open', (id) => {
        this.localPlayerId = id;
        
        // Initialize GameState on Host
        this.gameState = {
          roomId: id,
          status: 'lobby',
          players: [
            {
              id: id,
              name: hostName,
              hand: [],
              hasMelded: false,
              isHost: true,
            },
          ],
          currentTurnIndex: 0,
          drawPile: [],
          tableSets: [],
          turnTimerRemaining: 60,
          settings: {
            turnTimer: 60,
            orderOption: 'join',
          },
        };

        this.notifyStateChange();
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleHostIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (this.onError) this.onError(err.message || '連線發生錯誤');
        reject(err);
      });
    });
  }

  /**
   * Joins an existing Host Room via Room ID
   */
  public joinRoom(roomId: string, playerName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.isHost = false;

      const cleanedRoomId = roomId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

      this.peer = new Peer({
        debug: 1,
      });

      this.peer.on('open', (myPeerId) => {
        this.localPlayerId = myPeerId;

        const conn = this.peer!.connect(cleanedRoomId, {
          reliable: true,
        });

        conn.on('open', () => {
          this.connections.set(cleanedRoomId, conn);

          // Send JOIN_REQUEST to host
          const joinMsg: PeerMessage = {
            type: 'JOIN_REQUEST',
            senderId: myPeerId,
            senderName: playerName,
          };
          conn.send(joinMsg);

          if (this.onConnected) this.onConnected(cleanedRoomId);
          resolve(cleanedRoomId);
        });

        conn.on('data', (data: any) => {
          this.handleClientReceivedData(data);
        });

        conn.on('close', () => {
          if (this.onError) this.onError('與房主的連線已中斷');
        });

        conn.on('error', (err) => {
          console.error('Connection error:', err);
          if (this.onError) this.onError('無法連線至房間代碼，請確認代碼是否正確');
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (this.onError) this.onError(err.message || '連線發生錯誤');
        reject(err);
      });
    });
  }

  /**
   * Host logic: handles incoming client connections
   */
  private handleHostIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data: any) => {
      const msg = data as PeerMessage;
      this.handleHostReceivedMessage(conn, msg);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.gameState && this.gameState.status === 'lobby') {
        // Remove player from lobby
        this.gameState.players = this.gameState.players.filter((p) => p.id !== conn.peer);
        this.broadcastState();
      } else if (this.gameState) {
        // Mark player as disconnected during game
        const player = this.gameState.players.find((p) => p.id === conn.peer);
        if (player) {
          player.isDisconnected = true;
          this.broadcastState();
        }
      }
    });
  }

  /**
   * Host logic: process incoming messages from clients
   */
  private handleHostReceivedMessage(conn: DataConnection, msg: PeerMessage) {
    if (!this.gameState) return;

    switch (msg.type) {
      case 'JOIN_REQUEST': {
        if (this.gameState.status !== 'lobby') {
          conn.send({ type: 'HOST_LEAVING', senderId: this.localPlayerId, payload: '遊戲已在進行中' });
          return;
        }
        if (this.gameState.players.length >= 4) {
          conn.send({ type: 'HOST_LEAVING', senderId: this.localPlayerId, payload: '房間人數已滿 (上限 4 人)' });
          return;
        }

        const newPlayer: Player = {
          id: msg.senderId,
          name: msg.senderName || '玩家',
          hand: [],
          hasMelded: false,
          isHost: false,
        };

        this.gameState.players.push(newPlayer);
        this.broadcastState();
        break;
      }

      case 'ACTION_MOVE': {
        // Client syncs transient hand & table state during turn
        if (this.isPlayerTurn(msg.senderId)) {
          this.gameState.tableSets = msg.payload.tableSets;
          const p = this.gameState.players.find((player) => player.id === msg.senderId);
          if (p) p.hand = msg.payload.hand;
          this.broadcastState();
        }
        break;
      }

      case 'ACTION_END_TURN': {
        if (this.isPlayerTurn(msg.senderId)) {
          this.handleEndTurnAttempt(msg.senderId, msg.payload.hand, msg.payload.tableSets);
        }
        break;
      }

      case 'ACTION_DRAW': {
        if (this.isPlayerTurn(msg.senderId)) {
          this.handleDrawTileAction(msg.senderId);
        }
        break;
      }

      case 'ACTION_RESET_TURN': {
        if (this.isPlayerTurn(msg.senderId)) {
          this.handleRollbackAction(msg.senderId);
        }
        break;
      }
    }
  }

  /**
   * Client logic: process data received from host
   */
  private handleClientReceivedData(data: any) {
    const msg = data as PeerMessage;
    if (msg.type === 'GAME_STATE_UPDATE') {
      this.gameState = msg.payload;
      this.notifyStateChange();
    } else if (msg.type === 'HOST_LEAVING') {
      if (this.onError) this.onError(msg.payload || '房主已離開房間');
    }
  }

  // --- Host Game Actions ---

  public updateRoomSettings(settings: RoomSettings) {
    if (!this.isHost || !this.gameState) return;
    this.gameState.settings = settings;
    this.broadcastState();
  }

  public startGame() {
    if (!this.isHost || !this.gameState) return;
    if (this.gameState.players.length < 2) {
      if (this.onError) this.onError('需要至少 2 人才能開始遊戲');
      return;
    }

    // 1. Determine player turn order
    let players = [...this.gameState.players];
    if (this.gameState.settings.orderOption === 'random') {
      for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
      }
    }

    // 2. Generate and deal cards
    const fullDeck = shuffleDeck(generateFullDeck());
    const dealResult = dealInitialHands(players, fullDeck);

    this.gameState.players = dealResult.players;
    this.gameState.drawPile = dealResult.drawPile;
    this.gameState.tableSets = [];
    this.gameState.status = 'playing';
    this.gameState.currentTurnIndex = 0;
    this.gameState.winnerId = null;

    // Create snapshot for first player
    this.takeTurnSnapshot();
    this.startTurnTimer();
    this.broadcastState();
  }

  /**
   * Player attempts to end turn
   */
  public handleEndTurnAttempt(playerId: string, updatedHand: any[], updatedTableSets: any[]) {
    if (!this.gameState) return;

    const player = this.gameState.players[this.gameState.currentTurnIndex];
    if (!player || player.id !== playerId) return;

    const snapshot = this.gameState.turnSnapshot;
    if (!snapshot) return;

    // 1. Verify Table Sets validity
    const tableCheck = validateTableSets(updatedTableSets);
    if (!tableCheck.allValid) {
      if (this.onError) this.onError('牌桌上存在不合法的組合！');
      return;
    }

    // 2. Verify player played at least 1 card from hand
    const cardsPlayedFromHandCount = snapshot.hand.length - updatedHand.length;
    if (cardsPlayedFromHandCount <= 0) {
      if (this.onError) this.onError('出牌回合必須至少打出 1 張手牌，否則請點擊摸牌！');
      return;
    }

    // 3. Initial Meld check if not melded yet
    if (!player.hasMelded) {
      // Find cards played from hand
      const playedSets = updatedTableSets.filter(
        (set: TileSet) => set.tiles.length >= 3 && set.tiles.some((t: Tile) => !snapshot.tableSets.flatMap((s: TileSet) => s.tiles).some((st: Tile) => st.id === t.id))
      );

      const meldResult = calculateMeldPoints(playedSets);
      if (!meldResult.isValidMelds || meldResult.totalPoints < 30) {
        if (this.onError) this.onError(`破冰失敗！首次出牌數字總和需 $\\ge 30$ 分（目前為 ${meldResult.totalPoints} 分）`);
        return;
      }
      player.hasMelded = true;
    }

    // Commit turn changes
    player.hand = updatedHand;
    this.gameState.tableSets = updatedTableSets.filter((s) => s.tiles.length > 0);

    // Check Win Condition
    if (player.hand.length === 0) {
      this.endGame(player.id, `${player.name} 已清空手牌獲勝！`);
      return;
    }

    // Advance turn
    this.advanceTurn();
  }

  /**
   * Player draws a card and ends turn
   */
  public handleDrawTileAction(playerId: string) {
    if (!this.gameState) return;
    const player = this.gameState.players[this.gameState.currentTurnIndex];
    if (!player || player.id !== playerId) return;

    // Rollback table and hand to snapshot first
    if (this.gameState.turnSnapshot) {
      player.hand = [...this.gameState.turnSnapshot.hand];
      this.gameState.tableSets = [...this.gameState.turnSnapshot.tableSets];
      player.hasMelded = this.gameState.turnSnapshot.hasMelded;
    }

    // Draw 1 tile if drawPile has cards
    if (this.gameState.drawPile.length > 0) {
      const drawnTile = this.gameState.drawPile.pop()!;
      player.hand.push(drawnTile);
    } else {
      // Draw pile exhausted - check if game end needed
      this.checkDeckExhaustedEndGame();
      return;
    }

    this.advanceTurn();
  }

  /**
   * Resets local turn state back to start of turn (Rollback)
   */
  public handleRollbackAction(playerId: string) {
    if (!this.gameState) return;
    const player = this.gameState.players[this.gameState.currentTurnIndex];
    if (!player || player.id !== playerId) return;

    if (this.gameState.turnSnapshot) {
      player.hand = [...this.gameState.turnSnapshot.hand];
      this.gameState.tableSets = [...this.gameState.turnSnapshot.tableSets];
      player.hasMelded = this.gameState.turnSnapshot.hasMelded;
      this.broadcastState();
    }
  }

  private advanceTurn() {
    if (!this.gameState) return;

    this.gameState.currentTurnIndex = (this.gameState.currentTurnIndex + 1) % this.gameState.players.length;
    this.takeTurnSnapshot();
    this.startTurnTimer();
    this.broadcastState();
  }

  private takeTurnSnapshot() {
    if (!this.gameState) return;
    const currPlayer = this.gameState.players[this.gameState.currentTurnIndex];
    if (currPlayer) {
      this.gameState.turnSnapshot = {
        hand: JSON.parse(JSON.stringify(currPlayer.hand)),
        tableSets: JSON.parse(JSON.stringify(this.gameState.tableSets)),
        hasMelded: currPlayer.hasMelded,
      };
    }
  }

  private startTurnTimer() {
    if (this.turnTimerInterval) clearInterval(this.turnTimerInterval);
    if (!this.gameState) return;

    const timerSetting = this.gameState.settings.turnTimer;
    if (timerSetting === 0) {
      // Unlimited timer
      this.gameState.turnTimerRemaining = 0;
      return;
    }

    this.gameState.turnTimerRemaining = timerSetting;

    this.turnTimerInterval = setInterval(() => {
      if (!this.gameState || this.gameState.status !== 'playing') {
        clearInterval(this.turnTimerInterval);
        return;
      }

      this.gameState.turnTimerRemaining--;
      if (this.gameState.turnTimerRemaining <= 0) {
        // Time out! Force Rollback + Penalty Draw tile
        const currPlayer = this.gameState.players[this.gameState.currentTurnIndex];
        if (currPlayer) {
          this.handleDrawTileAction(currPlayer.id);
        }
      } else {
        this.broadcastState();
      }
    }, 1000);
  }

  private checkDeckExhaustedEndGame() {
    if (!this.gameState) return;

    // Check if draw pile is empty
    if (this.gameState.drawPile.length === 0) {
      // Calculate scores for all players (Joker = 30 pts)
      const scores: Record<string, { handSum: number; detail: string }> = {};
      let minScore = Infinity;
      let winnerId = '';

      this.gameState.players.forEach((p) => {
        const res = calculateHandEndgamePoints(p.hand);
        scores[p.id] = { handSum: res.totalPoints, detail: res.detail };
        if (res.totalPoints < minScore) {
          minScore = res.totalPoints;
          winnerId = p.id;
        }
      });

      this.gameState.endGameScores = scores;
      const winnerName = this.gameState.players.find((p) => p.id === winnerId)?.name || '未知玩家';
      this.endGame(winnerId, `牌庫已耗盡！經手牌點數結算（鬼牌為30分），【${winnerName}】以最低點數 (${minScore}分) 獲勝！`);
    }
  }

  private endGame(winnerId: string, reason: string) {
    if (!this.gameState) return;
    if (this.turnTimerInterval) clearInterval(this.turnTimerInterval);

    this.gameState.status = 'ended';
    this.gameState.winnerId = winnerId;
    this.gameState.endReason = reason;

    this.broadcastState();
  }

  // --- Actions Callable by Client (dispatches via WebRTC or Host local call) ---

  public sendClientAction(type: PeerMessageType, payload?: any) {
    if (this.isHost) {
      // Local Host invocation
      const msg: PeerMessage = { type, senderId: this.localPlayerId, payload };
      this.handleHostReceivedMessage({ send: () => {}, peer: this.localPlayerId } as any, msg);
    } else {
      // Send to Host
      const hostConn = this.connections.get(this.gameState?.roomId || '');
      if (hostConn && hostConn.open) {
        hostConn.send({ type, senderId: this.localPlayerId, payload });
      }
    }
  }

  private broadcastState() {
    if (!this.isHost || !this.gameState) return;

    // Notify local Host UI
    this.notifyStateChange();

    // Broadcast state to all connected Clients
    const msg: PeerMessage = {
      type: 'GAME_STATE_UPDATE',
      senderId: this.localPlayerId,
      payload: this.gameState,
    };

    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }

  private notifyStateChange() {
    if (this.gameState && this.onStateChange) {
      this.onStateChange({ ...this.gameState });
    }
  }

  private isPlayerTurn(playerId: string): boolean {
    if (!this.gameState || this.gameState.status !== 'playing') return false;
    const currentTurnPlayer = this.gameState.players[this.gameState.currentTurnIndex];
    return currentTurnPlayer?.id === playerId;
  }

  public getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }
}

export const peerService = new PeerService();
