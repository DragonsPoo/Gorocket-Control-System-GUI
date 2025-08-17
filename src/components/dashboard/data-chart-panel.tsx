import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { CartesianGrid, XAxis, YAxis, LineChart, Line, ReferenceLine } from 'recharts';
import type { SensorData, AppConfig } from '@shared/types';

interface DataChartPanelProps {
    data: SensorData[];
    appConfig?: AppConfig;
}

const chartConfig = {
    pt1: { label: "PT-1 (Fuel Tank)", color: "hsl(var(--chart-1))" },
    pt2: { label: "PT-2 (Oxi Tank)", color: "hsl(var(--chart-2))" },
    pt3: { label: "PT-3 (Fuel Line)", color: "hsl(var(--chart-3))" },
    pt4: { label: "PT-4 (Oxi Line)", color: "hsl(var(--chart-4))" },
    flow1: { label: "Flow-1 (Fuel)", color: "hsl(var(--chart-1))" },
    flow2: { label: "Flow-2 (Oxi)", color: "hsl(var(--chart-2))" },
    tc1: { label: "TC-1 (Chamber)", color: "hsl(var(--chart-5))" },
    tc2: { label: "TC-2 (Nozzle)", color: "hsl(var(--chart-3))" },
};

const DataChartPanel: React.FC<DataChartPanelProps> = ({ data, appConfig }) => {
    const timeFormatter = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit'});

    const alarm = appConfig?.pressureLimitAlarmPsi;
    const trip = appConfig?.pressureLimitTripPsi;
    const maxObserved = Math.max(0, ...data.map(d => Math.max(d.pt1 ?? 0, d.pt2 ?? 0, d.pt3 ?? 0, d.pt4 ?? 0)));
    const yMax = Math.max(maxObserved, (trip ?? 900) * 1.1);

    return (
        <Card className="bg-card/50 border-border/60">
            <CardHeader>
                <CardTitle>Real-time Data Visualization</CardTitle>
                <CardDescription>Sensor data over the last 100 seconds.</CardDescription>
            </CardHeader>

            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pressure Chart */}
                <div className="lg:col-span-1">

                    <h3 className="font-semibold mb-2 ml-2">Pressure (PSI)</h3>
                    <ChartContainer config={chartConfig} className="h-[200px] w-full">
                        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="timestamp" tickFormatter={timeFormatter} fontSize={12} tickMargin={10} />
                            <YAxis domain={[0, yMax]} fontSize={12} tickMargin={5}/>
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" labelClassName="font-bold" />} />
                            {typeof alarm === 'number' && <ReferenceLine y={alarm} strokeDasharray="3 3" />}
                            {typeof trip === 'number' && <ReferenceLine y={trip} strokeDasharray="3 3" />}
                            <Line type="monotone" dataKey="pt1" stroke={chartConfig.pt1.color} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="pt2" stroke={chartConfig.pt2.color} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="pt3" stroke={chartConfig.pt3.color} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="pt4" stroke={chartConfig.pt4.color} strokeWidth={2} dot={false} />
                            <ChartLegend content={<ChartLegendContent />} />
                        </LineChart>
                    </ChartContainer>
                </div>

                {/* Flow Chart */}

                <div className="lg:col-span-1">
                    <h3 className="font-semibold mb-2 ml-2">Flow (L/h)</h3>
                    <ChartContainer config={chartConfig} className="h-[200px] w-full">

                        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="timestamp" tickFormatter={timeFormatter} fontSize={12} tickMargin={10} />
                            <YAxis domain={[0, 'auto']} fontSize={12} tickMargin={5} />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" labelClassName="font-bold" />} />
                            <Line type="monotone" dataKey="flow1" stroke={chartConfig.flow1.color} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="flow2" stroke={chartConfig.flow2.color} strokeWidth={2} dot={false} />
                            <ChartLegend content={<ChartLegendContent />} />
                        </LineChart>
                    </ChartContainer>
                </div>

                {/* Temperature Chart */}

                <div className="lg:col-span-2">
                    <h3 className="font-semibold mb-2 ml-2">Temperature (K)</h3>
                    <ChartContainer config={chartConfig} className="h-[200px] w-full">

                        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="timestamp" tickFormatter={timeFormatter} fontSize={12} tickMargin={10} />
                            <YAxis domain={[0, 'auto']} fontSize={12} tickMargin={5} />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" labelClassName="font-bold" />} />
                            <Line type="monotone" dataKey="tc1" stroke={chartConfig.tc1.color} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="tc2" stroke={chartConfig.tc2.color} strokeWidth={2} dot={false} />
                            <ChartLegend content={<ChartLegendContent />} />
                        </LineChart>
                    </ChartContainer>
                </div>
            </CardContent>
        </Card>
    );
};

export default DataChartPanel;
