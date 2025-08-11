import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge, Thermometer, Waves, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { SensorData } from '@shared/types';
import { DashboardItem } from './dashboard-item';

interface SensorPanelProps {
  data: SensorData | null;
}

const SensorDisplay: React.FC<{ icon: React.ReactNode; label: string; value: string | null; unit: string; isError?: boolean; }> = ({ icon, label, value, unit, isError = false }) => (
  <DashboardItem className="flex items-center gap-4 p-4">
    <div className={`p-3 rounded-md ${isError ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-accent'}`}>{icon}</div>
    <div className="flex-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      {value !== null ? (
        <p className={`text-2xl font-bold ${isError ? 'text-destructive font-sans' : 'font-code'}`}>
          {value} {!isError && <span className="text-lg font-sans text-muted-foreground">{unit}</span>}
        </p>
      ) : (
        <Skeleton className="h-8 w-32" />
      )}
    </div>
  </DashboardItem>
);

const SensorPanel: React.FC<SensorPanelProps> = ({ data }) => {
  const formatValue = (value: number | undefined, precision: number = 2): string | null =>
    value !== undefined ? value.toFixed(precision) : null;

  const getTcState = (tcValue: number | string | undefined) => {
    if (tcValue === undefined || tcValue === null) return { value: null, isError: false };
    if (typeof tcValue === 'number') {
      return { value: formatValue(tcValue, 0), isError: false };
    }
    // It's an error string
    return { value: `TC 센서 오류 (${tcValue})`, isError: true };
  };

  const tc1State = getTcState(data?.tc1);
  const tc2State = getTcState(data?.tc2);

  return (
    <Card className="bg-card/50 border-border/60">
      <CardHeader>
        <CardTitle>Sensor Readouts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4">
          <SensorDisplay icon={<Gauge className="w-6 h-6" />} label="PT-1 (Fuel Tank)" value={formatValue(data?.pt1)} unit="PSI" />
          <SensorDisplay icon={<Gauge className="w-6 h-6" />} label="PT-2 (Oxidizer Tank)" value={formatValue(data?.pt2)} unit="PSI" />
          <SensorDisplay icon={<Gauge className="w-6 h-6" />} label="PT-3 (Fuel Line)" value={formatValue(data?.pt3)} unit="PSI" />
          <SensorDisplay icon={<Gauge className="w-6 h-6" />} label="PT-4 (Oxidizer Line)" value={formatValue(data?.pt4)} unit="PSI" />
          <SensorDisplay icon={<Waves className="w-6 h-6" />} label="Flow-1 (Fuel)" value={formatValue(data?.flow1, 3)} unit="L/h" />
          <SensorDisplay icon={<Waves className="w-6 h-6" />} label="Flow-2 (Oxidizer)" value={formatValue(data?.flow2, 3)} unit="L/h" />
          <SensorDisplay
            icon={tc1State.isError ? <AlertTriangle className="w-6 h-6" /> : <Thermometer className="w-6 h-6" />}
            label="TC-1 (Chamber)"
            value={tc1State.value}
            unit="K"
            isError={tc1State.isError}
          />
          <SensorDisplay
            icon={tc2State.isError ? <AlertTriangle className="w-6 h-6" /> : <Thermometer className="w-6 h-6" />}
            label="TC-2 (Nozzle)"
            value={tc2State.value}
            unit="K"
            isError={tc2State.isError}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default SensorPanel;
