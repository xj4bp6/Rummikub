import React, { useEffect, useState } from 'react';
import type { GameState, RoomSettings, Tile, TileSet } from './types/game';
import { peerService } from './services/peer';
import { sortHand } from './utils/deck';
import { Lobby } from './components/Lobby';
import { GameHeader } from './components/GameHeader';
import { FourSidesLayout } from './components/FourSidesLayout';
import { TableBoard } from './components/TableBoard';
import { PlayerRack } from './components/PlayerRack';
import { WinModal } from './components/WinModal';

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tile Selection State
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedSourceSetId, setSelectedSourceSetId] = useState<string | undefined>(undefined);

  useEffect(() => {
    peerService.onStateChange = (newState) => {
      setGameState(newState);
      setLocalPlayerId(peerService.getLocalPlayerId());
    };

    peerService.onError = (msg) => {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 4000);
    };
  }, []);

  // --- Lobby Handlers ---
  const handleCreateRoom = async (hostName: string, settings: RoomSettings) => {
    try {
      await peerService.createRoom(hostName);
      peerService.updateRoomSettings(settings);
    } catch (err: any) {
      setErrorMessage('建立房間失敗，請再試一次');
    }
  };

  const handleJoinRoom = async (roomId: string, playerName: string) => {
    try {
      await peerService.joinRoom(roomId, playerName);
    } catch (err: any) {
      setErrorMessage('無法連線至房間代碼，請確認代碼是否正確');
    }
  };

  const handleUpdateSettings = (settings: RoomSettings) => {
    peerService.updateRoomSettings(settings);
  };

  const handleStartGame = () => {
    peerService.startGame();
  };

  const handleLeaveRoom = () => {
    window.location.reload();
  };

  // --- In-Game Interaction Handlers ---

  const localPlayer = gameState?.players.find((p) => p.id === localPlayerId);
  const isMyTurn = gameState?.status === 'playing' && gameState.players[gameState.currentTurnIndex]?.id === localPlayerId;

  // Handle tile click (either from Hand or Table)
  const handleTileClick = (tile: Tile, sourceSetId?: string) => {
    if (!isMyTurn) return;

    if (selectedTileId === tile.id) {
      // Unselect if clicked again
      setSelectedTileId(null);
      setSelectedSourceSetId(undefined);
    } else {
      setSelectedTileId(tile.id);
      setSelectedSourceSetId(sourceSetId);
    }
  };

  // Move selected tile into an existing table set
  const handleMoveTileToSet = (targetSetId: string) => {
    if (!isMyTurn || !selectedTileId || !gameState || !localPlayer) return;

    let tileToMove: Tile | null = null;
    let newHand = [...localPlayer.hand];
    let newTableSets = JSON.parse(JSON.stringify(gameState.tableSets)) as TileSet[];

    // 1. Remove tile from source (Hand or Table Set)
    if (!selectedSourceSetId) {
      // Source is Hand
      const tileIdx = newHand.findIndex((t) => t.id === selectedTileId);
      if (tileIdx !== -1) {
        tileToMove = newHand.splice(tileIdx, 1)[0];
      }
    } else {
      // Source is Table Set
      const sourceSet = newTableSets.find((s) => s.id === selectedSourceSetId);
      if (sourceSet) {
        const tileIdx = sourceSet.tiles.findIndex((t) => t.id === selectedTileId);
        if (tileIdx !== -1) {
          tileToMove = sourceSet.tiles.splice(tileIdx, 1)[0];
        }
      }
    }

    // 2. Add tile to target Set
    if (tileToMove) {
      const targetSet = newTableSets.find((s) => s.id === targetSetId);
      if (targetSet) {
        targetSet.tiles.push(tileToMove);
      }
    }

    // 3. Clear empty sets
    newTableSets = newTableSets.filter((s) => s.tiles.length > 0);

    // 4. Update state & sync
    setSelectedTileId(null);
    setSelectedSourceSetId(undefined);
    peerService.sendClientAction('ACTION_MOVE', { hand: newHand, tableSets: newTableSets });
  };

  // Create a brand new set on table using selected tile
  const handleCreateNewSetWithSelectedTile = () => {
    if (!isMyTurn || !selectedTileId || !gameState || !localPlayer) return;

    let tileToMove: Tile | null = null;
    let newHand = [...localPlayer.hand];
    let newTableSets = JSON.parse(JSON.stringify(gameState.tableSets)) as TileSet[];

    if (!selectedSourceSetId) {
      // From Hand
      const tileIdx = newHand.findIndex((t) => t.id === selectedTileId);
      if (tileIdx !== -1) {
        tileToMove = newHand.splice(tileIdx, 1)[0];
      }
    } else {
      // From Table
      const sourceSet = newTableSets.find((s) => s.id === selectedSourceSetId);
      if (sourceSet) {
        const tileIdx = sourceSet.tiles.findIndex((t) => t.id === selectedTileId);
        if (tileIdx !== -1) {
          tileToMove = sourceSet.tiles.splice(tileIdx, 1)[0];
        }
      }
    }

    if (tileToMove) {
      const newSet: TileSet = {
        id: `set-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tiles: [tileToMove],
      };
      newTableSets.push(newSet);
    }

    newTableSets = newTableSets.filter((s) => s.tiles.length > 0);

    setSelectedTileId(null);
    setSelectedSourceSetId(undefined);
    peerService.sendClientAction('ACTION_MOVE', { hand: newHand, tableSets: newTableSets });
  };

  // Sort hand
  const handleSortHand = (sortBy: 'color' | 'value') => {
    if (!localPlayer || !gameState) return;
    const sorted = sortHand(localPlayer.hand, sortBy);

    if (isMyTurn) {
      peerService.sendClientAction('ACTION_MOVE', { hand: sorted, tableSets: gameState.tableSets });
    } else {
      // Local client visual sort
      const updatedPlayers = gameState.players.map((p) =>
        p.id === localPlayerId ? { ...p, hand: sorted } : p
      );
      setGameState({ ...gameState, players: updatedPlayers });
    }
  };

  // Turn Actions
  const handleEndTurn = () => {
    if (!isMyTurn || !gameState || !localPlayer) return;
    peerService.sendClientAction('ACTION_END_TURN', {
      hand: localPlayer.hand,
      tableSets: gameState.tableSets,
    });
  };

  const handleDrawTile = () => {
    if (!isMyTurn) return;
    peerService.sendClientAction('ACTION_DRAW');
  };

  const handleResetTurn = () => {
    if (!isMyTurn) return;
    setSelectedTileId(null);
    setSelectedSourceSetId(undefined);
    peerService.sendClientAction('ACTION_RESET_TURN');
  };

  // Show Lobby if not in playing/ended state
  if (!gameState || gameState.status === 'lobby') {
    return (
      <Lobby
        gameState={gameState}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onUpdateSettings={handleUpdateSettings}
        onStartGame={handleStartGame}
        localPlayerId={localPlayerId}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Error Toast */}
      {errorMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-2xl z-50 animate-bounce">
          {errorMessage}
        </div>
      )}

      {/* Top Navigation & Status Bar */}
      <GameHeader
        gameState={gameState}
        localPlayerId={localPlayerId}
        onLeaveRoom={handleLeaveRoom}
      />

      {/* Main 4-Side Viewport Table Layout */}
      <FourSidesLayout
        players={gameState.players}
        currentTurnIndex={gameState.currentTurnIndex}
        localPlayerId={localPlayerId}
      >
        <TableBoard
          tableSets={gameState.tableSets}
          selectedTileId={selectedTileId}
          onTileClick={handleTileClick}
          onMoveTileToSet={handleMoveTileToSet}
          onCreateNewSetWithSelectedTile={handleCreateNewSetWithSelectedTile}
          isMyTurn={isMyTurn}
        />
      </FourSidesLayout>

      {/* Bottom Player Hand Rack */}
      {localPlayer && (
        <PlayerRack
          hand={localPlayer.hand}
          selectedTileId={selectedTileId}
          onTileClick={(tile) => handleTileClick(tile)}
          onSortHand={handleSortHand}
          onEndTurn={handleEndTurn}
          onDrawTile={handleDrawTile}
          onResetTurn={handleResetTurn}
          isMyTurn={isMyTurn}
          hasMelded={localPlayer.hasMelded}
        />
      )}

      {/* Win / Endgame Modal */}
      {gameState.status === 'ended' && (
        <WinModal gameState={gameState} onBackToLobby={handleLeaveRoom} />
      )}
    </div>
  );
};

export default App;
