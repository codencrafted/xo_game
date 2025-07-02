"use client";

import type { GameState, Player } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { IconX, IconO } from "./Icons";
import { cn } from "@/lib/utils";

interface GameInfoProps {
  gameState: GameState;
  player: Player;
}

export function GameInfo({ gameState }: GameInfoProps) {
  const { turn, players, winner, score } = gameState;

  let statusText;
  if (winner) {
    if (winner === "draw") {
      statusText = "It's a Draw!";
    } else {
      statusText = `${players[winner.symbol]} Wins!`;
    }
  } else {
    statusText = `${players[turn]}'s Turn`;
  }

  const PlayerDisplay = ({ symbol }: { symbol: "X" | "O" }) => (
    <div
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-lg transition-all duration-300 w-36",
        turn === symbol && !winner ? "bg-primary/10 scale-105" : "bg-primary/5 opacity-75"
      )}
    >
      <span className="font-bold text-lg">{players[symbol] || `Player ${symbol}`}</span>
      <span className="text-sm font-medium text-muted-foreground">Score: {score?.[symbol] ?? 0}</span>
      {symbol === "X" ? <IconX className="w-8 h-8 text-primary" /> : <IconO className="w-8 h-8 text-accent" />}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
       <div className="flex justify-between items-center w-full">
         <PlayerDisplay symbol="X" />
         <div className="text-xl font-semibold px-4 text-center">vs</div>
         <PlayerDisplay symbol="O" />
       </div>
       <Card className="w-full mt-4">
        <CardContent className="p-3">
          <p className="text-center text-xl font-bold tracking-wide">
            {statusText}
          </p>
        </CardContent>
       </Card>
    </div>
  );
}
