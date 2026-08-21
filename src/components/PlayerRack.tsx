import React from 'react';
import type { Tile } from '../types/game';
import { TileComponent } from './TileComponent';
import { Palette, Hash, RotateCcw, Download, CheckCircle, Flame } from 'lucide-react';

interface PlayerRackProps {
  hand: Tile[];
  selectedTileId: string | null;
  onTileClick: (tile: Tile) => void;
  onSortHand: (sortBy: 'color' | 'value') => void;
  onEndTurn: () => void;
  onDrawTile: () => void;
  onResetTurn: () => void;
  isMyTurn: boolean;
  hasMelded: boolean;
}

export const PlayerRack: React.FC<PlayerRackProps> = ({
  hand,
  selectedTileId,
  onTileClick,
  onSortHand,
  onEndTurn,
  onDrawTile,
  onResetTurn,
  isMyTurn,
  hasMelded,
}) => {
  return (
    <div className="w-full bg-slate-900 border-t border-slate-800 p-2 sm:p-3 flex flex-col gap-2 shadow-2xl z-30">
      {/* Control Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Sorting Buttons & Status */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onSortHand('color')}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
          >
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span>依顏色</span>
          </button>

          <button
            type="button"
            onClick={() => onSortHand('value')}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
          >
            <Hash className="w-3.5 h-3.5 text-blue-400" />
            <span>依數字</span>
          </button>

          {/* Meld Status Badge */}
          <div
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] ${
              hasMelded
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                : 'bg-amber-950/80 text-amber-300 border border-amber-800'
            }`}
          >
            {hasMelded ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>已破冰</span>
              </>
            ) : (
              <>
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>未破冰 (首次出牌需 $\ge 30$分)</span>
              </>
            )}
          </div>
        </div>

        {/* Turn Action Buttons */}
        {isMyTurn && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetTurn}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 transition active:scale-95"
              title="將牌桌與手牌還原至本回合開始時"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>復原本回合</span>
            </button>

            <button
              type="button"
              onClick={onDrawTile}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition active:scale-95 shadow-md"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>摸牌 / 過</span>
            </button>

            <button
              type="button"
              onClick={onEndTurn}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl shadow-lg transition transform hover:scale-105 active:scale-95"
            >
              <span>結束回合</span>
            </button>
          </div>
        )}
      </div>

      {/* Hand Cards Horizontal Rack */}
      <div className="w-full min-h-[72px] max-h-[140px] overflow-x-auto overflow-y-hidden p-1.5 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center gap-1.5 custom-scrollbar">
        {hand.length === 0 ? (
          <div className="w-full text-center text-xs text-slate-500 py-2">
            手牌已完全出完！
          </div>
        ) : (
          hand.map((tile) => (
            <TileComponent
              key={tile.id}
              tile={tile}
              size="md"
              isSelected={selectedTileId === tile.id}
              onClick={() => onTileClick(tile)}
            />
          ))
        )}
      </div>
    </div>
  );
};
