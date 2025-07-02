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
  matchWinner: null,
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

  const gameStateRef = useRef<GameState | null>(gameState);
  gameStateRef.current = gameState;

  const ringtoneAudioRef = useRef<{ context: AudioContext, interval: NodeJS.Timeout } | null>(null);

  const stopRingtone = useCallback(() => {
    if (ringtoneAudioRef.current) {
        clearInterval(ringtoneAudioRef.current.interval);
        try {
          ringtoneAudioRef.current.context.close();
        } catch (e) {
          // Ignore errors if context is already closed
        }
        ringtoneAudioRef.current = null;
    }
  }, []);

  const playRingtone = useCallback(() => {
    stopRingtone();
    if (typeof window === 'undefined') return;

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const context = new AudioContext();
    if (context.state === 'suspended') {
      context.resume();
    }
    
    let isPlaying = false;
    
    const ringPattern = () => {
        if (context.state !== 'running' || isPlaying) return;
        isPlaying = true;
        
        const gainNode = context.createGain();
        const osc1 = context.createOscillator();
        const osc2 = context.createOscillator();
        
        gainNode.gain.setValueAtTime(0, context.currentTime);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, context.currentTime);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, context.currentTime);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(context.destination);
        
        gainNode.gain.linearRampToValueAtTime(0.1, context.currentTime + 0.01);
        osc1.start();
        osc2.start();

        gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 2 - 0.05);
        osc1.stop(context.currentTime + 2);
        osc2.stop(context.currentTime + 2);
        
        setTimeout(() => { isPlaying = false; }, 2000);
    };
    
    const interval = setInterval(ringPattern, 4000);
    ringPattern();

    ringtoneAudioRef.current = { context, interval };
  }, [stopRingtone]);

  useEffect(() => {
    if (callStatus === 'dialing' || callStatus === 'ringing') {
      playRingtone();
    } else {
      stopRingtone();
    }
    return () => {
      stopRingtone();
    };
  }, [callStatus, playRingtone, stopRingtone]);

  useEffect(() => {
    const playerDataString = localStorage.getItem('tic-tac-toe-player');
    if (!playerDataString) {
        router.replace('/');
        setLoading(false);
        return;
    }
    const storedPlayer = JSON.parse(playerDataString);
    if (!playerRef.current) {
        setPlayer(storedPlayer);
    }
  }, [router]); 

  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !track.enabled;
      });
      setIsMicMuted((prev) => !prev);
    }
  }, []);

  const cleanupCall = useCallback(async (isInitiator: boolean) => {
    stopRingtone();
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    setRemoteStream(null);
    setCallStatus('idle');
    setIsMicMuted(false);
    iceCandidateBuffer.current = [];

    const currentGameState = gameStateRef.current;
    if (isInitiator && currentGameState?.call) {
        await setDoc(gameDocRef, { call: null }, { merge: true });
    } else if (playerRef.current?.symbol === 'X') {
        const callStillExists = (await getDoc(gameDocRef)).data()?.call;
        if (callStillExists) {
            await setDoc(gameDocRef, { call: null }, { merge: true });
        }
    }
    
    const batch = writeBatch(db);
    const candidatesXSnap = await getDocs(collection(db, 'games', gameId, 'iceCandidatesX'));
    candidatesXSnap.forEach(doc => batch.delete(doc.ref));
    const candidatesOSnap = await getDocs(collection(db, 'games', gameId, 'iceCandidatesO'));
    candidatesOSnap.forEach(doc => batch.delete(doc.ref));
    if (!candidatesXSnap.empty || !candidatesOSnap.empty) {
        await batch.commit();
    }
  }, [stopRingtone]);

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
      if (!doc.exists()) {
        if(player.symbol === 'X') {
          await setDoc(gameDocRef, initialGameState);
        }
        setGameState(initialGameState);
        setLoading(false);
        return;
      }
      
      const data = doc.data() as GameState;
      const oldGameState = gameStateRef.current;
      const currentStatus = callStatusRef.current;

      // New chat message notification
      if (oldGameState && data.chat && data.chat.length > (oldGameState.chat?.length || 0)) {
        const newMessage = data.chat[data.chat.length - 1];
        if (newMessage.senderSymbol !== player.symbol) {
          toast({
              title: `New message from ${newMessage.senderName}`,
              description: newMessage.type === 'text' 
                  ? (newMessage.content.length > 30 ? newMessage.content.substring(0, 30) + '...' : newMessage.content)
                  : 'Sent a voice message.',
          });
        }
      }
      
      const callData = data.call;

      if (callData) {
        const { status, from, answer } = callData;
        const isReceiver = from !== player.symbol;

        if (status === 'ringing' && isReceiver && currentStatus === 'idle') {
          setCallStatus('ringing');
          const otherPlayerName = data.players[from];
          toast({
            title: 'Incoming Call',
            description: `${otherPlayerName || 'Opponent'} is calling you.`,
          });
        } else if (status === 'ringing' && !isReceiver && currentStatus === 'idle') {
          setCallStatus('dialing');
        } else if (status === 'connected' && currentStatus !== 'connected') {
            if (!isReceiver && answer && peerConnectionRef.current && !peerConnectionRef.current.currentRemoteDescription) {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
              }
          setCallStatus('connected');
        } else if ((status === 'declined' || status === 'ended') && currentStatus !== 'idle') {
          await cleanupCall(false);
        }
      } else if (currentStatus !== 'idle') {
        await cleanupCall(false);
      }
      
      setGameState(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [player, cleanupCall, toast]);

    // Auto-restart effect
    useEffect(() => {
      if (gameState?.winner && !gameState.matchWinner && player?.symbol === 'X') {
        const timer = setTimeout(async () => {
            const gameDoc = await getDoc(gameDocRef);
            if (!gameDoc.exists()) return;

            const currentGameState = gameDoc.data() as GameState;
            if (!currentGameState?.winner) return;

            const { players, score, chat } = currentGameState;
            
            await setDoc(gameDocRef, {
                ...initialGameState,
                players: players || { X: null, O: null },
                score: score || { X: 0, O: 0 },
                chat: chat || [],
                // Keep call state if a call is active through a restart
                call: currentGameState.call || null,
            });
        }, 4000);

        return () => clearTimeout(timer);
      }
    }, [gameState?.winner, gameState?.matchWinner, player?.symbol]);

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
    const currentState = gameStateRef.current;
    const currentPlayer = playerRef.current;
    if (!currentState?.call?.offer || !currentPlayer) return;
    
    setIsMicMuted(false);
    const pc = await setupPeerConnection();
    if (!pc) return;
    
    await pc.setRemoteDescription(new RTCSessionDescription(currentState.call.offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const callUpdate: CallData = {
        ...currentState.call,
        answer,
        status: 'connected'
    };
    await setDoc(gameDocRef, { call: callUpdate }, { merge: true });

    iceCandidateBuffer.current.forEach(candidate => {
      pc.addIceCandidate(candidate).catch(e => console.error("Error adding buffered ICE candidate", e));
    });
    iceCandidateBuffer.current = [];
  }, [setupPeerConnection]);
  
  const endCall = useCallback(async () => {
    await cleanupCall(true);
  }, [cleanupCall]);
  
  const declineCall = useCallback(async () => {
    const currentCall = gameStateRef.current?.call;
    if (!currentCall) return;
    const callData: CallData = { ...currentCall, status: 'declined' };
    await setDoc(gameDocRef, { call: callData }, { merge: true });
  }, []);

  const handleMove = useCallback(async (index: number) => {
    const currentState = gameStateRef.current;
    const currentPlayer = playerRef.current;
    if (!currentState || !currentPlayer || currentState.winner || currentState.board[index] !== null || currentState.turn !== currentPlayer.symbol) {
        return;
    }

    const newBoard = [...currentState.board];
    newBoard[index] = currentPlayer.symbol;
    const winner = checkWinner(newBoard);

    const currentScore = currentState.score || { X: 0, O: 0 };
    let newScore = currentScore;
    let matchWinner: Symbol | null = currentState.matchWinner || null;

    if (winner && typeof winner === 'object') {
        newScore = {
            ...currentScore,
            [winner.symbol]: (currentScore[winner.symbol] || 0) + 1,
        };
        if (newScore[winner.symbol] >= 10) {
            matchWinner = winner.symbol;
        }
    }

    await setDoc(gameDocRef, {
      board: newBoard,
      turn: currentPlayer.symbol === 'X' ? 'O' : 'X',
      winner: winner,
      score: newScore,
      matchWinner: matchWinner,
    }, { merge: true });
  }, []);

  const resetMatch = useCallback(async () => {
    const gameDoc = await getDoc(gameDocRef);
    if (gameDoc.exists()) {
        const currentGameState = gameDoc.data() as GameState;
        await setDoc(gameDocRef, {
            ...initialGameState,
            players: currentGameState.players,
            chat: currentGameState.chat,
            call: null,
        });
    }
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

  const leaveGame = useCallback(async () => {
    setLoading(true);
    const currentPlayer = playerRef.current;
    if (!currentPlayer) {
        router.push('/');
        return;
    }

    await cleanupCall(true);

    const gameDoc = await getDoc(gameDocRef);
    if (gameDoc.exists()) {
        const currentGameState = gameDoc.data() as GameState;
        const newPlayers = { ...currentGameState.players };
        newPlayers[currentPlayer.symbol] = null;
        
        const otherSymbol = currentPlayer.symbol === 'X' ? 'O' : 'X';
        const otherPlayerExists = !!newPlayers[otherSymbol];

        if (!otherPlayerExists) {
            await setDoc(gameDocRef, initialGameState);
        } else {
            await setDoc(gameDocRef, {
                players: newPlayers,
                board: initialGameState.board,
                turn: initialGameState.turn,
                winner: initialGameState.winner,
                restartRequested: initialGameState.restartRequested,
                call: null,
                matchWinner: null,
            }, { merge: true });
        }
    }

    localStorage.removeItem('tic-tac-toe-player');
    router.push('/');
  }, [router, cleanupCall]);

  return { player, gameState, loading, handleMove, sendMessage, callStatus, remoteStream, startCall, answerCall, declineCall, endCall, isMicMuted, toggleMic, leaveGame, resetMatch };
}
