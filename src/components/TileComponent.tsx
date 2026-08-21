import React from 'react';
import type { Tile } from '../types/game';
import { Smile } from 'lucide-react';

interface TileComponentProps {
  tile: Tile;
  isSelected?: boolean;
  isInvalid?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const TileComponent: React.FC<TileComponentProps> = ({
  tile,
  isSelected,
  isInvalid,
  onClick,
  size = 'md',
}) => {

  const getColorStyle = () => {
    if (tile.isJoker) return 'text-purple-600 bg-amber-50 border-purple-400';
    switch (tile.color) {
      case 'red':
        return 'text-red-600 border-red-200';
      case 'black':
        return 'text-zinc-900 border-zinc-300';
      case 'orange':
        return 'text-amber-500 border-amber-200';
      case 'blue':
        return 'text-blue-600 border-blue-200';
      default:
        return 'text-zinc-800 border-zinc-200';
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return 'w-8 h-11 text-base rounded-md border-2';
      case 'lg':
        return 'w-13 h-18 text-2xl rounded-xl border-3';
      case 'md':
      default:
        return 'w-10 h-14 text-xl rounded-lg border-2';
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative select-none font-extrabold flex flex-col items-center justify-between p-1
        shadow-md transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0
        bg-gradient-to-b from-amber-50 via-stone-100 to-amber-100/90
        ${getColorStyle()}
        ${getSizeStyle()}
        ${isSelected ? 'ring-4 ring-cyan-400 ring-offset-2 ring-offset-slate-900 -translate-y-1 z-10' : ''}
        ${isInvalid ? 'ring-2 ring-red-500 bg-red-50' : ''}
      `}
      style={{
        boxShadow: isSelected
          ? '0 10px 15px -3px rgba(34, 211, 238, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.1)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -2px 0 rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Top Dot indicator for color accessibility */}
      <div className="w-full flex justify-between items-center px-0.5">
        <span className="text-[10px] opacity-70 leading-none">
          {!tile.isJoker && tile.color ? tile.color[0].toUpperCase() : '★'}
        </span>
      </div>

      {/* Main Tile Value or Joker Symbol */}
      <div className="flex-1 flex items-center justify-center font-black tracking-tighter">
        {tile.isJoker ? (
          <div className="flex flex-col items-center justify-center text-purple-600">
            <Smile className={size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'} />
            <span className="text-[9px] font-bold tracking-normal leading-none mt-0.5">JOKER</span>
          </div>
        ) : (
          <span>{tile.value}</span>
        )}
      </div>

      {/* Bottom Color Dot */}
      <div className="w-full flex justify-center pb-0.5">
        {!tile.isJoker && (
          <div
            className={`rounded-full ${
              size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
            }`}
            style={{
              backgroundColor:
                tile.color === 'red'
                  ? '#dc2626'
                  : tile.color === 'black'
                  ? '#18181b'
                  : tile.color === 'orange'
                  ? '#f59e0b'
                  : '#2563eb',
            }}
          />
        )}
      </div>
    </button>
  );
};
