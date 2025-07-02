"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";

import { db } from "@/lib/firebase";
import type { Player, GameState } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

const validCodes: Record<string, Omit<Player, "id">> = {
  "2402": { name: "Preet ❤️", symbol: "X" },
  "1009": { name: "Prince", symbol: "O" },
};

const initialGameState: GameState = {
  board: Array(9).fill(null),
  turn: "X",
  players: { X: null, O: null },
  winner: null,
  restartRequested: { X: false, O: false },
  chat: [],
  score: { X: 0, O: 0 },
  call: null,
};

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleJoin = async () => {
    setLoading(true);
    const playerData = validCodes[code];

    if (!playerData) {
      toast({
        title: "Invalid Code",
        description: "The code you entered is not valid. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const gameDocRef = doc(db, "games", "main-game");
      const gameDoc = await getDoc(gameDocRef);
      let gameState: GameState;

      if (!gameDoc.exists()) {
        gameState = initialGameState;
        await setDoc(gameDocRef, initialGameState);
      } else {
        const data = gameDoc.data() as GameState;
        gameState = { ...initialGameState, ...data };
      }

      const playersInGame = Object.values(gameState.players).filter(p => p !== null);
      const isGameFull = playersInGame.length === 2;
      const isPlayerInGame = playersInGame.some(p => p === playerData.name);

      if (isGameFull && !isPlayerInGame) {
          toast({
              title: "Game Full",
              description: "Two players are already in the game.",
              variant: "destructive",
          });
          setLoading(false);
          return;
      }

      const intendedSlotOccupant = gameState.players[playerData.symbol];
      if (intendedSlotOccupant && intendedSlotOccupant !== playerData.name) {
        toast({
          title: "Player Slot Taken",
          description: `The slot for player ${playerData.symbol} is already taken by ${intendedSlotOccupant}.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const newPlayers = { ...gameState.players, [playerData.symbol]: playerData.name };
      await setDoc(gameDocRef, { players: newPlayers, score: gameState.score || { X: 0, O: 0 } }, { merge: true });

      localStorage.setItem("tic-tac-toe-player", JSON.stringify(playerData));
      router.push("/game");
    } catch (error) {
      console.error("Error joining game:", error);
      toast({
        title: "Connection Error",
        description: "Could not connect to the game. Please check your internet connection.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm shadow-2xl">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Code Clash
            </CardTitle>
            <CardDescription className="text-center">
              Enter your secret access code to join the Tic-Tac-Toe battle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                type="password"
                placeholder="Access Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                className="text-center text-lg"
              />
              <Button onClick={handleJoin} disabled={loading} className="w-full font-bold">
                {loading ? <Loader2 className="animate-spin" /> : "Join Game"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Toaster />
    </>
  );
}
