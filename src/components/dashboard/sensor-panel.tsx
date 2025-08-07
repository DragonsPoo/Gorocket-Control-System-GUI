import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge, Thermometer, Waves, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { SensorData } from '@/types';
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

  const getTcValue = () => {
    if (data?.tc1 === undefined || data?.tc1 === null) return { value: null, isError: false };
    if (typeof data.tc1 === 'number') {
      return { value: formatValue(data.tc1, 0), isError: false };
    }
    // It's an error string
    return { value: `TC 센서 오류 (${data.tc1})`, isError: true };
  };

  const tcState = getTcValue();

  return (
    <Card className="bg-card/50 border-border/60">
      <CardHeader>
        <CardTitle>Sensor Readouts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <SensorDisplay icon={<Gauge className="w-6 h-6" />} label="PT-1 (Fuel Tank)" value={formatValue(data?.pt1)} unit="PSI" />
          <SensorDisplay icon={<Gauge className="w-6 h-6" />} label="PT-2 (Oxidizer Tank)" value={formatValue(data?.pt2)} unit="PSI" />
          <SensorDisplay icon={<Gauge className="w-6 h-6" />} label="PT-3 (Fuel Line)" value={formatValue(data?.pt3)} unit="PSI" />
          <SensorDisplay icon={<Gauge className="w-6 h-6" />} label="PT-4 (Oxidizer Line)" value={formatValue(data?.pt4)} unit="PSI" />
          <SensorDisplay icon={<Waves className="w-6 h-6" />} label="Flow-1 (Fuel)" value={formatValue(data?.flow1, 3)} unit="kg/s" />
          <SensorDisplay icon={<Waves className="w-6 h-6" />} label="Flow-2 (Oxidizer)" value={formatValue(data?.flow2, 3)} unit="kg/s" />
          <SensorDisplay 
            icon={tcState.isError ? <AlertTriangle className="w-6 h-6" /> : <Thermometer className="w-6 h-6" />}
            label="TC-1 (Chamber)" 
            value={tcState.value} 
            unit="K" 
            isError={tcState.isError} 
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default SensorPanel;
