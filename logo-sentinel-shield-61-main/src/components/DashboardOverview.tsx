  import React, { useMemo, useState } from 'react';
  import { TrendingUp, TrendingDown, Clock, Shield, ArrowUpRight, CheckCircle, AlertTriangle, FileText, Eye, Download, Flag, Loader2, RefreshCw } from 'lucide-react';
  import { useNavigate } from 'react-router-dom';
  import InfringementTrendsChart from './InfringementTrendsChart';

  interface DashboardOverviewProps {
    analysisHistory: any[];
    onSelectAnalysis: (analysisId: string) => void;
    exportedReports?: any[];
    onExportToReports?: (exportData: any) => void;
    isLoading?: boolean;
    onRefresh?: () => void;
  }

  const DashboardOverview: React.FC<DashboardOverviewProps> = ({ 
    analysisHistory = [], 
    onSelectAnalysis,
    exportedReports = [],
    onExportToReports,
    isLoading = false,
    onRefresh
  }) => {
    const navigate = useNavigate();
    const [refreshing, setRefreshing] = useState(false);

    const handleViewAllAnalyses = () => {
      navigate('/dashboard'); // This will be handled by the parent to switch to timeline view
    };

    const handleRefresh = async () => {
      if (onRefresh) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    };

    // Memoized calculations for better performance
    const dashboardStats = useMemo(() => {
      const totalAnalyses = analysisHistory.length;
      const totalInfringements = analysisHistory.reduce((sum, analysis) => 
        sum + (analysis.high_risk_found || 0) + (analysis.medium_risk_found || 0), 0
      );
      const highRiskInfringements = analysisHistory.reduce((sum, analysis) => 
        sum + (analysis.high_risk_found || 0), 0
      );
      const latestAnalysis = analysisHistory[0];
      const latestJournal = latestAnalysis ? `Analysis ${latestAnalysis.id.substring(0, 8)}...` : 'No analyses yet';
      const latestProcessedTime = latestAnalysis && latestAnalysis.completed_at ? 
        Math.round((Date.now() - new Date(latestAnalysis.completed_at).getTime()) / (1000 * 60 * 60)) : 0;

      return {
        totalAnalyses,
        totalInfringements,
        highRiskInfringements,
        latestAnalysis,
        latestJournal,
        latestProcessedTime
      };
    }, [analysisHistory]);

    // Generate recent activity based on real data only
    const recentActivities = useMemo(() => {
      const activities = [];
      
      // Add recent analysis activities from real data
      analysisHistory.slice(0, 3).forEach((analysis) => {
        const totalRisks = (analysis.high_risk_found || 0) + (analysis.medium_risk_found || 0);
        activities.push({
          id: `analysis-${analysis.id}`,
          icon: totalRisks > 0 ? AlertTriangle : CheckCircle,
          text: `Analysis completed - ${totalRisks} matches found`,
          time: analysis.completed_at ? new Date(analysis.completed_at).toLocaleString() : 'Recently',
          type: 'analysis',
          riskLevel: totalRisks > 0 ? 'warning' : 'success'
        });
      });

      // Add recent report exports from real data
      exportedReports.slice(0, 2).forEach((report) => {
        activities.push({
          id: `export-${report.id}`,
          icon: Download,
          text: `Exported report: ${report.title}`,
          time: new Date(report.created_at).toLocaleString(),
          type: 'export',
          riskLevel: 'info'
        });
      });

      return activities.slice(0, 5);
    }, [analysisHistory, exportedReports]);

    // Get top infringements from latest analysis (real data only)
    const topInfringements = useMemo(() => {
      if (!dashboardStats.latestAnalysis || !dashboardStats.latestAnalysis.batch_results) {
        return [];
      }
      
      const results = dashboardStats.latestAnalysis.batch_results[0]?.results || [];
      return results
        .filter((item: any) => item.infringement_detected)
        .sort((a: any, b: any) => b.final_similarity - a.final_similarity)
        .slice(0, 3);
    }, [dashboardStats.latestAnalysis]);

    const getRiskBadgeClass = (riskLevel: string) => {
      switch (riskLevel) {
        case 'high':
          return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
        case 'medium':
          return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
        case 'low':
          return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
        default:
          return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      }
    };

    const getActivityIconClass = (riskLevel: string) => {
      switch (riskLevel) {
        case 'warning':
          return 'text-orange-500 dark:text-orange-400';
        case 'success':
          return 'text-green-500 dark:text-green-400';
        case 'info':
          return 'text-blue-500 dark:text-blue-400';
        default:
          return 'text-gray-500 dark:text-gray-400';
      }
    };

    if (isLoading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-4 rounded-lg">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header with Refresh */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-black dark:text-white">Dashboard Overview</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Main Stats Grid - Real data only */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-4 rounded-lg hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Analyses</h3>
              <TrendingUp className="w-4 h-4 text-black dark:text-white" />
            </div>
            <div className="text-2xl font-bold text-black dark:text-white">{dashboardStats.totalAnalyses}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {dashboardStats.totalAnalyses === 0 ? 'No analyses yet' : 'From backend database'}
            </div>
          </div>

          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-4 rounded-lg hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Infringements</h3>
              <Shield className="w-4 h-4 text-black dark:text-white" />
            </div>
            <div className="text-2xl font-bold text-black dark:text-white">{dashboardStats.totalInfringements}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {dashboardStats.totalInfringements === 0 ? 'No infringements detected' : 'All risk levels'}
            </div>
          </div>

          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-4 rounded-lg hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">High Risk</h3>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{dashboardStats.highRiskInfringements}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Immediate attention required
            </div>
          </div>

          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-4 rounded-lg hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Latest Analysis</h3>
              <FileText className="w-4 h-4 text-black dark:text-white" />
            </div>
            <div className="text-lg font-bold text-black dark:text-white truncate" title={dashboardStats.latestJournal}>
              {dashboardStats.latestJournal}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {dashboardStats.latestProcessedTime > 0 ? `${dashboardStats.latestProcessedTime} hours ago` : 'No recent analyses'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Analyses - Real API Data */}
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-black dark:text-white">Recent Analyses</h3>
              <button 
                onClick={handleViewAllAnalyses}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white flex items-center transition-colors"
              >
                View all <ArrowUpRight className="w-3 h-3 ml-1" />
              </button>
            </div>
            
            <div className="space-y-3">
              {analysisHistory.slice(0, 3).map((analysis) => {
                const totalRisks = (analysis.high_risk_found || 0) + (analysis.medium_risk_found || 0);
                return (
                  <div key={analysis.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-black dark:text-white truncate">
                        Analysis {analysis.id.substring(0, 8)}...
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(analysis.created_at).toLocaleDateString()} • {analysis.total_comparisons || 0} comparisons
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <div className="text-right">
                        <div className="text-sm font-bold text-black dark:text-white">
                          {totalRisks}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          matches
                        </div>
                      </div>
                      <button
                        onClick={() => onSelectAnalysis(analysis.id)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="View analysis"
                      >
                        <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {analysisHistory.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No analyses available</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Upload a journal to start analyzing</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Infringements - Real API Data */}
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-black dark:text-white">Top Infringements</h3>
              <div className="text-xs text-gray-500 dark:text-gray-400">Latest Analysis</div>
            </div>
            
            <div className="space-y-3">
              {topInfringements.map((item: any, index: number) => {
                const riskLevel = item.final_similarity >= 70 ? 'high' : item.final_similarity >= 40 ? 'medium' : 'low';
                return (
                  <div key={index} className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-medium text-black dark:text-white truncate flex-1" title={item.logo_name}>
                        {item.logo_name}
                      </h4>
                      <div className="flex items-center space-x-2 ml-2">
                        <span className="text-xs font-bold text-black dark:text-white">
                          {item.final_similarity.toFixed(1)}%
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getRiskBadgeClass(riskLevel)}`}>
                          {riskLevel}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Visual</span>
                        <div className="font-medium text-black dark:text-white">
                          {item.vit_similarity?.toFixed(1) || '0.0'}%
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Text</span>
                        <div className="font-medium text-black dark:text-white">
                          {item.text_similarity?.toFixed(1) || '0.0'}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {topInfringements.length === 0 && (
                <div className="text-center py-8">
                  <Shield className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No infringements found</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Run an analysis to see results</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity and Infringement Trends Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity Section - Real API Data */}
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-black dark:text-white mb-4">Recent Activity</h3>
            
            <div className="space-y-3">
              {recentActivities.length > 0 ? recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <activity.icon className={`w-4 h-4 mt-0.5 ${getActivityIconClass(activity.riskLevel)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-black dark:text-white">{activity.text}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Activity will appear here after running analyses</p>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Infringement Trends Chart */}
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-4 rounded-lg">
            <InfringementTrendsChart 
              analysisHistory={analysisHistory}
              className="w-full h-64"
            />
          </div>
        </div>

        {/* Footer Status */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Backend Connected</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              API: localhost:8000 • Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  export default DashboardOverview;
