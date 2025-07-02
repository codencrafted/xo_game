"use client";

import { motion } from "framer-motion";
import type { BoardState } from "@/types";
import { Cell } from "./Cell";

interface BoardProps {
  board: BoardState;
  onMove: (index: number) => void;
  disabled: boolean;
  winningCombo: number[] | false | null;
}

export function Board({ board, onMove, disabled, winningCombo }: BoardProps) {
  return (
    <motion.div 
      className="grid grid-cols-3 grid-rows-3 gap-2 md:gap-4 w-full max-w-md aspect-square p-2 md:p-4 rounded-xl bg-primary/5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {board.map((value, index) => (
        <Cell
          key={index}
          value={value}
          onClick={() => onMove(index)}
          disabled={disabled}
          isWinning={!!winningCombo && winningCombo.includes(index)}
        />
      ))}
    </motion.div>
  );
}
