export type Symbol = 'X' | 'O';

export type Player = {
  name: string;
  symbol: Symbol;
};

export type BoardState = (Symbol | null)[];

export type Winner = {
  symbol: Symbol;
  combo: number[];
} | 'draw' | null;

export interface GameState {
  board: BoardState;
  turn: Symbol;
  players: { [key in Symbol]: string | null };
  winner: Winner;
  restartRequested: { [key in Symbol]: boolean };
}
