import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PlayCircle, ShieldAlert, Zap, Wind } from 'lucide-react';

interface SequencePanelProps {
    onSequence: (sequenceName: string) => void;
    activeSequence: string | null;
}

const sequences = [
    { name: "Pre-launch Check", icon: <PlayCircle />, variant: "outline" as const },
    { name: "Ignition Sequence", icon: <Zap />, variant: "default" as const },
    { name: "System Purge", icon: <Wind />, variant: "outline" as const },
    { name: "Emergency Shutdown", icon: <ShieldAlert />, variant: "destructive" as const },
];

const SequencePanel: React.FC<SequencePanelProps> = ({ onSequence, activeSequence }) => {
  return (
    <Card className="bg-card/50 border-border/60">
        <CardHeader>
            <CardTitle>Control Sequences</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
            {sequences.map(seq => (
                seq.name === "Ignition Sequence" ? (
                    <AlertDialog key={seq.name}>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant={seq.variant}
                                className="w-full justify-start text-base py-6"
                                disabled={!!activeSequence}
                            >
                                {React.cloneElement(seq.icon, { className: 'w-5 h-5 mr-3' })}
                                {seq.name}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogTitle>경고: 점화 시퀀스</AlertDialogTitle>
                            <AlertDialogDescription>
                                점화 시퀀스를 시작하시겠습니까? 이 동작은 되돌릴 수 없습니다.
                            </AlertDialogDescription>
                            <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onSequence(seq.name)}>점화 시작</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                ) : (
                    <Button
                        key={seq.name}
                        variant={seq.variant}
                        className="w-full justify-start text-base py-6"
                        onClick={() => onSequence(seq.name)}
                        disabled={!!activeSequence}
                    >
                        {React.cloneElement(seq.icon, { className: 'w-5 h-5 mr-3' })}
                        {seq.name}
                    </Button>
                )
            ))}
        </CardContent>
    </Card>
  );
};

export default SequencePanel;
