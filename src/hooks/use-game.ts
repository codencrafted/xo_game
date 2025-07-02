"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  doc, onSnapshot, setDoc, getDoc, arrayUnion, Timestamp,
  collection, addDoc, writeBatch, getDocs,
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';

import { db } from '@/lib/firebase';
import type { Player, GameState, Symbol, Winner, ChatMessage, CallData } from '@/types';
import { useToast } from './use-toast';

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
  chat: [],
  call: null,
  score: { X: 0, O: 0 },
};

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
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
  const { toast } = useToast();

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'connected'>('idle');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const iceCandidateBuffer = useRef<RTCIceCandidate[]>([]);
  
  const playerRef = useRef(player);
  playerRef.current = player;
  const callStatusRef = useRef(callStatus);
  callStatusRef.current = callStatus;
  const gameStateRef = useRef<GameState | null>(null);


  useEffect(() => {
    const playerDataString = localStorage.getItem('tic-tac-toe-player');
    if (playerDataString) {
        setPlayer(JSON.parse(playerDataString));
    } else {
        router.replace('/');
    }
  }, [router]); 


  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
    });
    setIsMicMuted((prev) => !prev);
  }, []);

  const cleanupCall = useCallback(async (isInitiator: boolean) => {
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    setRemoteStream(null);
    setCallStatus('idle');
    setIsMicMuted(false);
    iceCandidateBuffer.current = [];

    const currentGameState = gameStateRef.current;
    if (isInitiator && currentGameState?.call) {
        await setDoc(gameDocRef, { call: { ...currentGameState.call, status: 'ended' } }, { merge: true });
        return;
    }
    
    // Only master client 'X' should clean up the DB to avoid race conditions
    if (playerRef.current?.symbol === 'X' && (!currentGameState?.call || currentGameState?.call.status === 'ended' || currentGameState?.call.status === 'declined')) {
        await setDoc(gameDocRef, { call: null }, { merge: true });
        const batch = writeBatch(db);
        const candidatesXSnap = await getDocs(collection(db, 'games', gameId, 'iceCandidatesX'));
        candidatesXSnap.forEach(doc => batch.delete(doc.ref));
        const candidatesOSnap = await getDocs(collection(db, 'games', gameId, 'iceCandidatesO'));
        candidatesOSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
  }, []);

  const setupPeerConnection = useCallback(async () => {
    const currentPlayer = playerRef.current;
    if (peerConnectionRef.current || !currentPlayer) return peerConnectionRef.current;
    
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    } catch (error) {
      console.error("Error getting user media", error);
      toast({ title: "Microphone Access Denied", description: "Please allow microphone access to use voice chat.", variant: "destructive" });
      return null;
    }

    pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
    };

    const localCandidatesCol = collection(db, 'games', gameId, `iceCandidates${currentPlayer.symbol}`);
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            addDoc(localCandidatesCol, event.candidate.toJSON());
        }
    };
    
    return pc;
  }, [toast]);

  // Main game state listener
  useEffect(() => {
    if (!player) return;

    const unsubscribe = onSnapshot(gameDocRef, async (doc) => {
        const oldGameState = gameStateRef.current; // Grab old state before any updates

        if (doc.exists()) {
            const data = doc.data() as GameState;

            // New chat message notification
            if (oldGameState && data.chat && data.chat.length > (oldGameState.chat?.length || 0)) {
                const newMessage = data.chat[data.chat.length - 1];
                if (player && newMessage.senderSymbol !== player.symbol) {
                    toast({
                        title: `New message from ${newMessage.senderName}`,
                        description: newMessage.type === 'text' 
                            ? (newMessage.content.length > 30 ? newMessage.content.substring(0, 30) + '...' : newMessage.content)
                            : 'Sent a voice message.',
                    });
                }
            }
            
            // Handle call state from Firestore
            const callData = data.call;
            const currentStatus = callStatusRef.current;

            if (callData) {
                const { status, from, answer } = callData;
                
                if (status === 'ringing' && from !== player.symbol && currentStatus === 'idle') {
                    setCallStatus('ringing');
                    const otherPlayerName = data.players[from];
                    if (otherPlayerName) {
                        toast({
                            title: 'Incoming Call',
                            description: `${otherPlayerName} is calling you.`,
                        });
                    }
                } else if (status === 'ringing' && from === player.symbol && currentStatus === 'idle') {
                    setCallStatus('dialing');
                } else if (status === 'connected' && currentStatus !== 'connected') {
                    if (from === player.symbol && answer && peerConnectionRef.current && !peerConnectionRef.current.currentRemoteDescription) {
                        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                        iceCandidateBuffer.current.forEach(candidate => {
                            peerConnectionRef.current?.addIceCandidate(candidate).catch(e => console.error("Error adding buffered ICE candidate", e));
                        });
                        iceCandidateBuffer.current = [];
                    }
                    setCallStatus('connected');
                } else if ((status === 'declined' || status === 'ended') && currentStatus !== 'idle') {
                    cleanupCall(false);
                }
            } else if (currentStatus !== 'idle') {
                cleanupCall(false);
            }
            
            // Update state and ref AFTER all comparisons and logic
            setGameState(data);
            gameStateRef.current = data;

        } else {
            if(player.symbol === 'X') {
                await setDoc(gameDocRef, initialGameState);
            }
            setGameState(initialGameState);
            gameStateRef.current = initialGameState;
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [player, cleanupCall, toast]);

    // Auto-restart effect
    useEffect(() => {
        if (gameState?.winner && player?.symbol === 'X') {
            const timer = setTimeout(async () => {
                const gameDoc = await getDoc(gameDocRef);
                if (gameDoc.exists()) {
                    const currentGameState = gameDoc.data() as GameState;
                    if (currentGameState?.winner) {
                        const { players, score, chat, call } = currentGameState;
                        await setDoc(gameDocRef, {
                            ...initialGameState,
                            players,
                            score: score || { X: 0, O: 0 },
                            chat: chat || [],
                            call: call || null,
                        });
                    }
                }
            }, 4000);

            return () => clearTimeout(timer);
        }
    }, [gameState?.winner, player?.symbol]);

  // Listen for remote ICE candidates
  useEffect(() => {
    if (!player) return;
    
    const otherPlayerSymbol = player.symbol === 'X' ? 'O' : 'X';
    const remoteCandidatesCol = collection(db, 'games', gameId, `iceCandidates${otherPlayerSymbol}`);
    const unsubscribe = onSnapshot(remoteCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                if (peerConnectionRef.current?.remoteDescription) {
                    peerConnectionRef.current.addIceCandidate(candidate).catch(e => console.error("Error adding ICE candidate:", e));
                } else {
                    iceCandidateBuffer.current.push(candidate);
                }
            }
        });
    });
    return () => unsubscribe();
  }, [player]);

  const startCall = useCallback(async () => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    setIsMicMuted(false);
    const pc = await setupPeerConnection();
    if (!pc) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const callData: CallData = { from: currentPlayer.symbol, offer, status: 'ringing' };
    await setDoc(gameDocRef, { call: callData }, { merge: true });
  }, [setupPeerConnection]);

  const answerCall = useCallback(async () => {
    const callOffer = gameStateRef.current?.call?.offer;
    const currentPlayer = playerRef.current;
    if (!callOffer || !currentPlayer) return;
    
    setIsMicMuted(false);
    const pc = await setupPeerConnection();
    if (!pc) return;
    
    await pc.setRemoteDescription(new RTCSessionDescription(callOffer));
    
    iceCandidateBuffer.current.forEach(candidate => {
      pc.addIceCandidate(candidate).catch(e => console.error("Error adding buffered ICE candidate", e));
    });
    iceCandidateBuffer.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await setDoc(gameDocRef, { call: { ...gameStateRef.current!.call!, answer, status: 'connected' } }, { merge: true });
  }, [setupPeerConnection]);
  
  const endCall = useCallback(async () => {
      await cleanupCall(true);
  }, [cleanupCall]);
  
  const declineCall = useCallback(async () => {
      const currentCall = gameStateRef.current?.call;
      if (!currentCall) return;
      const callData: CallData = { ...currentCall, status: 'declined' };
      await setDoc(gameDocRef, { call: callData }, { merge: true });
      cleanupCall(false);
  }, [cleanupCall]);

  const handleMove = useCallback(async (index: number) => {
    const currentState = gameStateRef.current;
    const currentPlayer = playerRef.current;
    if (!currentState || !currentPlayer || currentState.winner) return;
    if (currentState.board[index] !== null || currentState.turn !== currentPlayer.symbol) return;

    const newBoard = [...currentState.board];
    newBoard[index] = currentPlayer.symbol;
    const winner = checkWinner(newBoard);

    const currentScore = currentState.score || { X: 0, O: 0 };
    let newScore = currentScore;
    if (winner && typeof winner === 'object') {
        newScore = {
            ...currentScore,
            [winner.symbol]: (currentScore[winner.symbol] || 0) + 1,
        };
    }

    await setDoc(gameDocRef, {
      board: newBoard,
      turn: currentPlayer.symbol === 'X' ? 'O' : 'X',
      winner: winner,
      score: newScore,
    }, { merge: true });
  }, []);

  const sendMessage = useCallback(async (type: 'text' | 'voice', content: string) => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    
    const newMessage: ChatMessage = {
        id: new Date().toISOString() + Math.random(),
        senderName: currentPlayer.name,
        senderSymbol: currentPlayer.symbol,
        type,
        content,
        timestamp: Timestamp.now(),
    };

    await setDoc(gameDocRef, {
        chat: arrayUnion(newMessage)
    }, { merge: true });
  }, []);

  return { player, gameState, loading, handleMove, sendMessage, callStatus, remoteStream, startCall, answerCall, declineCall, endCall, isMicMuted, toggleMic };
}
