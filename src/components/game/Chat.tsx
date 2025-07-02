"use client";

import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Mic, Send, Square, Volume2, Loader2, Play, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { Player, ChatMessage, Symbol } from "@/types";
import { cn } from "@/lib/utils";
import { textToSpeech } from "@/ai/flows/tts-flow";


interface ChatProps {
    player: Player;
    messages: ChatMessage[];
    onSendMessage: (type: 'text' | 'voice', content: string) => void;
}

const VoiceMessagePlayer = ({ src }: { src: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = new Audio(src);
        const currentAudio = audioRef.current;
        currentAudio.onended = () => setIsPlaying(false);
        
        return () => {
            currentAudio.pause();
        };
    }, [src]);

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else {
            audioRef.current?.play().catch(e => console.error("Audio play failed:", e));
            setIsPlaying(true);
        }
    };

    return (
        <Button onClick={togglePlay} variant="outline" size="sm" className="mt-2 text-left justify-start w-full">
            {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {isPlaying ? 'Pause' : 'Play Voice Message'}
        </Button>
    );
};


export function Chat({ player, messages = [], onSendMessage }: ChatProps) {
    const [textMessage, setTextMessage] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [currentTts, setCurrentTts] = useState<{ id: string; audio: HTMLAudioElement | null; isLoading: boolean }>({ id: '', audio: null, isLoading: false });
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight });
        }
    }, [messages]);

    const handleSendText = () => {
        if (textMessage.trim()) {
            onSendMessage('text', textMessage.trim());
            setTextMessage("");
        }
    };

    const handleRecord = async () => {
        if (isRecording) {
            mediaRecorder.current?.stop();
            setIsRecording(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder.current = new MediaRecorder(stream);
                const audioChunks: Blob[] = [];

                mediaRecorder.current.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.current.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    // 1MB limit for Firestore document field
                    if (audioBlob.size > 1024 * 1024) {
                        toast({
                            title: "Recording too large",
                            description: "Your voice message is too large to send. Please keep it brief.",
                            variant: "destructive",
                        });
                        return;
                    }
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => {
                        const base64String = reader.result as string;
                        onSendMessage('voice', base64String);
                    };
                    stream.getTracks().forEach(track => track.stop());
                };
                
                mediaRecorder.current.start();
                setIsRecording(true);
            } catch (error) {
                console.error("Error accessing microphone:", error);
                toast({
                    title: "Microphone Error",
                    description: "Could not access the microphone. Please check permissions.",
                    variant: "destructive",
                });
            }
        }
    };
    
    const handlePlayTTS = async (message: ChatMessage) => {
        if (currentTts.audio) {
            currentTts.audio.pause();
            setCurrentTts({ id: '', audio: null, isLoading: false });
            if (currentTts.id === message.id) return;
        }

        setCurrentTts({ id: message.id, audio: null, isLoading: true });
        try {
            const response = await textToSpeech(message.content);
            if (response.media) {
                const audio = new Audio(response.media);
                setCurrentTts({ id: message.id, audio: audio, isLoading: false });
                audio.play();
                audio.onended = () => {
                    setCurrentTts({ id: '', audio: null, isLoading: false });
                };
            }
        } catch (error) {
            console.error("TTS Error:", error);
            toast({
                title: "Could not play audio",
                variant: "destructive",
            });
            setCurrentTts({ id: '', audio: null, isLoading: false });
        }
    };

    const MessageAvatar = ({ symbol }: { symbol: Symbol }) => (
        <Avatar className="w-8 h-8">
            <AvatarFallback className={cn(
                "font-bold",
                symbol === 'X' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'
            )}>
                {symbol}
            </AvatarFallback>
        </Avatar>
    );

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="text-center">Game Chat</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden p-0 px-2 sm:px-4">
                <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                    <div className="space-y-4">
                        {messages.map((msg) => (
                             <div key={msg.id} className={cn(
                                "flex items-start gap-3",
                                msg.senderSymbol === player.symbol ? "justify-end" : "justify-start"
                             )}>
                                {msg.senderSymbol !== player.symbol && <MessageAvatar symbol={msg.senderSymbol} />}
                                <div className={cn(
                                    "max-w-xs rounded-lg p-3 text-sm flex flex-col",
                                    msg.senderSymbol === player.symbol 
                                        ? "bg-primary text-primary-foreground" 
                                        : "bg-muted"
                                )}>
                                    <p className="font-bold">{msg.senderName}</p>
                                    {msg.type === 'text' ? (
                                       <div className="flex items-center gap-2">
                                            <p className="break-words">{msg.content}</p>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handlePlayTTS(msg)}>
                                                            {currentTts.isLoading && currentTts.id === msg.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Read Aloud</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                       </div>
                                    ) : (
                                        <VoiceMessagePlayer src={msg.content} />
                                    )}
                                    <p className="text-xs opacity-70 mt-1 text-right">
                                        {msg.timestamp ? formatDistanceToNow(msg.timestamp.toDate(), { addSuffix: true }) : 'sending...'}
                                    </p>
                                </div>
                                {msg.senderSymbol === player.symbol && <MessageAvatar symbol={msg.senderSymbol} />}
                             </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="flex items-center gap-2 p-4 border-t">
                    <Input 
                        placeholder="Type a message..."
                        value={textMessage}
                        onChange={(e) => setTextMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                    />
                    <Button onClick={handleSendText} size="icon" disabled={!textMessage.trim()}>
                        <Send />
                    </Button>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button onClick={handleRecord} size="icon" variant={isRecording ? "destructive" : "outline"}>
                                    {isRecording ? <Square /> : <Mic />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isRecording ? "Stop Recording" : "Send Voice Message"}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardContent>
        </Card>
    );
}
