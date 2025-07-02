"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

import { db } from '@/lib/firebase';
import type { Player, GameState, Symbol, Winner } from '@/types';

const gameId = 'main-game';
const gameDocRef = doc(db, 'games', gameId);

const winningCombos = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]             // diagonals
];

const initialGameState: GameState = {
  board: Array(9).fill(null),
  turn: "X",
  players: { X: null, O: null },
  winner: null,
  restartRequested: { X: false, O: false },
};

function checkWinner(board: (Symbol | null)[]): Winner {
  for (const combo of winningCombos) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { symbol: board[a] as Symbol, combo };
    }
  }
  if (board.every(cell => cell !== null)) {
    return 'draw';
  }
  return null;
}

export function useGame() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const playerDataString = localStorage.getItem('tic-tac-toe-player');
    if (!playerDataString) {
      router.replace('/');
      return;
    }
    setPlayer(JSON.parse(playerDataString));

    const unsubscribe = onSnapshot(gameDocRef, async (doc) => {
      if (doc.exists()) {
        const data = doc.data() as GameState;
        setGameState(data);
        
        // Handle auto-restart
        if (data.restartRequested.X && data.restartRequested.O) {
            if(player?.symbol === 'X') { // Only player X resets the game
                await setDoc(gameDocRef, {
                    ...initialGameState,
                    players: data.players // Keep players
                });
            }
        }

      } else {
        // This case should ideally be handled by the login page
        await setDoc(gameDocRef, initialGameState);
        setGameState(initialGameState);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, player?.symbol]);

  const handleMove = useCallback(async (index: number) => {
    if (!gameState || !player || gameState.winner) return;
    if (gameState.board[index] !== null || gameState.turn !== player.symbol) return;

    const newBoard = [...gameState.board];
    newBoard[index] = player.symbol;
    const winner = checkWinner(newBoard);

    await setDoc(gameDocRef, {
      board: newBoard,
      turn: player.symbol === 'X' ? 'O' : 'X',
      winner: winner,
    }, { merge: true });
  }, [gameState, player]);

  const requestRestart = useCallback(async () => {
    if (!gameState || !player) return;
    const newRestartRequested = { ...gameState.restartRequested, [player.symbol]: true };
    await setDoc(gameDocRef, { restartRequested: newRestartRequested }, { merge: true });
  }, [gameState, player]);

  return { player, gameState, loading, handleMove, requestRestart };
}
