import type { Tile, GridTile } from '../types/game';
import { TileComponent } from './TileComponent';
import { GRID_ROWS, GRID_COLS, extractTileSetsFromGrid } from '../utils/validation';
import { Sparkles, Grid } from 'lucide-react';

interface TableBoardProps {
  tableGrid: GridTile[];
  selectedTiles: Tile[];
  onTileClick: (tile: Tile, position?: { row: number; col: number }) => void;
  onCellClick: (row: number, col: number) => void;
  onDropTileToCell: (row: number, col: number, tileId: string) => void;
  isMyTurn: boolean;
}

export const TableBoard: React.FC<TableBoardProps> = ({
  tableGrid,
  selectedTiles,
  onTileClick,
  onCellClick,
  onDropTileToCell,
  isMyTurn,
}) => {
  // Build lookup map: `${row}_${col}` -> Tile
  const gridMap = new Map<string, Tile>();
  tableGrid.forEach((gt) => {
    gridMap.set(`${gt.row}_${gt.col}`, gt.tile);
  });

  // Extract horizontal sets for real-time validation highlights
  const { singleTiles } = extractTileSetsFromGrid(tableGrid);
  const singleTileKeys = new Set(singleTiles.map((st) => `${st.row}_${st.col}`));

  const selectedTileIds = new Set(selectedTiles.map((t) => t.id));

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    const tileId = e.dataTransfer.getData('text/plain');
    if (tileId) {
      onDropTileToCell(row, col, tileId);
    }
  };

  return (
    <div className="w-full h-full flex-1 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Board Top Header */}
      <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-slate-200">透明網格盤 (10x16)</span>
          <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
            {tableGrid.length} 張牌桌卡牌
          </span>
        </div>

        {selectedTiles.length > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>已選擇 {selectedTiles.length} 張卡牌 (點擊透明網格放入)</span>
          </div>
        )}
      </div>

      {/* 2D Scrollable Grid System */}
      <div className="flex-1 overflow-auto pr-1 custom-scrollbar">
        <div
          className="grid gap-1 min-w-[720px] p-1 bg-slate-950/80 rounded-xl border border-slate-800/80"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(42px, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(58px, 1fr))`,
          }}
        >
          {Array.from({ length: GRID_ROWS }).map((_, r) =>
            Array.from({ length: GRID_COLS }).map((_, c) => {
              const key = `${r}_${c}`;
              const tile = gridMap.get(key);
              const isSelected = tile ? selectedTileIds.has(tile.id) : false;
              const isSingleInvalid = singleTileKeys.has(key);

              return (
                <div
                  key={key}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, r, c)}
                  onClick={() => {
                    if (!tile && isMyTurn && selectedTiles.length > 0) {
                      onCellClick(r, c);
                    }
                  }}
                  className={`
                    relative w-full h-full min-h-[56px] rounded-lg flex items-center justify-center border transition-all duration-150
                    ${
                      tile
                        ? 'border-transparent'
                        : isMyTurn && selectedTiles.length > 0
                        ? 'border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/15 cursor-pointer'
                        : 'border-dashed border-slate-800/50 hover:border-slate-700/60 bg-slate-900/30'
                    }
                    ${isSingleInvalid ? 'ring-2 ring-red-500/80 bg-red-950/30' : ''}
                  `}
                >
                  {tile ? (
                    <div
                      draggable={isMyTurn}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', tile.id);
                      }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <TileComponent
                        tile={tile}
                        size="md"
                        isSelected={isSelected}
                        isInvalid={isSingleInvalid}
                        onClick={() => onTileClick(tile, { row: r, col: c })}
                      />
                    </div>
                  ) : (
                    <span className="text-[9px] text-slate-700 font-mono select-none opacity-40">
                      {r + 1},{c + 1}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
