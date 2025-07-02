"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Winner, Player, GameState } from "@/types";

interface RestartDialogProps {
  winner: Winner;
  player: Player;
  players: GameState['players'];
}

export function RestartDialog({ winner, player, players }: RestartDialogProps) {
  if (!winner) {
    return null;
  }

  let title = "";
  let description = "";

  if (winner === "draw") {
    title = "It's a Draw!";
    description = "A hard-fought battle with no victor. The next round will begin shortly.";
  } else {
    const winnerName = players[winner.symbol];
    if (winner.symbol === player.symbol) {
      title = "Congratulations, You Win!";
      description = `A flawless strategy, ${winnerName}! You have proven your mettle.`;
    } else {
      title = "You Lost!";
      description = `A valiant effort, but ${winnerName} was victorious this time.`;
    }
  }

  return (
    <AlertDialog open={!!winner}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-bold text-center">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}
