import React, { useEffect, useState } from 'react';
import type { GameState, RoomSettings, Tile } from './types/game';
import { peerService } from './services/peer';
import { sortHand } from './utils/deck';
import { findConnectedChain } from './utils/validation';
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

  // Multi-tile selection state
  const [selectedTileIds, setSelectedTileIds] = useState<string[]>([]);

  useEffect(() => {
    peerService.onStateChange = (newState) => {
      setGameState(newState);
      setLocalPlayerId(peerService.getLocalPlayerId());
    };

    peerService.onError = (msg) => {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 4500);
    };
  }, []);

  const localPlayer = gameState?.players.find((p) => p.id === localPlayerId);
  const isMyTurn = gameState?.status === 'playing' && gameState.players[gameState.currentTurnIndex]?.id === localPlayerId;

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

  // --- In-Game Grid & Chain Tile Selection ---

  const getSelectedTilesObjects = (): Tile[] => {
    if (!localPlayer || !gameState) return [];
    const tiles: Tile[] = [];

    selectedTileIds.forEach((id) => {
      const inHand = localPlayer.hand.find((t) => t.id === id);
      if (inHand) {
        tiles.push(inHand);
        return;
      }
      const inGrid = gameState.tableGrid.find((gt) => gt.tile.id === id);
      if (inGrid) {
        tiles.push(inGrid.tile);
      }
    });

    return tiles;
  };

  // Check if current selection contains tiles from grid
  const isGridTileSelected = (): boolean => {
    if (!gameState || selectedTileIds.length === 0) return false;
    return selectedTileIds.some((id) => gameState.tableGrid.some((gt) => gt.tile.id === id));
  };

  const handleTileClick = (tile: Tile) => {
    if (!isMyTurn || !localPlayer) return;

    if (selectedTileIds.includes(tile.id)) {
      setSelectedTileIds([]);
    } else {
      const handIndex = localPlayer.hand.findIndex((t) => t.id === tile.id);
      if (handIndex !== -1) {
        const chain = findConnectedChain(localPlayer.hand, handIndex);
        setSelectedTileIds(chain.map((t) => t.id));
      } else {
        setSelectedTileIds([tile.id]);
      }
    }
  };

  // Move selected tiles to grid starting at cell (targetRow, targetCol)
  const handleCellClick = (targetRow: number, targetCol: number) => {
    if (!isMyTurn || selectedTileIds.length === 0 || !gameState || !localPlayer) return;

    let newHand = [...localPlayer.hand];
    let newTableGrid = [...gameState.tableGrid];
    const tilesToMove = getSelectedTilesObjects();

    selectedTileIds.forEach((id) => {
      newHand = newHand.filter((t) => t.id !== id);
      newTableGrid = newTableGrid.filter((gt) => gt.tile.id !== id);
    });

    tilesToMove.forEach((tile, idx) => {
      const colOffset = targetCol + idx;
      if (colOffset < 16) {
        newTableGrid = newTableGrid.filter((gt) => !(gt.row === targetRow && gt.col === colOffset));
        newTableGrid.push({ tile, row: targetRow, col: colOffset });
      }
    });

    setSelectedTileIds([]);
    peerService.sendClientAction('ACTION_MOVE', { hand: newHand, tableGrid: newTableGrid });
  };

  // Recalls selected grid tiles back into player's hand during current turn
  const handleReturnSelectedGridTilesToHand = () => {
    if (!isMyTurn || !gameState || !localPlayer) return;

    const tilesToReturn = getSelectedTilesObjects();
    if (tilesToReturn.length === 0) return;

    let newHand = [...localPlayer.hand];
    let newTableGrid = [...gameState.tableGrid];

    selectedTileIds.forEach((id) => {
      newTableGrid = newTableGrid.filter((gt) => gt.tile.id !== id);
    });

    tilesToReturn.forEach((tile) => {
      if (!newHand.some((t) => t.id === tile.id)) {
        newHand.push(tile);
      }
    });

    setSelectedTileIds([]);
    peerService.sendClientAction('ACTION_MOVE', { hand: newHand, tableGrid: newTableGrid });
  };

  // Handles drag-and-drop tile from grid board back onto hand rack
  const handleDropTileToHand = (tileId: string) => {
    if (!isMyTurn || !gameState || !localPlayer) return;

    let newHand = [...localPlayer.hand];
    let newTableGrid = [...gameState.tableGrid];

    const gridIdx = newTableGrid.findIndex((gt) => gt.tile.id === tileId);
    if (gridIdx !== -1) {
      const tileToReturn = newTableGrid.splice(gridIdx, 1)[0].tile;
      if (!newHand.some((t) => t.id === tileToReturn.id)) {
        newHand.push(tileToReturn);
      }
      setSelectedTileIds([]);
      peerService.sendClientAction('ACTION_MOVE', { hand: newHand, tableGrid: newTableGrid });
    }
  };

  // Drag and Drop single tile onto cell (targetRow, targetCol)
  const handleDropTileToCell = (targetRow: number, targetCol: number, tileId: string) => {
    if (!isMyTurn || !gameState || !localPlayer) return;

    let newHand = [...localPlayer.hand];
    let newTableGrid = [...gameState.tableGrid];
    let tileToMove: Tile | null = null;

    const handIdx = newHand.findIndex((t) => t.id === tileId);
    if (handIdx !== -1) {
      tileToMove = newHand.splice(handIdx, 1)[0];
    } else {
      const gridIdx = newTableGrid.findIndex((gt) => gt.tile.id === tileId);
      if (gridIdx !== -1) {
        tileToMove = newTableGrid.splice(gridIdx, 1)[0].tile;
      }
    }

    if (tileToMove) {
      newTableGrid = newTableGrid.filter((gt) => !(gt.row === targetRow && gt.col === targetCol));
      newTableGrid.push({ tile: tileToMove, row: targetRow, col: targetCol });

      setSelectedTileIds([]);
      peerService.sendClientAction('ACTION_MOVE', { hand: newHand, tableGrid: newTableGrid });
    }
  };

  // Sort hand
  const handleSortHand = (sortBy: 'color' | 'value') => {
    if (!localPlayer || !gameState) return;
    const sorted = sortHand(localPlayer.hand, sortBy);
    setSelectedTileIds([]);

    if (isMyTurn) {
      peerService.sendClientAction('ACTION_MOVE', { hand: sorted, tableGrid: gameState.tableGrid });
    } else {
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
      tableGrid: gameState.tableGrid,
    });
  };

  const handleDrawTile = () => {
    if (!isMyTurn) return;
    setSelectedTileIds([]);
    peerService.sendClientAction('ACTION_DRAW');
  };

  const handleResetTurn = () => {
    if (!isMyTurn) return;
    setSelectedTileIds([]);
    peerService.sendClientAction('ACTION_RESET_TURN');
  };

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

  const selectedTilesObjects = getSelectedTilesObjects();
  const gridSelected = isGridTileSelected();

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Error Toast Notification */}
      {errorMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 bg-red-600 text-white font-black text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-2xl z-50 animate-bounce border-2 border-white/20">
          ⚠️ {errorMessage}
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
          tableGrid={gameState.tableGrid || []}
          selectedTiles={selectedTilesObjects}
          onTileClick={handleTileClick}
          onCellClick={handleCellClick}
          onDropTileToCell={handleDropTileToCell}
          isMyTurn={isMyTurn}
        />
      </FourSidesLayout>

      {/* Bottom Player Hand Rack */}
      {localPlayer && (
        <PlayerRack
          hand={localPlayer.hand}
          selectedTileIds={selectedTileIds}
          isGridTileSelected={gridSelected}
          onTileClick={handleTileClick}
          onRackClick={handleReturnSelectedGridTilesToHand}
          onReturnToHand={handleReturnSelectedGridTilesToHand}
          onDropTileToHand={handleDropTileToHand}
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
