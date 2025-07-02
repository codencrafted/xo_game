"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { GameState, Player } from "@/types";

const ConfettiPiece = ({ style }: { style: React.CSSProperties }) => (
    <div className="absolute w-2 h-4" style={style} />
);

const Confetti = () => {
    const [pieces, setPieces] = useState<{ style: React.CSSProperties }[]>([]);

    useEffect(() => {
        const newPieces = Array.from({ length: 150 }).map((_, i) => ({
            style: {
                left: `${Math.random() * 100}%`,
                top: `${-20 + Math.random() * -80}px`,
                transform: `rotate(${Math.random() * 360}deg)`,
                backgroundColor: `hsl(${Math.random() * 360}, 100%, 50%)`,
                animation: `fall ${3 + Math.random() * 4}s linear forwards`,
                animationDelay: `${Math.random() * 5}s`,
            },
        }));
        setPieces(newPieces);
    }, []);

    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
            {pieces.map(({ style }, index) => (
                <ConfettiPiece key={index} style={style} />
            ))}
        </div>
    );
};


interface MatchWinnerDialogProps {
  gameState: GameState;
  player: Player;
  onPlayAgain: () => void;
}

export function MatchWinnerDialog({ gameState, player, onPlayAgain }: MatchWinnerDialogProps) {
  const { matchWinner, players } = gameState;

  if (!matchWinner) {
    return null;
  }

  const winnerName = players[matchWinner];
  const isPlayerWinner = player.symbol === matchWinner;

  let title = "";
  if (isPlayerWinner) {
    title = `Congratulations, You Win the Match!`;
  } else {
    title = `You Lost! ${winnerName} Wins the Match!`;
  }
  
  return (
    <AlertDialog open={!!matchWinner}>
      <AlertDialogContent className="overflow-hidden">
        <Confetti />
        <AlertDialogHeader>
          <AlertDialogTitle className="text-3xl font-bold text-center z-10">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center z-10">
            A stunning victory! Ready for a new challenge?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="z-10">
            <Button onClick={onPlayAgain} className="w-full">Play Again</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
