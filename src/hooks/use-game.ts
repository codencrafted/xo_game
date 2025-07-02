
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  doc, onSnapshot, setDoc, getDoc, arrayUnion, Timestamp,
  collection, addDoc, onSnapshot as onCollectionSnapshot, writeBatch, getDocs,
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';

import { db } from '@/lib/firebase';
import type { Player, GameState, Symbol, Winner, ChatMessage, CallData } from '@/types';

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

  // WebRTC state
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'connected'>('idle');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const iceCandidateBuffer = useRef<RTCIceCandidate[]>([]);
  
  // Refs to avoid stale closures and unnecessary dependencies in callbacks/effects
  const callStatusRef = useRef(callStatus);
  callStatusRef.current = callStatus;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;


  useEffect(() => {
    const playerDataString = localStorage.getItem('tic-tac-toe-player');
    if (!playerDataString) {
      router.replace('/');
      return;
    }
    const parsedPlayer = JSON.parse(playerDataString);
    if (!player || player.symbol !== parsedPlayer.symbol) {
      setPlayer(parsedPlayer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
    });
    setIsMicMuted((prev) => !prev);
  }, []);

  const cleanupCall = useCallback(async (notifyFirestore: boolean) => {
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    setRemoteStream(null);
    setCallStatus('idle');
    setIsMicMuted(false);
    iceCandidateBuffer.current = [];

    if (notifyFirestore && player?.symbol === 'X') { // Only one player cleans up Firestore
        await setDoc(gameDocRef, { call: null }, { merge: true });
        const batch = writeBatch(db);
        const candidatesXSnap = await getDocs(collection(db, 'games', gameId, 'iceCandidatesX'));
        candidatesXSnap.forEach(doc => batch.delete(doc.ref));
        const candidatesOSnap = await getDocs(collection(db, 'games', gameId, 'iceCandidatesO'));
        candidatesOSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
  }, [player]);

  const setupPeerConnection = useCallback(async () => {
    if (peerConnectionRef.current || !player) return peerConnectionRef.current;
    
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    // Get local media
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Handle remote stream
    pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
    };

    // Handle ICE candidates
    const localCandidatesCol = collection(db, 'games', gameId, `iceCandidates${player.symbol}`);
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            addDoc(localCandidatesCol, event.candidate.toJSON());
        }
    };
    
    return pc;
  }, [player]);

  // Main game state listener
  useEffect(() => {
    if (!player) return;

    const unsubscribe = onSnapshot(gameDocRef, async (doc) => {
      if (doc.exists()) {
        const data = doc.data() as GameState;
        setGameState(data);
        
        if (data.restartRequested.X && data.restartRequested.O) {
            if(player.symbol === 'X') {
                await setDoc(gameDocRef, { ...initialGameState, players: data.players });
            }
        }
        
        // Handle call state from Firestore
        if (data.call) {
          const { status, from, answer } = data.call;
          if (status === 'ringing' && from !== player.symbol && callStatusRef.current !== 'ringing') {
            setCallStatus('ringing');
          } else if (status === 'ringing' && from === player.symbol && callStatusRef.current !== 'dialing') {
            setCallStatus('dialing');
          } else if (status === 'connected' && callStatusRef.current !== 'connected') {
            setCallStatus('connected');
            if (answer && peerConnectionRef.current && !peerConnectionRef.current.currentRemoteDescription) {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
              // Process any buffered ICE candidates
              iceCandidateBuffer.current.forEach(candidate => {
                peerConnectionRef.current?.addIceCandidate(candidate).catch(e => console.error("Error adding buffered ICE candidate", e));
              });
              iceCandidateBuffer.current = []; // Clear buffer
            }
          } else if (status === 'declined' || status === 'ended') {
            if(callStatusRef.current !== 'idle') cleanupCall(false);
          }
        } else {
            if(callStatusRef.current !== 'idle') cleanupCall(false);
        }

      } else {
        await setDoc(gameDocRef, initialGameState);
        setGameState(initialGameState);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [player, cleanupCall]);

  // Listen for remote ICE candidates
  useEffect(() => {
    if (!player) return;
    
    const otherPlayerSymbol = player.symbol === 'X' ? 'O' : 'X';
    const remoteCandidatesCol = collection(db, 'games', gameId, `iceCandidates${otherPlayerSymbol}`);
    const unsubscribe = onCollectionSnapshot(remoteCandidatesCol, (snapshot) => {
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
    return unsubscribe;
  }, [player]);

  const startCall = useCallback(async () => {
    if (!player) return;
    setIsMicMuted(false);
    const pc = await setupPeerConnection();
    if (!pc) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const callData: CallData = { from: player.symbol, offer, status: 'ringing' };
    await setDoc(gameDocRef, { call: callData }, { merge: true });
  }, [player, setupPeerConnection]);

  const answerCall = useCallback(async () => {
    if (!gameStateRef.current?.call?.offer || !player) return;
    setIsMicMuted(false);
    const pc = await setupPeerConnection();
    if (!pc) return;
    
    await pc.setRemoteDescription(new RTCSessionDescription(gameStateRef.current.call.offer));
    // Process any buffered ICE candidates
    iceCandidateBuffer.current.forEach(candidate => {
      pc.addIceCandidate(candidate).catch(e => console.error("Error adding buffered ICE candidate", e));
    });
    iceCandidateBuffer.current = []; // Clear buffer

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const callData: CallData = { ...gameStateRef.current.call, answer, status: 'connected' };
    await setDoc(gameDocRef, { call: callData }, { merge: true });
  }, [player, setupPeerConnection]);
  
  const endCall = useCallback(async () => {
      await cleanupCall(true);
  }, [cleanupCall]);
  
  const declineCall = useCallback(async () => {
      if (!gameStateRef.current?.call) return;
      const callData: CallData = { ...gameStateRef.current.call, status: 'declined' };
      await setDoc(gameDocRef, { call: callData }, { merge: true });
      setTimeout(() => { // Allow declined state to sync
        if (player?.symbol === gameStateRef.current?.call?.from) {
          endCall();
        }
      }, 1500);
  }, [player, endCall]);

  const handleMove = useCallback(async (index: number) => {
    if (!gameStateRef.current || !player || gameStateRef.current.winner) return;
    if (gameStateRef.current.board[index] !== null || gameStateRef.current.turn !== player.symbol) return;

    const newBoard = [...gameStateRef.current.board];
    newBoard[index] = player.symbol;
    const winner = checkWinner(newBoard);

    await setDoc(gameDocRef, {
      board: newBoard,
      turn: player.symbol === 'X' ? 'O' : 'X',
      winner: winner,
    }, { merge: true });
  }, [player]);

  const requestRestart = useCallback(async () => {
    if (!gameStateRef.current || !player) return;
    const newRestartRequested = { ...gameStateRef.current.restartRequested, [player.symbol]: true };
    await setDoc(gameDocRef, { restartRequested: newRestartRequested }, { merge: true });
  }, [player]);

  const sendMessage = useCallback(async (type: 'text' | 'voice', content: string) => {
    if (!player) return;
    
    const newMessage: Omit<ChatMessage, 'id' | 'timestamp'> = {
        senderName: player.name,
        senderSymbol: player.symbol,
        type,
        content,
    };

    await setDoc(gameDocRef, {
        chat: arrayUnion({
            ...newMessage,
            id: new Date().toISOString() + Math.random(),
            timestamp: Timestamp.now(),
        })
    }, { merge: true });
  }, [player]);

  return { player, gameState, loading, handleMove, requestRestart, sendMessage, callStatus, remoteStream, startCall, answerCall, declineCall, endCall, isMicMuted, toggleMic };
}
