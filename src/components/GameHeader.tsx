import React, { useState } from 'react';
import type { GameState } from '../types/game';
import { Copy, Check, Clock, Layers, LogOut, Sparkles } from 'lucide-react';

interface GameHeaderProps {
  gameState: GameState;
  localPlayerId: string;
  onLeaveRoom: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  gameState,
  localPlayerId,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);

  const currentTurnPlayer = gameState.players[gameState.currentTurnIndex];
  const isMyTurn = currentTurnPlayer?.id === localPlayerId;

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(gameState.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timerMax = gameState.settings.turnTimer;
  const timerRemaining = gameState.turnTimerRemaining;
  const timerPercent = timerMax > 0 ? Math.max(0, (timerRemaining / timerMax) * 100) : 100;

  return (
    <header className="w-full bg-slate-900/90 border-b border-slate-800 px-3 py-2 flex flex-col gap-1 z-30 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Room ID & Copy */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700/80 px-2.5 py-1 rounded-lg border border-slate-700 transition">
            <span className="text-xs text-slate-400">房間號:</span>
            <span className="font-mono font-bold text-amber-400 text-sm tracking-wider">
              #{gameState.roomId}
            </span>
            <button
              type="button"
              onClick={handleCopyRoomId}
              className="ml-1 text-slate-400 hover:text-white transition"
              title="複製房間代碼"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Draw Pile Counter */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-800 text-xs text-slate-300">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>牌庫: <strong className="text-amber-300 font-bold">{gameState.drawPile.length}</strong> 張</span>
          </div>
        </div>

        {/* Center: Turn Status Banner */}
        <div className="flex items-center justify-center">
          {isMyTurn ? (
            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-black animate-pulse">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>輪到你的回合！</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>輪到 <strong className="text-white font-bold">{currentTurnPlayer?.name}</strong> 出牌...</span>
            </div>
          )}
        </div>

        {/* Right: Leave Button */}
        <div>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-red-950/60 hover:text-red-300 text-slate-400 text-xs font-medium rounded-lg border border-slate-700 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>離開</span>
          </button>
        </div>
      </div>

      {/* Turn Timer Progress Bar */}
      {timerMax > 0 && (
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              timerRemaining <= 10 ? 'bg-red-500 animate-pulse' : 'bg-amber-400'
            }`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      )}
    </header>
  );
};
