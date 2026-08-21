import React, { useEffect } from 'react';
import type { GameState } from '../types/game';
import confetti from 'canvas-confetti';
import { Trophy, RefreshCw, AlertCircle } from 'lucide-react';

interface WinModalProps {
  gameState: GameState;
  onBackToLobby: () => void;
}

export const WinModal: React.FC<WinModalProps> = ({ gameState, onBackToLobby }) => {
  const winner = gameState.players.find((p) => p.id === gameState.winnerId);

  useEffect(() => {
    // Fire confetti celebration animation
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col items-center text-center">
        {/* Trophy Icon */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4 animate-bounce">
          <Trophy className="w-9 h-9 text-slate-950" />
        </div>

        <h2 className="text-2xl font-black text-white">遊戲結束！</h2>
        <div className="mt-1 text-sm font-bold text-amber-400">
          獲勝者：【{winner?.name || '未知玩家'}】
        </div>
        <p className="text-xs text-slate-400 mt-2 px-2 leading-relaxed bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
          {gameState.endReason || '獲勝者出完所有手牌！'}
        </p>

        {/* Endgame hand points table if deck exhausted */}
        {gameState.endGameScores && (
          <div className="w-full mt-4 text-left bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1 border-b border-slate-800 pb-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>手牌剩餘點數結算 (點數最低者獲勝，鬼牌罰30分)</span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {gameState.players.map((p) => {
                const scoreInfo = gameState.endGameScores?.[p.id];
                const isWinner = p.id === gameState.winnerId;

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between text-xs p-2 rounded-xl ${
                      isWinner
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
                        : 'bg-slate-900 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold">{p.name} {isWinner && '🏆'}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                        {scoreInfo?.detail || '無手牌'}
                      </span>
                    </div>
                    <div className="font-mono font-black text-sm text-amber-300">
                      {scoreInfo?.handSum ?? 0} 分
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={onBackToLobby}
          className="w-full mt-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>返回大廳</span>
        </button>
      </div>
    </div>
  );
};
