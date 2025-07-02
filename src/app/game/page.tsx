"use client";

import { useGame } from "@/hooks/use-game";
import { Skeleton } from "@/components/ui/skeleton";
import { Board } from "@/components/game/Board";
import { GameInfo } from "@/components/game/GameInfo";
import { RestartDialog } from "@/components/game/RestartDialog";
import { Chat } from "@/components/game/Chat";
import { Toaster } from "@/components/ui/toaster";

export default function GamePage() {
  const { player, gameState, loading, handleMove, requestRestart, sendMessage } = useGame();

  if (loading || !gameState || !player) {
    return (
      <div className="flex min-h-screen flex-col md:flex-row items-center justify-center gap-8 p-4">
        <div className="flex flex-col gap-8 w-full max-w-md">
            <div className="w-full max-w-sm flex flex-col items-center gap-4 self-center">
                <Skeleton className="h-12 w-3/4" />
                <Skeleton className="h-8 w-1/2" />
            </div>
            <div className="grid grid-cols-3 grid-rows-3 gap-4 w-full max-w-md aspect-square">
                {[...Array(9)].map((_, i) => (
                    <Skeleton key={i} className="w-full h-full rounded-lg" />
                ))}
            </div>
        </div>
        <div className="w-full max-w-md h-[70vh] md:h-[calc(100vh-4rem)]">
            <Skeleton className="w-full h-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col md:flex-row items-center md:items-start justify-center gap-4 md:gap-8 p-4 antialiased">
        <div className="flex flex-col items-center justify-center gap-8 w-full max-w-md">
            <GameInfo gameState={gameState} player={player} />
            <Board 
                board={gameState.board} 
                onMove={handleMove}
                disabled={gameState.turn !== player.symbol || !!gameState.winner}
                winningCombo={typeof gameState.winner === 'object' && gameState.winner?.combo}
            />
        </div>
        <div className="w-full max-w-md lg:max-w-sm h-[70vh] md:h-[calc(100vh-2rem)]">
            <Chat 
                player={player}
                messages={gameState.chat}
                onSendMessage={sendMessage}
            />
        </div>
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
