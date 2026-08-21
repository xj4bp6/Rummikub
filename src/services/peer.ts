import Peer, { type DataConnection } from 'peerjs';
import type { GameState, GridTile, PeerMessage, PeerMessageType, Player, RoomSettings, Tile } from '../types/game';
import { generateFullDeck, shuffleDeck, dealInitialHands } from '../utils/deck';
import { validateGridBoard, calculateMeldPoints, calculateHandEndgamePoints } from '../utils/validation';

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

      const roomId = customRoomId 
        ? customRoomId.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
        : Math.floor(100000 + Math.random() * 900000).toString();

      this.peer = new Peer(roomId, { debug: 1 });

      this.peer.on('open', (id) => {
        this.localPlayerId = id;
        
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
          tableGrid: [],
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

      this.peer = new Peer({ debug: 1 });

      this.peer.on('open', (myPeerId) => {
        this.localPlayerId = myPeerId;

        const conn = this.peer!.connect(cleanedRoomId, { reliable: true });

        conn.on('open', () => {
          this.connections.set(cleanedRoomId, conn);

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
        this.gameState.players = this.gameState.players.filter((p) => p.id !== conn.peer);
        this.broadcastState();
      } else if (this.gameState) {
        const player = this.gameState.players.find((p) => p.id === conn.peer);
        if (player) {
          player.isDisconnected = true;
          this.broadcastState();
        }
      }
    });
  }

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
        if (this.isPlayerTurn(msg.senderId)) {
          this.gameState.tableGrid = msg.payload.tableGrid || [];
          const p = this.gameState.players.find((player) => player.id === msg.senderId);
          if (p) p.hand = msg.payload.hand;
          this.broadcastState();
        }
        break;
      }

      case 'ACTION_END_TURN': {
        if (this.isPlayerTurn(msg.senderId)) {
          this.handleEndTurnAttempt(conn, msg.senderId, msg.payload.hand, msg.payload.tableGrid);
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

  private handleClientReceivedData(data: any) {
    const msg = data as PeerMessage;
    if (msg.type === 'GAME_STATE_UPDATE') {
      this.gameState = msg.payload;
      this.notifyStateChange();
    } else if (msg.type === 'ACTION_ERROR') {
      if (this.onError) this.onError(msg.payload);
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

    let players = [...this.gameState.players];
    if (this.gameState.settings.orderOption === 'random') {
      for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
      }
    }

    const fullDeck = shuffleDeck(generateFullDeck());
    const dealResult = dealInitialHands(players, fullDeck);

    this.gameState.players = dealResult.players;
    this.gameState.drawPile = dealResult.drawPile;
    this.gameState.tableGrid = [];
    this.gameState.status = 'playing';
    this.gameState.currentTurnIndex = 0;
    this.gameState.winnerId = null;

    this.takeTurnSnapshot();
    this.startTurnTimer();
    this.broadcastState();
  }

  /**
   * Helper to send error toast specifically to the acting player (Client or Host)
   */
  private sendErrorToPlayer(conn: DataConnection | null, playerId: string, errorText: string) {
    if (playerId === this.localPlayerId) {
      if (this.onError) this.onError(errorText);
    } else if (conn && conn.open) {
      conn.send({
        type: 'ACTION_ERROR',
        senderId: this.localPlayerId,
        payload: errorText,
      });
    }
  }

  /**
   * Player attempts to end turn
   */
  public handleEndTurnAttempt(conn: DataConnection | null, playerId: string, updatedHand: Tile[], updatedTableGrid: GridTile[]) {
    if (!this.gameState) return;

    const player = this.gameState.players[this.gameState.currentTurnIndex];
    if (!player || player.id !== playerId) return;

    const snapshot = this.gameState.turnSnapshot;
    if (!snapshot) return;

    // 1. Validate Grid Board
    const gridValidation = validateGridBoard(updatedTableGrid);
    if (!gridValidation.allValid) {
      this.sendErrorToPlayer(conn, playerId, gridValidation.errorReason || '牌桌存在不合法的組合！');
      return;
    }

    // 2. Check if player played at least 1 card from hand
    const cardsPlayedFromHandCount = snapshot.hand.length - updatedHand.length;
    if (cardsPlayedFromHandCount <= 0) {
      this.sendErrorToPlayer(conn, playerId, '出牌回合必須至少打出 1 張手牌，否則請點擊摸牌！');
      return;
    }

    // 3. Check Initial Meld (>= 30 pts) if not melded yet
    if (!player.hasMelded) {
      const meldResult = calculateMeldPoints(gridValidation.extractedSets);
      if (!meldResult.isValidMelds || meldResult.totalPoints < 30) {
        this.sendErrorToPlayer(conn, playerId, `破冰失敗！首次出牌數字總和需 >= 30 分（目前為 ${meldResult.totalPoints} 分）`);
        return;
      }
      player.hasMelded = true;
    }

    // Commit turn
    player.hand = updatedHand;
    this.gameState.tableGrid = updatedTableGrid;

    // Win condition check
    if (player.hand.length === 0) {
      this.endGame(player.id, `${player.name} 已清空手牌獲勝！`);
      return;
    }

    this.advanceTurn();
  }

  public handleDrawTileAction(playerId: string) {
    if (!this.gameState) return;
    const player = this.gameState.players[this.gameState.currentTurnIndex];
    if (!player || player.id !== playerId) return;

    if (this.gameState.turnSnapshot) {
      player.hand = [...this.gameState.turnSnapshot.hand];
      this.gameState.tableGrid = [...this.gameState.turnSnapshot.tableGrid];
      player.hasMelded = this.gameState.turnSnapshot.hasMelded;
    }

    if (this.gameState.drawPile.length > 0) {
      const drawnTile = this.gameState.drawPile.pop()!;
      player.hand.push(drawnTile);
    } else {
      this.checkDeckExhaustedEndGame();
      return;
    }

    this.advanceTurn();
  }

  public handleRollbackAction(playerId: string) {
    if (!this.gameState) return;
    const player = this.gameState.players[this.gameState.currentTurnIndex];
    if (!player || player.id !== playerId) return;

    if (this.gameState.turnSnapshot) {
      player.hand = [...this.gameState.turnSnapshot.hand];
      this.gameState.tableGrid = [...this.gameState.turnSnapshot.tableGrid];
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
        tableGrid: JSON.parse(JSON.stringify(this.gameState.tableGrid)),
        hasMelded: currPlayer.hasMelded,
      };
    }
  }

  private startTurnTimer() {
    if (this.turnTimerInterval) clearInterval(this.turnTimerInterval);
    if (!this.gameState) return;

    const timerSetting = this.gameState.settings.turnTimer;
    if (timerSetting === 0) {
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

    if (this.gameState.drawPile.length === 0) {
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

  public sendClientAction(type: PeerMessageType, payload?: any) {
    if (this.isHost) {
      const msg: PeerMessage = { type, senderId: this.localPlayerId, payload };
      this.handleHostReceivedMessage(null as any, msg);
    } else {
      const hostConn = this.connections.get(this.gameState?.roomId || '');
      if (hostConn && hostConn.open) {
        hostConn.send({ type, senderId: this.localPlayerId, payload });
      }
    }
  }

  private broadcastState() {
    if (!this.isHost || !this.gameState) return;

    this.notifyStateChange();

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
