import React from 'react';
import type { Player } from '../types/game';
import { ShieldCheck, WifiOff } from 'lucide-react';

interface FourSidesLayoutProps {
  players: Player[];
  currentTurnIndex: number;
  localPlayerId: string;
  children: React.ReactNode; // Table board content in center
}

export const FourSidesLayout: React.FC<FourSidesLayoutProps> = ({
  players,
  currentTurnIndex,
  localPlayerId,
  children,
}) => {
  const numPlayers = players.length;
  const myIndex = Math.max(
    0,
    players.findIndex((p) => p.id === localPlayerId)
  );

  // Map seat positions relative to local player (myself at bottom)
  const getPlayerAtRelativeOffset = (offset: number): { player: Player; absoluteIndex: number } | null => {
    if (numPlayers === 0) return null;
    const targetIdx = (myIndex + offset) % numPlayers;
    return { player: players[targetIdx], absoluteIndex: targetIdx };
  };

  const leftPlayer = numPlayers > 1 ? getPlayerAtRelativeOffset(1) : null;
  const topPlayer = numPlayers > 2 ? getPlayerAtRelativeOffset(2) : null;
  const rightPlayer = numPlayers > 3 ? getPlayerAtRelativeOffset(3) : null;
  const selfPlayer = getPlayerAtRelativeOffset(0);

  const renderPlayerAvatar = (
    playerData: { player: Player; absoluteIndex: number } | null,
    position: 'top' | 'bottom' | 'left' | 'right'
  ) => {
    if (!playerData) return null;
    const { player, absoluteIndex } = playerData;
    const isCurrentTurn = absoluteIndex === currentTurnIndex;
    const isSelf = player.id === localPlayerId;

    const getPositionClasses = () => {
      switch (position) {
        case 'top':
          return 'col-start-2 row-start-1 justify-self-center self-start';
        case 'left':
          return 'col-start-1 row-start-2 justify-self-start self-center';
        case 'right':
          return 'col-start-3 row-start-2 justify-self-end self-center';
        case 'bottom':
          return 'col-start-2 row-start-3 justify-self-center self-end';
      }
    };

    return (
      <div
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 z-20 backdrop-blur-md shadow-lg
          ${getPositionClasses()}
          ${
            isCurrentTurn
              ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 scale-105 shadow-amber-500/20'
              : 'bg-slate-800/80 border-slate-700 text-slate-300'
          }
          ${player.isDisconnected ? 'opacity-50 grayscale' : ''}
        `}
      >
        <div className="relative">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow ${
              isSelf ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-200'
            }`}
          >
            {player.name.slice(0, 2).toUpperCase()}
          </div>
          {player.isHost && (
            <div className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 p-0.5 rounded-full" title="房主">
              <ShieldCheck className="w-3 h-3" />
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs text-white max-w-[90px] truncate">
              {player.name} {isSelf && '(自己)'}
            </span>
            {isCurrentTurn && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>手牌: <strong className="text-amber-300 font-bold">{player.hand.length}</strong> 張</span>
            <span className={player.hasMelded ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
              {player.hasMelded ? '✓已破冰' : '未破冰'}
            </span>
          </div>
        </div>

        {player.isDisconnected && (
          <span title="連線中斷">
            <WifiOff className="w-4 h-4 text-red-400 animate-pulse ml-1" />
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full min-h-0 flex-1 grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] p-2 gap-2 overflow-hidden bg-slate-950">
      {/* Top Player Avatar */}
      {renderPlayerAvatar(topPlayer, 'top')}

      {/* Left Player Avatar */}
      {renderPlayerAvatar(leftPlayer, 'left')}

      {/* Center Table Board */}
      <div className="col-start-2 row-start-2 w-full h-full min-h-0 overflow-hidden flex flex-col z-10">
        {children}
      </div>

      {/* Right Player Avatar */}
      {renderPlayerAvatar(rightPlayer, 'right')}

      {/* Bottom Self Avatar */}
      {renderPlayerAvatar(selfPlayer, 'bottom')}
    </div>
  );
};
