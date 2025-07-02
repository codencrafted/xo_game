"use client";

import { motion } from "framer-motion";
import type { Symbol } from "@/types";
import { IconX, IconO } from "@/components/game/Icons";
import { cn } from "@/lib/utils";

interface CellProps {
  value: Symbol | null;
  onClick: () => void;
  disabled: boolean;
  isWinning: boolean;
}

export function Cell({ value, onClick, disabled, isWinning }: CellProps) {
  const Icon = value === "X" ? IconX : IconO;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || !!value}
      className={cn(
        "flex items-center justify-center w-full h-full rounded-lg shadow-md transition-colors duration-300",
        "bg-background/50 backdrop-blur-sm",
        "hover:bg-primary/10 disabled:cursor-not-allowed",
        isWinning ? "bg-accent/30" : "border-primary/20 border"
      )}
      whileTap={{ scale: 0.9 }}
      aria-label={`Cell ${value ? `contains ${value}` : 'is empty'}`}
    >
      {value && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "text-6xl md:text-8xl font-black",
            value === "X" ? "text-primary" : "text-accent",
            isWinning && "text-white"
          )}
        >
            <Icon className="w-16 h-16 md:w-24 md:h-24" strokeWidth={isWinning ? 3 : 2} />
        </motion.div>
      )}
    </motion.button>
  );
}
