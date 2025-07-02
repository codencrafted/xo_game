import type { Timestamp } from "firebase/firestore";

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

export type ChatMessage = {
    id: string;
    senderName: string;
    senderSymbol: Symbol;
    timestamp: Timestamp;
    type: 'text' | 'voice';
    content: string; // text content or base64 audio data URI
};

export type CallData = {
    from: Symbol;
    offer: any; // RTCSessionDescriptionInit
    answer?: any; // RTCSessionDescriptionInit
    status: 'ringing' | 'connected' | 'declined' | 'ended';
};

export interface GameState {
  board: BoardState;
  turn: Symbol;
  players: { [key in Symbol]: string | null };
  winner: Winner;
  restartRequested: { [key in Symbol]: boolean };
  chat: ChatMessage[];
  call?: CallData | null;
  score: { [key in Symbol]: number };
}
