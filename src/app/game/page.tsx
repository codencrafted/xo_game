"use client";

import { useGame } from "@/hooks/use-game";
import { Skeleton } from "@/components/ui/skeleton";
import { Board } from "@/components/game/Board";
import { GameInfo } from "@/components/game/GameInfo";
import { RestartDialog } from "@/components/game/RestartDialog";
import { Toaster } from "@/components/ui/toaster";

export default function GamePage() {
  const { player, gameState, loading, handleMove, requestRestart } = useGame();

  if (loading || !gameState || !player) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
        </div>
        <div className="grid grid-cols-3 grid-rows-3 gap-4 w-full max-w-md aspect-square">
            {[...Array(9)].map((_, i) => (
                <Skeleton key={i} className="w-full h-full rounded-lg" />
            ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-4 antialiased">
        <GameInfo gameState={gameState} player={player} />
        <Board 
            board={gameState.board} 
            onMove={handleMove}
            disabled={gameState.turn !== player.symbol || !!gameState.winner}
            winningCombo={typeof gameState.winner === 'object' && gameState.winner?.combo}
        />
        <RestartDialog
          winner={gameState.winner}
          player={player}
          onRestart={requestRestart}
          players={gameState.players}
        />
      </main>
      <Toaster />
    </>
  );
}
