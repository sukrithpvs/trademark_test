
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';

const chartConfig = {
  high: { label: 'High Risk', color: '#ef4444' },
  medium: { label: 'Medium Risk', color: '#f97316' },
  low: { label: 'Low Risk', color: '#eab308' },
  safe: { label: 'Safe', color: '#22c55e' }
};

interface AnalysisChartProps {
  data: {
    name: string;
    high: number;
    medium: number;
    low: number;
    safe: number;
  }[];
  pieData: {
    name: string;
    value: number;
    color: string;
  }[];
}

const AnalysisChart: React.FC<AnalysisChartProps> = ({ data, pieData }) => {
  return (
    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <h3 className="text-xl font-poppins font-semibold text-black dark:text-white mb-6">Analysis Distribution</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h4 className="text-sm font-poppins font-medium text-gray-500 dark:text-gray-400 mb-4">Risk Levels by Batch</h4>
          <ChartContainer config={chartConfig} className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                <XAxis 
                  dataKey="name" 
                  className="text-xs fill-gray-500 dark:fill-gray-400"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  className="text-xs fill-gray-500 dark:fill-gray-400"
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="high" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} />
                <Bar dataKey="medium" stackId="a" fill="#f97316" />
                <Bar dataKey="low" stackId="a" fill="#eab308" />
                <Bar dataKey="safe" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        <div>
          <h4 className="text-sm font-poppins font-medium text-gray-500 dark:text-gray-400 mb-4">Overall Distribution</h4>
          <ChartContainer config={chartConfig} className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  className="text-xs font-poppins"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
};

export default AnalysisChart;
