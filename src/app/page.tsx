'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/dashboard/header';
import SensorPanel from '@/components/dashboard/sensor-panel';
import ValveDisplay from '@/components/dashboard/valve-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SequencePanel from '@/components/dashboard/sequence-panel';
import DataChartPanel from '@/components/dashboard/data-chart-panel';
import TerminalPanel from '@/components/dashboard/terminal-panel';
import { useToast } from '@/hooks/use-toast';
import { useSerialManager } from '@/hooks/useSerialManager';
import { useSequenceManager } from '@/hooks/useSequenceManager';

export default function Home() {
  const { toast } = useToast();
  const {
    appConfig,
    sensorData,
    chartData,
    valves,
    connectionStatus,
    isEmergency,
    serialPorts,
    selectedPort,
    setSelectedPort,
    refreshPorts,
    handleConnect,
    handleValveChange,
    setLogger,
    setSequenceHandler,
    resetEmergency,
    clearMcuEmergency,
  } = useSerialManager();

  const {
    sequenceLogs,
    activeSequence,
    handleSequence,
    addLog,
    cancelSequence,
    sequences,
    sequencesValid,
  } = useSequenceManager({
    valves,
    // appConfig, // Not used in current implementation
    // sendCommand, // Not used in current implementation
    // getSensorData: getLatestSensorData, // Not used in current implementation
    onSequenceComplete: (name) => {
      if (name === 'Emergency Shutdown') resetEmergency();
    },
  });

  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    setLogger(addLog);
    setSequenceHandler(handleSequence);
  }, [addLog, handleSequence, setLogger, setSequenceHandler]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        if (event.deltaY < 0) {
          window.electronAPI.zoomIn();
        } else {
          window.electronAPI.zoomOut();
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        if (event.key === '=') {
          event.preventDefault();
          window.electronAPI.zoomIn();
        } else if (event.key === '-') {
          event.preventDefault();
          window.electronAPI.zoomOut();
        } else if (event.key === '0') {
          event.preventDefault();
          window.electronAPI.zoomReset();
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const cleanup = window.electronAPI.onLogCreationFailed(() => {
      toast({ title: 'Logging Error', description: 'Failed to create log file.', variant: 'destructive' });
    });

    return () => {
      cleanup();
    };
  }, [toast]);

  const handleLoggingToggle = () => {
    if (isLogging) {
      window.electronAPI.stopLogging();
      setIsLogging(false);
    } else {
      window.electronAPI.startLogging();
      setIsLogging(true);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header
        connectionStatus={connectionStatus}
        ports={serialPorts}
        selectedPort={selectedPort}
        onPortChange={setSelectedPort}
        onRefreshPorts={refreshPorts}
        onConnect={handleConnect}
        isLogging={isLogging}
        onToggleLogging={handleLoggingToggle}
        appConfig={appConfig}
        isEmergency={isEmergency}
        onClearEmergency={clearMcuEmergency}
      />
      <main className="flex-grow p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
          <div className="md:col-span-12">
            <SensorPanel data={sensorData} />
          </div>

          <div className="md:col-span-7 lg:col-span-8 grid grid-cols-1 gap-6">
            <Card className="bg-card/50 border-border/60">
              <CardHeader className="p-4">
                <CardTitle className="text-xl">Valve Control &amp; Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {valves.map((valve) => (
                    <ValveDisplay key={valve.id} valve={valve} onValveChange={handleValveChange} />
                  ))}
                </div>
              </CardContent>
            </Card>
            <DataChartPanel data={chartData} />
          </div>

          <div className="md:col-span-5 lg:col-span-4 grid grid-cols-1 gap-6 auto-rows-min">
            <SequencePanel
              onSequence={handleSequence}
              onCancel={cancelSequence}
              activeSequence={activeSequence}
              sequences={sequences}
              disabled={!sequencesValid}
            />
            <TerminalPanel logs={sequenceLogs} activeSequence={activeSequence} />
          </div>
        </div>
      </main>
    </div>
  );
}
