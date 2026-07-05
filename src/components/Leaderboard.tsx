import { PlayerProfile } from "../types";
import { Award, Star, Trophy, Users } from "lucide-react";

interface LeaderboardProps {
  players: PlayerProfile[];
  currentUserId: string | null;
}

export function Leaderboard({ players, currentUserId }: LeaderboardProps) {
  // Sort players descending
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const topThree = sortedPlayers.slice(0, 3);
  const rest = sortedPlayers.slice(3);

  // Pad topThree so design has consistent positioning if less than 3 players join
  const podium = [
    topThree[1] || null, // 2nd Place (Left)
    topThree[0] || null, // 1st Place (Center)
    topThree[2] || null, // 3rd Place (Right)
  ];

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Visual Podium Banner */}
      {sortedPlayers.length > 0 ? (
        <div className="bg-gradient-to-b from-amber-50 to-white border border-amber-100/50 rounded-3xl p-6 shadow-sm">
          <div className="text-center mb-6">
            <Trophy className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <h2 className="text-lg font-bold text-gray-800">Scavenger Hall of Fame</h2>
            <p className="text-xs text-gray-400">Live leaderboards across all active hunters</p>
          </div>

          <div className="flex items-end justify-center gap-2 pt-6 min-h-[160px]">
            {/* 2nd Place (Left) */}
            {podium[0] ? (
              <div className="flex flex-col items-center w-24 sm:w-28">
                <div className="text-center mb-1.5">
                  <span className="text-xs font-bold text-gray-600 truncate block max-w-[80px]">
                    {podium[0].username}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {podium[0].score} pts
                  </span>
                </div>
                <div className="w-full bg-slate-100 border border-slate-200/60 rounded-t-xl h-24 flex flex-col items-center justify-center p-2">
                  <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shadow-inner">
                    2
                  </div>
                  <span className="text-[9px] text-slate-500 uppercase mt-1 tracking-wider font-semibold">
                    Silver
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-24 border border-dashed border-gray-200 rounded-t-xl h-16" />
            )}

            {/* 1st Place (Center) */}
            {podium[1] ? (
              <div className="flex flex-col items-center w-28 sm:w-32">
                <Star className="h-5 w-5 text-amber-500 fill-amber-300 animate-pulse mb-1" />
                <div className="text-center mb-1.5">
                  <span className="text-sm font-bold text-amber-900 truncate block max-w-[100px]">
                    {podium[1].username}
                  </span>
                  <span className="text-xs font-bold text-amber-600 font-mono">
                    {podium[1].score} pts
                  </span>
                </div>
                <div className="w-full bg-amber-100 border-2 border-amber-300/40 rounded-t-2xl h-32 flex flex-col items-center justify-center p-2 shadow-inner">
                  <div className="h-8 w-8 rounded-full bg-amber-500 text-white font-black text-sm flex items-center justify-center shadow-lg border-2 border-white">
                    1
                  </div>
                  <span className="text-[10px] text-amber-700 uppercase mt-2 tracking-wider font-bold animate-bounce">
                    Gold
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-28 border border-dashed border-gray-200 rounded-t-2xl h-24" />
            )}

            {/* 3rd Place (Right) */}
            {podium[2] ? (
              <div className="flex flex-col items-center w-24 sm:w-28">
                <div className="text-center mb-1.5">
                  <span className="text-xs font-bold text-orange-950 truncate block max-w-[80px]">
                    {podium[2].username}
                  </span>
                  <span className="text-[10px] text-orange-700 font-mono">
                    {podium[2].score} pts
                  </span>
                </div>
                <div className="w-full bg-orange-50 border border-orange-200/50 rounded-t-xl h-20 flex flex-col items-center justify-center p-2">
                  <div className="h-6 w-6 rounded-full bg-orange-200 text-orange-800 font-bold text-xs flex items-center justify-center shadow-inner">
                    3
                  </div>
                  <span className="text-[9px] text-orange-600 uppercase mt-1 tracking-wider font-semibold">
                    Bronze
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-24 border border-dashed border-gray-200 rounded-t-xl h-12" />
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-400">
          <Users className="h-8 w-8 mx-auto opacity-40 mb-2" />
          <p className="text-sm">No hunters registered yet.</p>
        </div>
      )}

      {/* Standings List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Full Standings
          </span>
          <span className="text-xs text-gray-400 font-medium">
            {sortedPlayers.length} Active Hunters
          </span>
        </div>

        <div className="divide-y divide-gray-50 max-h-[380px] overflow-y-auto">
          {sortedPlayers.map((player, idx) => {
            const isCurrentUser = player.id === currentUserId;
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between px-5 py-3.5 transition ${
                  isCurrentUser ? "bg-amber-500/5 font-medium border-l-4 border-amber-500" : "hover:bg-gray-50/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 text-center text-xs font-bold font-mono text-gray-400">
                    {idx + 1}
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold uppercase text-gray-600 shadow-inner">
                    {player.username.substring(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-800">
                        {player.username}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[9px] bg-amber-500 text-white font-semibold px-1.5 py-0.2 rounded-full uppercase tracking-wide scale-90">
                          Me
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {player.completedCount} missions finished
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900 font-mono">
                      {player.score}
                    </span>
                    <span className="text-[10px] text-gray-400 block font-medium">pts</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
