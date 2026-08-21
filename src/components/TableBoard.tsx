import React from 'react';
import type { Tile, TileSet } from '../types/game';
import { TileComponent } from './TileComponent';
import { validateTileSet } from '../utils/validation';
import { Plus, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TableBoardProps {
  tableSets: TileSet[];
  selectedTileId: string | null;
  onTileClick: (tile: Tile, sourceSetId?: string) => void;
  onMoveTileToSet: (targetSetId: string) => void;
  onCreateNewSetWithSelectedTile: () => void;
  isMyTurn: boolean;
}

export const TableBoard: React.FC<TableBoardProps> = ({
  tableSets,
  selectedTileId,
  onTileClick,
  onMoveTileToSet,
  onCreateNewSetWithSelectedTile,
  isMyTurn,
}) => {
  return (
    <div className="w-full h-full flex-1 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl p-3 overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Board Header & Control */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-slate-200">中央牌桌 (中央區域)</span>
          <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
            {tableSets.filter((s) => s.tiles.length > 0).length} 個組合
          </span>
        </div>

        {isMyTurn && selectedTileId && (
          <button
            type="button"
            onClick={onCreateNewSetWithSelectedTile}
            className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg shadow-md transition transform active:scale-95 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>用選中的牌新建組合</span>
          </button>
        )}
      </div>

      {/* Main Board Grid Area */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
        {tableSets.length === 0 || tableSets.every((s) => s.tiles.length === 0) ? (
          <div className="w-full h-full min-h-[160px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-slate-500 p-6 text-center">
            <p className="text-sm font-medium">牌桌目前沒有任何組合</p>
            <p className="text-xs text-slate-600 mt-1">從手牌選中卡牌後點擊「新建組合」或將組合打出至中央</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 items-start">
            {tableSets.map((set, setIndex) => {
              if (set.tiles.length === 0) return null;
              const valRes = validateTileSet(set);
              const isValid = valRes.isValid;

              return (
                <div
                  key={set.id || `set-${setIndex}`}
                  className={`
                    relative group flex flex-wrap items-center gap-1.5 p-2 rounded-xl border transition-all duration-200
                    bg-slate-950/70 border-slate-800/80 hover:border-slate-700
                    ${!isValid ? 'border-red-500/80 bg-red-950/20' : ''}
                  `}
                >
                  {/* Status Indicator Badge */}
                  <div className="absolute -top-2.5 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm z-10">
                    {isValid ? (
                      <span className="bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {valRes.type === 'group' ? '群組' : '順子'}
                      </span>
                    ) : (
                      <span className="bg-red-950/90 text-red-400 border border-red-500/40 px-1.5 py-0.2 rounded-full flex items-center gap-0.5" title={valRes.errorReason}>
                        <AlertCircle className="w-2.5 h-2.5" />
                        不合法 ({set.tiles.length}張)
                      </span>
                    )}
                  </div>

                  {/* Tile Components */}
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {set.tiles.map((tile) => (
                      <TileComponent
                        key={tile.id}
                        tile={tile}
                        size="md"
                        isSelected={selectedTileId === tile.id}
                        isInvalid={!isValid}
                        onClick={() => onTileClick(tile, set.id)}
                      />
                    ))}
                  </div>

                  {/* Target drop/put button when a tile is selected */}
                  {isMyTurn && selectedTileId && (
                    <button
                      type="button"
                      onClick={() => onMoveTileToSet(set.id)}
                      className="h-14 px-2 flex items-center justify-center border-2 border-dashed border-amber-400/50 hover:border-amber-400 bg-amber-400/10 hover:bg-amber-400/20 rounded-lg text-amber-300 text-xs font-bold transition duration-150 animate-pulse"
                      title="放入此組合"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
