import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, LineChart, Line, ReferenceLine } from 'recharts';
import type { SensorData } from '@/app/page';

interface DataChartPanelProps {
    data: SensorData[];
}

const chartConfig = {
    pt1: { label: "PT-1 (Fuel Tank)", color: "hsl(var(--chart-1))" },
    pt2: { label: "PT-2 (Oxi Tank)", color: "hsl(var(--chart-2))" },
    pt3: { label: "PT-3 (Fuel Line)", color: "hsl(var(--chart-3))" },
    pt4: { label: "PT-4 (Oxi Line)", color: "hsl(var(--chart-4))" },
    flow1: { label: "Flow-1 (Fuel)", color: "hsl(var(--chart-1))" },
    flow2: { label: "Flow-2 (Oxi)", color: "hsl(var(--chart-2))" },
    tc1: { label: "TC-1 (Chamber)", color: "hsl(var(--chart-5))" },
};

const DataChartPanel: React.FC<DataChartPanelProps> = ({ data }) => {
    const timeFormatter = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit'});

    return (
        <Card className="bg-card/50 border-border/60">
            <CardHeader>
                <CardTitle>Real-time Data Visualization</CardTitle>
                <CardDescription>Sensor data over the last 100 seconds.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="xl:col-span-1">
                    <h3 className="font-semibold mb-2 ml-2">Pressure (PSI)</h3>
                    <ChartContainer config={chartConfig} className="h-[200px] lg:h-[220px] w-full">
                        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="timestamp" tickFormatter={timeFormatter} fontSize={12} tickMargin={10} />
                            <YAxis domain={[0, 900]} fontSize={12} tickMargin={5}/>
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" labelClassName="font-bold" />} />
                            <ReferenceLine y={850} label={{ value: 'Pressure Limit', position: 'insideTopLeft', fill: 'hsl(var(--destructive))', fontSize: 12 }} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="pt1" stroke={chartConfig.pt1.color} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="pt2" stroke={chartConfig.pt2.color} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="pt3" stroke={chartConfig.pt3.color} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="pt4" stroke={chartConfig.pt4.color} strokeWidth={2} dot={false} />
                            <ChartLegend content={<ChartLegendContent />} />
                        </LineChart>
                    </ChartContainer>
                </div>
                <div className="xl:col-span-1">
                     <h3 className="font-semibold mb-2 ml-2">Flow (kg/s) & Temp (K)</h3>
                     <ChartContainer config={chartConfig} className="h-[200px] lg:h-[220px] w-full">
                        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="timestamp" tickFormatter={timeFormatter} fontSize={12} tickMargin={10} />
                            <YAxis yAxisId="left" domain={[0, 'auto']} fontSize={12} tickMargin={5} stroke={chartConfig.flow1.color}/>
                            <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} fontSize={12} tickMargin={5} stroke={chartConfig.tc1.color}/>
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" labelClassName="font-bold" />} />
                            <Line yAxisId="left" type="monotone" dataKey="flow1" stroke={chartConfig.flow1.color} strokeWidth={2} dot={false} />
                            <Line yAxisId="left" type="monotone" dataKey="flow2" stroke={chartConfig.flow2.color} strokeWidth={2} dot={false} />
                            <Line yAxisId="right" type="monotone" dataKey="tc1" stroke={chartConfig.tc1.color} strokeDasharray="5 5" strokeWidth={2} dot={false} />
                            <ChartLegend content={<ChartLegendContent />} />
                        </LineChart>
                    </ChartContainer>
                </div>
            </CardContent>
        </Card>
    );
};

export default DataChartPanel;
