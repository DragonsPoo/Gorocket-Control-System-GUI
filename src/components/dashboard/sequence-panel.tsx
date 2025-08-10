import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PlayCircle, ShieldAlert, Zap, Wind } from 'lucide-react';
interface SequencePanelProps {
  onSequence: (sequenceName: string) => void;
  onCancel: () => void;
  activeSequence: string | null;
  sequences: string[];
  disabled?: boolean;
}

const sequenceMeta: Record<
  string,
  { icon: React.ReactElement; variant: 'default' | 'outline' | 'destructive' }
> = {
  'Pre-launch Check': { icon: <PlayCircle />, variant: 'outline' },
  'Ignition Sequence': { icon: <Zap />, variant: 'default' },
  'System Purge': { icon: <Wind />, variant: 'outline' },
  'Emergency Shutdown': { icon: <ShieldAlert />, variant: 'destructive' },
};

const SequencePanel: React.FC<SequencePanelProps> = ({
  onSequence,
  onCancel,
  activeSequence,
  sequences,
  disabled = false,
}) => {
  return (
    <Card className="bg-card/50 border-border/60">
      <CardHeader>
        <CardTitle>Control Sequences</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sequences.map((name) => {
          const meta = sequenceMeta[name] ?? {
            icon: <PlayCircle />,
            variant: 'outline' as const,
          };
          return name === 'Ignition Sequence' ? (
            <AlertDialog key={name}>
              <AlertDialogTrigger asChild>
                <Button
                  variant={meta.variant}
                  className="w-full justify-start text-base py-6"
                  disabled={disabled || !!activeSequence}
                >
                  {React.cloneElement(meta.icon, { className: 'w-5 h-5 mr-3' })}
                  {name}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>경고: 점화 시퀀스</AlertDialogTitle>
                <AlertDialogDescription>
                  점화 시퀀스를 시작하시겠습니까? 이 동작은 되돌릴 수 없습니다.
                </AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onSequence(name)}>
                    점화 시작
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              key={name}
              variant={meta.variant}
              className="w-full justify-start text-base py-6"
              onClick={() => onSequence(name)}
              disabled={
                name === 'Emergency Shutdown'
                  ? disabled
                  : disabled || !!activeSequence
              }
            >
              {React.cloneElement(meta.icon, { className: 'w-5 h-5 mr-3' })}
              {name}
            </Button>
          );
        })}
        <Button
          variant="secondary"
          className="w-full justify-start text-base py-6"
          onClick={onCancel}
          disabled={!activeSequence}
        >
          Cancel
        </Button>
      </CardContent>
    </Card>
  );
};

export default SequencePanel;

