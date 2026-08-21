import React, { useRef } from 'react';
import type { Tile } from '../types/game';
import { TileComponent } from './TileComponent';
import { Palette, Hash, RotateCcw, Download, CheckCircle, Flame, Layers, Undo2, ChevronLeft, ChevronRight } from 'lucide-react';

interface PlayerRackProps {
  hand: Tile[];
  selectedTileIds: string[];
  isGridTileSelected: boolean;
  onTileClick: (tile: Tile) => void;
  onRackClick: () => void;
  onReturnToHand: () => void;
  onDropTileToHand: (tileId: string) => void;
  onSortHand: (sortBy: 'color' | 'value') => void;
  onEndTurn: () => void;
  onDrawTile: () => void;
  onResetTurn: () => void;
  isMyTurn: boolean;
  hasMelded: boolean;
}

export const PlayerRack: React.FC<PlayerRackProps> = ({
  hand,
  selectedTileIds,
  isGridTileSelected,
  onTileClick,
  onRackClick,
  onReturnToHand,
  onDropTileToHand,
  onSortHand,
  onEndTurn,
  onDrawTile,
  onResetTurn,
  isMyTurn,
  hasMelded,
}) => {
  const selectedSet = new Set(selectedTileIds);
  const rackRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const tileId = e.dataTransfer.getData('text/plain');
    if (tileId && isMyTurn) {
      onDropTileToHand(tileId);
    }
  };

  const scrollRack = (direction: 'left' | 'right') => {
    if (rackRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      rackRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-slate-900 border-t border-slate-800 p-2 flex flex-col gap-1.5 shadow-2xl z-30 select-none">
      {/* Control Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
        {/* Sorting Buttons & Meld Status */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onSortHand('color')}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-xl border border-slate-700 transition text-xs font-semibold"
          >
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span>依顏色</span>
          </button>

          <button
            type="button"
            onClick={() => onSortHand('value')}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-xl border border-slate-700 transition text-xs font-semibold"
          >
            <Hash className="w-3.5 h-3.5 text-blue-400" />
            <span>依數字</span>
          </button>

          {/* Return Selected Grid Tile Back to Hand Button */}
          {isMyTurn && isGridTileSelected && (
            <button
              type="button"
              onClick={onReturnToHand}
              className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg transition transform active:scale-95 animate-pulse text-xs"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>收回手牌 ({selectedTileIds.length}張)</span>
            </button>
          )}

          {/* Meld Status Badge */}
          <div
            className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 text-[11px] ${
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
                <span>未破冰 (&gt;=30分)</span>
              </>
            )}
          </div>

          {selectedTileIds.length > 1 && (
            <div className="px-2 py-0.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 text-[11px] font-bold flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>連鎖拿起 {selectedTileIds.length} 張</span>
            </div>
          )}
        </div>

        {/* Turn Action Buttons */}
        {isMyTurn && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onResetTurn}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 font-semibold rounded-xl border border-slate-700 transition text-xs"
              title="將牌桌與手牌還原至本回合開始時"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>復原</span>
            </button>

            <button
              type="button"
              onClick={onDrawTile}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-semibold rounded-xl transition text-xs shadow-md"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>摸牌 / 過</span>
            </button>

            <button
              type="button"
              onClick={onEndTurn}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl shadow-lg transition transform active:scale-95 text-xs"
            >
              <span>結束回合</span>
            </button>
          </div>
        )}
      </div>

      {/* Hand Cards Horizontal Rack Container with Touch Pan & Arrow Controls */}
      <div className="relative w-full flex items-center gap-1">
        {/* Left Scroll Button */}
        {hand.length > 8 && (
          <button
            type="button"
            onClick={() => scrollRack('left')}
            className="flex-shrink-0 w-7 h-14 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center justify-center border border-slate-700 shadow-md active:scale-95 transition"
            title="向左滑動手牌"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Scrollable Hand Rack Area */}
        <div
          ref={rackRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => {
            if (isMyTurn && isGridTileSelected) {
              onRackClick();
            }
          }}
          style={{ touchAction: 'pan-x' }}
          className={`
            w-full min-h-[72px] max-h-[140px] overflow-x-auto overflow-y-hidden p-2 bg-slate-950/90 border rounded-2xl flex items-center gap-1.5 custom-scrollbar transition-all
            ${
              isMyTurn && isGridTileSelected
                ? 'border-cyan-400/80 bg-cyan-950/20 cursor-pointer ring-2 ring-cyan-500/30'
                : 'border-slate-800/90'
            }
          `}
        >
          {hand.length === 0 ? (
            <div className="w-full text-center text-xs text-slate-500 py-3">
              {isGridTileSelected ? '點擊或將卡牌拖拽至此處收回手牌' : '手牌已完全出完！'}
            </div>
          ) : (
            hand.map((tile) => (
              <div
                key={tile.id}
                draggable={isMyTurn}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', tile.id);
                }}
                style={{ touchAction: 'pan-x' }}
                className="flex-shrink-0 touch-pan-x"
              >
                <TileComponent
                  tile={tile}
                  size="md"
                  isSelected={selectedSet.has(tile.id)}
                  onClick={() => onTileClick(tile)}
                />
              </div>
            ))
          )}
        </div>

        {/* Right Scroll Button */}
        {hand.length > 8 && (
          <button
            type="button"
            onClick={() => scrollRack('right')}
            className="flex-shrink-0 w-7 h-14 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center justify-center border border-slate-700 shadow-md active:scale-95 transition"
            title="向右滑動手牌"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
