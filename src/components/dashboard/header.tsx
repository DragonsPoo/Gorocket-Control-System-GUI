import React, { useState, useRef, useEffect } from 'react';
import { Rocket, Wifi, WifiOff, Plug, AlertTriangle, ShieldAlert, Siren } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AppConfig } from '@shared/types';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";

interface HeaderProps {
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'reconnecting';
  ports: string[];
  selectedPort: string;
  onPortChange: (port: string) => void;
  onRefreshPorts: () => void;
  onConnect: () => void;
  isLogging: boolean;
  onToggleLogging: () => void;
  appConfig: AppConfig | null;
  isEmergency: boolean;
  onClearEmergency: () => void;
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
  appConfig,
  isEmergency,
  onClearEmergency,
}) => {
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'reconnecting';

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const HOLD_DURATION = 3000; // 3 seconds

  const handleClearPress = () => {
    holdTimer.current = setTimeout(() => {
      setShowClearConfirm(true);
      resetHold();
    }, HOLD_DURATION);

    holdInterval.current = setInterval(() => {
      setHoldProgress(p => p + (100 / (HOLD_DURATION / 100)));
    }, 100);
  };

  const resetHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (holdInterval.current) clearInterval(holdInterval.current);
    setHoldProgress(0);
  };

  const handleClearRelease = () => {
    resetHold();
  };

  const handleConfirmClear = () => {
    onClearEmergency();
    setShowClearConfirm(false);
  };

  useEffect(() => {
    return () => {
      resetHold(); // Cleanup on unmount
    }
  }, []);

  return (
    <>
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
              <span>ALARM: <strong>{appConfig?.pressureLimitAlarmPsi ?? 'N/A'} psi</strong></span>
            </div>
            <div className="flex items-center gap-1" title="MCU-level Hardware Trip">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>TRIP: <strong>{appConfig?.pressureLimitTripPsi ?? 'N/A'} psi</strong></span>
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

          {isEmergency && isConnected && (
            <div className="relative">
              <Button
                variant="destructive"
                className="pl-4 pr-4 relative overflow-hidden"
                onMouseDown={handleClearPress}
                onMouseUp={handleClearRelease}
                onMouseLeave={handleClearRelease}
              >
                <Siren className="w-5 h-5 mr-2 animate-ping absolute left-2" />
                <Siren className="w-5 h-5 mr-2" />
                Clear Emergency
              </Button>
              {holdProgress > 0 && (
                <Progress value={holdProgress} className="absolute bottom-0 left-0 right-0 h-1" />
              )}
            </div>
          )}

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
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Emergency Clear</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear the MCU emergency state? This should only be done when the physical system is confirmed to be safe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClear}>Confirm Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Header;
