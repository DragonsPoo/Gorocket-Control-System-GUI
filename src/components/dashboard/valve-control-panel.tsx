import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Valve, ValveState } from '@shared/types';
import { cn } from '@/lib/utils';
import { RotateCw, CheckCircle, XCircle } from 'lucide-react';

interface ValveControlPanelProps {
  valves: Valve[];
  onValveChange: (valveId: number, targetState: 'OPEN' | 'CLOSED') => void;
}

const ValveIcon = ({ state }: { state: ValveState }) => {
  const baseClasses = "w-10 h-10 transition-transform duration-500";
  const rotation = state === 'OPEN' || state === 'OPENING' ? 'rotate-90' : '';
  
  return (
    <div className={cn("relative", baseClasses, rotation)}>
        <div className="absolute top-1/2 left-0 w-full h-1.5 bg-muted-foreground -translate-y-1/2 rounded-full" />
        <div className={cn(
            "absolute left-1/2 top-1/2 w-2.5 h-7 bg-card border -translate-x-1/2 -translate-y-1/2 rounded-sm",
            state === 'OPEN' && 'border-accent',
            state === 'CLOSED' && 'border-muted-foreground',
            (state === 'OPENING' || state === 'CLOSING') && 'border-accent animate-pulse',
            state === 'ERROR' && 'border-destructive'
        )} />
    </div>
  );
};

const LimitSwitchIndicator: React.FC<{ label: string; active: boolean; }> = ({ label, active }) => (
    <div className="flex items-center gap-1.5 text-xs">
        <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-green-500" : "bg-muted-foreground/50")}></span>
        <span className={cn("font-medium", active ? "text-green-500" : "text-muted-foreground")}>{label}</span>
    </div>
);

const ValveControl: React.FC<{ valve: Valve; onValveChange: ValveControlPanelProps['onValveChange']; }> = ({ valve, onValveChange }) => {
  const isTransitioning = valve.state === 'OPENING' || valve.state === 'CLOSING';

  const stateInfo = {
    OPEN: { text: "Open", icon: <CheckCircle className="w-3 h-3" /> },
    CLOSED: { text: "Closed", icon: <XCircle className="w-3 h-3" /> },
    OPENING: { text: "Opening...", icon: <RotateCw className="w-3 h-3 animate-spin" /> },
    CLOSING: { text: "Closing...", icon: <RotateCw className="w-3 h-3 animate-spin" /> },
    ERROR: { text: "Error", icon: <XCircle className="w-3 h-3" /> },
  }[valve.state];

  return (
    <div className="p-3 bg-muted/30 rounded-lg flex flex-col gap-3">
        <div className="flex justify-between items-start">
            <h3 className="font-semibold text-sm">{valve.name}</h3>
            <Badge variant={isTransitioning ? "outline" : (valve.state === 'OPEN' ? 'default' : 'secondary')} className={cn(
              'text-xs py-0.5 px-1.5',
              valve.state === 'OPEN' && 'bg-accent text-accent-foreground',
              isTransitioning && 'border-accent text-accent',
              valve.state === 'ERROR' && 'bg-destructive text-destructive-foreground'
            )}>
              {stateInfo.icon}
              {stateInfo.text}
            </Badge>
        </div>

        <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-1.5">
                <LimitSwitchIndicator label="LS Open" active={valve.lsOpen} />
                <LimitSwitchIndicator label="LS Closed" active={valve.lsClosed} />
            </div>
            <ValveIcon state={valve.state} />
        </div>

        <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => onValveChange(valve.id, 'OPEN')} disabled={isTransitioning || valve.state === 'OPEN'}>Open</Button>
            <Button size="sm" className="flex-1 h-8 text-xs" variant="outline" onClick={() => onValveChange(valve.id, 'CLOSED')} disabled={isTransitioning || valve.state === 'CLOSED'}>Close</Button>
        </div>
    </div>
  );
};

const ValveControlPanel: React.FC<ValveControlPanelProps> = ({ valves, onValveChange }) => {
  return (
    <Card className="bg-card/50 border-border/60">
      <CardHeader className="p-4">
        <CardTitle className="text-xl">Valve Control & Status</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {valves.map(valve => (
                <ValveControl key={valve.id} valve={valve} onValveChange={onValveChange} />
            ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ValveControlPanel;
