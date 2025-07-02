"use client";

import { Phone, PhoneOff, PhoneCall, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface CallManagerProps {
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
    if (callStatus === 'idle') {
        return (
            <Card>
                <CardContent className="p-2">
                    <Button onClick={startCall} className="w-full">
                        <PhoneCall className="mr-2" />
                        Voice Call Opponent
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn(
            "border-2",
            callStatus === 'ringing' && 'border-blue-500 animate-pulse',
            callStatus === 'dialing' && 'border-gray-500',
            callStatus === 'connected' && 'border-green-500'
        )}>
            <CardHeader className="p-2 pb-0">
                <CardTitle className="text-sm text-center">
                    {callStatus === 'ringing' && "Incoming Call..."}
                    {callStatus === 'dialing' && "Dialing..."}
                    {callStatus === 'connected' && "Call Connected"}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex items-center justify-center gap-2">
                {callStatus === 'dialing' && (
                     <Button onClick={endCall} variant="destructive" size="icon" aria-label="End Call">
                        <PhoneOff />
                    </Button>
                )}
                {callStatus === 'connected' && (
                    <TooltipProvider>
                        <div className="flex items-center justify-center gap-2">
                             <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={onToggleMic} variant="outline" size="icon" aria-label={isMicMuted ? "Unmute Mic" : "Mute Mic"}>
                                        {isMicMuted ? <MicOff /> : <Mic />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{isMicMuted ? "Unmute Mic" : "Mute Mic"}</p>
                                </TooltipContent>
                            </Tooltip>

                            <Button onClick={endCall} variant="destructive" size="icon" aria-label="End Call">
                                <PhoneOff />
                            </Button>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={onToggleSpeaker} variant="outline" size="icon" aria-label={isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}>
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
                    <>
                        <Button onClick={answerCall} variant="default" size="icon" className="bg-green-500 hover:bg-green-600" aria-label="Accept Call">
                           <Phone />
                        </Button>
                        <Button onClick={declineCall} variant="destructive" size="icon" aria-label="Decline Call">
                           <PhoneOff />
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
