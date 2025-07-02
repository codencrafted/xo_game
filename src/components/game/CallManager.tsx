"use client";

import { Phone, PhoneOff, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CallManagerProps {
    callStatus: 'idle' | 'dialing' | 'ringing' | 'connected';
    startCall: () => void;
    answerCall: () => void;
    declineCall: () => void;
    endCall: () => void;
}

export function CallManager({ callStatus, startCall, answerCall, declineCall, endCall }: CallManagerProps) {
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
                {(callStatus === 'dialing' || callStatus === 'connected') && (
                     <Button onClick={endCall} variant="destructive" size="icon" aria-label="End Call">
                        <PhoneOff />
                    </Button>
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
