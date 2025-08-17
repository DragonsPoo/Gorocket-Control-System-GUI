import React from 'react';
import React from 'react';
import { Rocket, Wifi, WifiOff, Plug, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AppConfig } from '@shared/types';
import { Separator } from '@/components/ui/separator';

interface HeaderProps {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  ports: string[];
  selectedPort: string;
  onPortChange: (port: string) => void;
  onRefreshPorts: () => void;
  onConnect: () => void;
  isLogging: boolean;
  onToggleLogging: () => void;
  appConfig: AppConfig | null;
}

const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  ports,
  selectedPort,
  onPortChange,
  onRefreshPorts,
  onConnect,
  isLogging,
  onToggleLogging,
  appConfig
}) => {
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  return (
    <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
      <div className="flex items-center gap-3">
        <Rocket className="w-8 h-8 text-accent" />
        <h1 className="text-2xl font-bold font-headline tracking-tight">
          GOROCKET Control Suite
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1" title="GUI-level Failsafe Trigger">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>ALARM: <strong>{appConfig?.pressureLimitAlarm ?? 'N/A'} psi</strong></span>
          </div>
          <div className="flex items-center gap-1" title="MCU-level Hardware Trip">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>TRIP: <strong>{appConfig?.pressureLimitTrip ?? 'N/A'} psi</strong></span>
          </div>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-muted-foreground" />
            <Select onValueChange={onPortChange} value={selectedPort} disabled={isConnected || isConnecting}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select a port" />
                </SelectTrigger>
                <SelectContent>
                    {ports.length > 0 ? (
                        ports.map(port => <SelectItem key={port} value={port}>{port}</SelectItem>)
                    ) : (
                        <div className="p-2 text-sm text-center text-muted-foreground">No ports found</div>
                    )}
                </SelectContent>
            </Select>
            <Button onClick={onRefreshPorts} variant="outline" disabled={isConnecting}>Refresh</Button>
        </div>

        <Button onClick={onConnect} disabled={isConnecting || (!selectedPort && !isConnected)} variant={isConnected ? "destructive" : "default"}>
          {isConnecting ? "Connecting..." : (isConnected ? "Disconnect" : "Connect")}
        </Button>
        <Button onClick={onToggleLogging} variant={isLogging ? "destructive" : "secondary"}>
          {isLogging ? "Stop Logging" : "Start Logging"}
        </Button>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Wifi className="w-5 h-5 text-accent" />
              <span className="text-sm font-medium text-accent">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-destructive" />
              <span className="text-sm font-medium text-destructive">Disconnected</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
