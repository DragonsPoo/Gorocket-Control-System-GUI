import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface TerminalPanelProps {
    logs: string[];
    activeSequence: string | null;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ logs, activeSequence }) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [logs]);

    return (
        <Card className="bg-card/50 border-border/60 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Sequence Logs</CardTitle>
                {activeSequence && (
                    <Badge variant="outline" className="text-accent border-accent animate-pulse">
                        RUNNING: {activeSequence}
                    </Badge>
                )}
            </CardHeader>
            <CardContent className="flex-grow">
                <ScrollArea className="h-64 w-full rounded-lg bg-muted/30" viewportRef={scrollAreaRef}>
                    <div className="p-4 font-code text-sm">
                        {logs.map((log, index) => (
                            <p key={index} className="whitespace-pre-wrap leading-relaxed">
                                {log}
                            </p>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};

export default TerminalPanel;
