"use client";

import { Phone, PhoneOff, PhoneCall, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Player, GameState } from '@/types';

interface CallManagerProps {
    player: Player;
    players: GameState['players'];
    callStatus: 'idle' | 'dialing' | 'ringing' | 'connected';
    startCall: () => void;
    answerCall: () => void;
    declineCall: () => void;
    endCall: () => void;
    isMicMuted: boolean;
    isSpeakerMuted: boolean;
    onToggleMic: () => void;
    onToggleSpeaker: () => void;
}

export function CallManager({ 
    player,
    players,
    callStatus, 
    startCall, 
    answerCall, 
    declineCall, 
    endCall, 
    isMicMuted,
    isSpeakerMuted,
    onToggleMic,
    onToggleSpeaker
}: CallManagerProps) {
    const opponentSymbol = player.symbol === 'X' ? 'O' : 'X';
    const opponentName = players[opponentSymbol] || 'Opponent';
    
    const OpponentAvatar = () => (
        <Avatar>
            <AvatarFallback className={cn(
                "font-bold",
                opponentSymbol === 'X' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'
            )}>
                {opponentSymbol}
            </AvatarFallback>
        </Avatar>
    );

    if (callStatus === 'idle') {
        if (!players[opponentSymbol]) {
            return (
                <Card>
                    <CardContent className="p-4 text-center text-sm text-muted-foreground">
                        Waiting for opponent to join...
                    </CardContent>
                </Card>
            )
        }
        return (
            <Card>
                <CardContent className="p-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <OpponentAvatar />
                        <span className="font-medium">{opponentName}</span>
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button onClick={startCall} size="icon" aria-label={`Call ${opponentName}`}>
                                    <PhoneCall />
                                </Button>
                            </TooltipTrigger>
                             <TooltipContent>
                                <p>Call {opponentName}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </CardContent>
            </Card>
        );
    }

    const getStatusContent = () => {
        switch(callStatus) {
            case 'ringing': return { title: "Incoming Call", description: `${opponentName} is calling...` };
            case 'dialing': return { title: "Dialing...", description: `Calling ${opponentName}...` };
            case 'connected': return { title: "Call Connected", description: `On call with ${opponentName}` };
            default: return { title: "", description: "" };
        }
    }

    const { title, description } = getStatusContent();

    return (
        <Card className={cn(
            "border-2 transition-colors",
            callStatus === 'ringing' && 'border-blue-500 animate-pulse',
            callStatus === 'dialing' && 'border-gray-500',
            callStatus === 'connected' && 'border-green-500'
        )}>
            <CardHeader className="p-4 flex-row items-center gap-4 space-y-0">
                <OpponentAvatar />
                <div className="flex-1">
                    <CardTitle className="text-base">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex items-center justify-center gap-4">
                {callStatus === 'dialing' && (
                     <Button onClick={endCall} variant="destructive" className="w-full">
                        <PhoneOff />
                        Cancel Call
                    </Button>
                )}
                {callStatus === 'connected' && (
                    <TooltipProvider>
                        <div className="flex w-full items-center justify-around">
                             <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={onToggleMic} variant={isMicMuted ? "secondary": "outline"} size="icon" className="rounded-full w-12 h-12" aria-label={isMicMuted ? "Unmute Mic" : "Mute Mic"}>
                                        {isMicMuted ? <MicOff /> : <Mic />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{isMicMuted ? "Unmute Mic" : "Mute Mic"}</p>
                                </TooltipContent>
                            </Tooltip>

                            <Button onClick={endCall} variant="destructive" size="icon" className="rounded-full w-14 h-14" aria-label="End Call">
                                <PhoneOff className="w-7 h-7" />
                            </Button>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={onToggleSpeaker} variant={isSpeakerMuted ? "secondary": "outline"} size="icon" className="rounded-full w-12 h-12" aria-label={isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}>
                                        {isSpeakerMuted ? <VolumeX /> : <Volume2 />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </TooltipProvider>
                )}
                {callStatus === 'ringing' && (
                    <div className="w-full flex justify-around gap-4">
                        <Button onClick={declineCall} variant="destructive" className="flex-1">
                           <PhoneOff />
                           Decline
                        </Button>
                        <Button onClick={answerCall} variant="default" className="flex-1 bg-green-500 hover:bg-green-600">
                           <Phone />
                           Accept
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
