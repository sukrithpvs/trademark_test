
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingDown, Calendar, BarChart3 } from 'lucide-react';

interface InfringementTrendsChartProps {
  className?: string;
  analysisHistory?: any[];
}

const InfringementTrendsChart: React.FC<InfringementTrendsChartProps> = ({ 
  className = '',
  analysisHistory = []
}) => {
  // Process dynamic analysis history data
  const trendData = React.useMemo(() => {
    if (!analysisHistory || analysisHistory.length === 0) {
      return [];
    }

    // Sort by date and take last 10 analyses
    const sortedHistory = analysisHistory
      .filter(analysis => analysis.high_risk_found !== undefined)
      .sort((a, b) => new Date(a.created_at || a.date || Date.now()).getTime() - new Date(b.created_at || b.date || Date.now()).getTime())
      .slice(-10);

    return sortedHistory.map((analysis, index) => ({
      journal: `Analysis ${index + 1}`,
      infringements: analysis.high_risk_found || 0,
      date: analysis.created_at || analysis.date || new Date().toISOString(),
      sessionId: analysis.session_id || analysis.id
    }));
  }, [analysisHistory]);

  // Calculate trend metrics from real data
  const totalInfringements = trendData.reduce((sum, item) => sum + item.infringements, 0);
  const avgInfringements = trendData.length > 0 ? Math.round(totalInfringements / trendData.length) : 0;
  const peakInfringements = trendData.length > 0 ? Math.max(...trendData.map(d => d.infringements)) : 0;
  
  // Calculate trend direction
  let trendDirection = 'neutral';
  let trendPercentage = 0;
  
  if (trendData.length >= 2) {
    const lastTwo = trendData.slice(-2);
    if (lastTwo[1].infringements !== lastTwo[0].infringements) {
      trendDirection = lastTwo[1].infringements > lastTwo[0].infringements ? 'up' : 'down';
      trendPercentage = lastTwo[0].infringements > 0 
        ? Math.abs(((lastTwo[1].infringements - lastTwo[0].infringements) / lastTwo[0].infringements) * 100)
        : 100;
    }
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 shadow-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-poppins font-medium text-black dark:text-white">
              {label}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {new Date(data.date).toLocaleDateString('en-US', { 
              weekday: 'short', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm font-poppins font-bold text-black dark:text-white">
              {payload[0].value} infringements
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Show empty state if no data
  if (trendData.length === 0) {
    return (
      <div className={`bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-poppins font-semibold text-black dark:text-white">Infringement Trends</h3>
              <p className="text-sm font-poppins text-gray-500 dark:text-gray-400">Analysis history trends</p>
            </div>
          </div>
        </div>
        
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 font-poppins">
            No analysis history available yet. Run some analyses to see trends here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-poppins font-semibold text-black dark:text-white">Infringement Trends</h3>
            <p className="text-sm font-poppins text-gray-500 dark:text-gray-400">Last {trendData.length} analyses</p>
          </div>
        </div>
        {trendDirection !== 'neutral' && (
          <div className="flex items-center space-x-2">
            <TrendingDown className={`w-5 h-5 ${trendDirection === 'down' ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-sm font-poppins font-medium ${trendDirection === 'down' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trendDirection === 'down' ? '↓' : '↑'} {trendPercentage.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-poppins font-bold text-black dark:text-white">{totalInfringements}</div>
          <div className="text-xs font-poppins text-gray-500 dark:text-gray-400 mt-1">Total</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-poppins font-bold text-black dark:text-white">{avgInfringements}</div>
          <div className="text-xs font-poppins text-gray-500 dark:text-gray-400 mt-1">Average</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-poppins font-bold text-black dark:text-white">{peakInfringements}</div>
          <div className="text-xs font-poppins text-gray-500 dark:text-gray-400 mt-1">Peak</div>
        </div>
      </div>
      
      {/* Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e5e7eb" 
              className="dark:stroke-gray-700" 
            />
            <XAxis 
              dataKey="journal" 
              axisLine={true}
              tickLine={true}
              tick={{ 
                fontSize: 12, 
                fill: '#374151',
                fontFamily: 'Poppins'
              }}
              stroke="#6b7280"
              className="dark:stroke-gray-400"
            />
            <YAxis 
              axisLine={true}
              tickLine={true}
              tick={{ 
                fontSize: 12, 
                fill: '#374151',
                fontFamily: 'Poppins'
              }}
              stroke="#6b7280"
              className="dark:stroke-gray-400"
              domain={[0, 'dataMax + 5']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="infringements" 
              stroke="#ef4444" 
              strokeWidth={3}
              dot={{ 
                fill: '#ef4444', 
                strokeWidth: 2, 
                r: 5,
                stroke: '#ffffff'
              }}
              activeDot={{ 
                r: 7, 
                fill: '#ef4444', 
                stroke: '#ffffff', 
                strokeWidth: 3
              }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 flex items-center justify-between text-xs font-poppins text-gray-500 dark:text-gray-400">
        <span>Showing infringement trends from analysis history</span>
        <span>Updated in real-time</span>
      </div>
    </div>
  );
};

export default InfringementTrendsChart;
