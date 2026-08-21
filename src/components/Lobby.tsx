import React, { useState } from 'react';
import type { GameState, RoomSettings, TimerOption, TurnOrderOption } from '../types/game';
import { Users, Play, Copy, Check, Clock, Shuffle, Shield, Dices } from 'lucide-react';

interface LobbyProps {
  gameState: GameState | null;
  onCreateRoom: (hostName: string, settings: RoomSettings) => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  onUpdateSettings: (settings: RoomSettings) => void;
  onStartGame: () => void;
  localPlayerId: string;
  errorMessage?: string | null;
}

export const Lobby: React.FC<LobbyProps> = ({
  gameState,
  onCreateRoom,
  onJoinRoom,
  onUpdateSettings,
  onStartGame,
  localPlayerId,
  errorMessage,
}) => {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('rummikub_player_name') || '');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [copied, setCopied] = useState(false);

  // Settings
  const [turnTimer, setTurnTimer] = useState<TimerOption>(60);
  const [orderOption, setOrderOption] = useState<TurnOrderOption>('join');

  const handleCopyCode = () => {
    if (gameState?.roomId) {
      navigator.clipboard.writeText(gameState.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isHost = gameState?.players.find((p) => p.id === localPlayerId)?.isHost ?? false;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = playerName.trim();
    if (!name) return;
    localStorage.setItem('rummikub_player_name', name);
    onCreateRoom(name, { turnTimer, orderOption });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = playerName.trim();
    if (!name || !roomIdInput.trim()) return;
    localStorage.setItem('rummikub_player_name', name);
    onJoinRoom(roomIdInput.trim(), name);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 flex flex-col items-center">
        {/* Title Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-2xl shadow-xl shadow-amber-500/20 mb-3">
            <Dices className="w-10 h-10 text-slate-950" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            拉密 Rummikub
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              線上多人版
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">跨平台 (Win / iOS / Android) 免費 PeerJS 多人連線</p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="w-full bg-red-950/80 border border-red-500/50 text-red-200 text-xs px-4 py-2.5 rounded-xl mb-4 text-center">
            {errorMessage}
          </div>
        )}

        {/* Lobby View when inside a room */}
        {gameState ? (
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md flex flex-col gap-5">
            {/* Room ID Display */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col items-center text-center">
              <span className="text-xs text-slate-400">房間連線代碼 (Room ID)</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-mono font-black text-amber-400 tracking-wider">
                  #{gameState.roomId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
                  title="複製代碼"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">請將代碼傳給朋友即可加入對戰</p>
            </div>

            {/* Players List */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-semibold text-slate-200 flex items-center gap-1">
                  <Users className="w-4 h-4 text-amber-400" />
                  已加入玩家 ({gameState.players.length} / 4 人)
                </span>
                <span>{gameState.players.length < 2 ? '等待更多玩家...' : '可開始遊戲'}</span>
              </div>

              <div className="space-y-2">
                {gameState.players.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-slate-950/70 border border-slate-800/80 px-3.5 py-2.5 rounded-xl text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center text-xs text-slate-500 font-mono">#{idx + 1}</span>
                      <span className="font-bold text-white">{p.name}</span>
                      {p.id === localPlayerId && (
                        <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.2 rounded">
                          自己
                        </span>
                      )}
                    </div>
                    {p.isHost && (
                      <span className="text-[11px] bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                        <Shield className="w-3 h-3" />
                        房主
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Host Settings */}
            {isHost && (
              <div className="bg-slate-950/60 border border-slate-800/60 p-3.5 rounded-xl space-y-3">
                <div className="text-xs font-semibold text-slate-300">房主設定</div>
                
                {/* Timer Selector */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    每回合思考時間:
                  </span>
                  <select
                    value={gameState.settings.turnTimer}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...gameState.settings,
                        turnTimer: Number(e.target.value) as TimerOption,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400 text-xs"
                  >
                    <option value={30}>30 秒 (極速)</option>
                    <option value={45}>45 秒</option>
                    <option value={60}>60 秒 (標準)</option>
                    <option value={90}>90 秒</option>
                    <option value={120}>120 秒</option>
                    <option value={0}>不限時</option>
                  </select>
                </div>

                {/* Order Selector */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Shuffle className="w-3.5 h-3.5 text-blue-400" />
                    玩家行動順序:
                  </span>
                  <select
                    value={gameState.settings.orderOption}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...gameState.settings,
                        orderOption: e.target.value as TurnOrderOption,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400 text-xs"
                  >
                    <option value="join">依進房順序</option>
                    <option value="random">隨機抽籤發牌</option>
                  </select>
                </div>
              </div>
            )}

            {/* Start Game Button (Host Only) */}
            {isHost ? (
              <button
                type="button"
                onClick={onStartGame}
                disabled={gameState.players.length < 2}
                className={`
                  w-full py-3 rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-lg transition transform
                  ${
                    gameState.players.length >= 2
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 hover:scale-[1.02] active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }
                `}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>開始遊戲 ({gameState.players.length}/4人)</span>
              </button>
            ) : (
              <div className="text-center text-xs text-slate-400 py-2 animate-pulse">
                等待房主點擊「開始遊戲」...
              </div>
            )}
          </div>
        ) : (
          /* Form for Create / Join */
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl mb-5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`py-2 rounded-lg transition ${
                  mode === 'create' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                創建房間
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`py-2 rounded-lg transition ${
                  mode === 'join' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                加入房間
              </button>
            </div>

            {mode === 'create' ? (
              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">你的暱稱</label>
                  <input
                    type="text"
                    required
                    placeholder="輸入遊戲暱稱..."
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 text-sm"
                  />
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl space-y-3">
                  <div className="font-semibold text-slate-300">初始遊戲設定</div>
                  
                  {/* Timer */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">思考時間 (秒)</span>
                    <select
                      value={turnTimer}
                      onChange={(e) => setTurnTimer(Number(e.target.value) as TimerOption)}
                      className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400"
                    >
                      <option value={30}>30 秒 (極速)</option>
                      <option value={45}>45 秒</option>
                      <option value={60}>60 秒 (標準)</option>
                      <option value={90}>90 秒</option>
                      <option value={120}>120 秒</option>
                      <option value={0}>不限時</option>
                    </select>
                  </div>

                  {/* Order */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">行動順序</span>
                    <select
                      value={orderOption}
                      onChange={(e) => setOrderOption(e.target.value as TurnOrderOption)}
                      className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400"
                    >
                      <option value="join">依進房順序</option>
                      <option value="random">隨機抽籤</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm rounded-xl shadow-lg transition transform hover:scale-[1.02] active:scale-95"
                >
                  創建遊戲大廳
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoinSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">你的暱稱</label>
                  <input
                    type="text"
                    required
                    placeholder="輸入遊戲暱稱..."
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">房間代碼 (Room ID)</label>
                  <input
                    type="text"
                    required
                    placeholder="輸入 6 位號碼代碼..."
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono text-sm uppercase tracking-wider"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-slate-950 font-black text-sm rounded-xl shadow-lg transition transform hover:scale-[1.02] active:scale-95"
                >
                  加入線上對戰
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
