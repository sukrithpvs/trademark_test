import React, { useEffect, useState } from 'react';
import { AnalysisResponse } from '../types/api';
import { Home, Layout, FileText, TrendingUp, Clock, Database, BookOpen } from 'lucide-react';
import { getAnalysisHistory } from '../services/api';

interface DashboardSidebarProps {
  analysisResults: AnalysisResponse | null;
  activeView: 'home' | 'results' | 'reports' | 'timeline' | 'client-database' | 'journal-data';
  onViewChange: (view: 'home' | 'results' | 'reports' | 'timeline' | 'client-database' | 'journal-data') => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ 
  analysisResults, 
  activeView, 
  onViewChange 
}) => {
  const [quickStats, setQuickStats] = useState({
    thisWeek: 0,
    infringements: 0,
    accuracy: 0
  });
  const [loading, setLoading] = useState(true);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);

  // Load real stats from API
  useEffect(() => {
    const loadQuickStats = async () => {
      try {
        setLoading(true);
        console.log('Loading quick stats from backend...');
        const history = await getAnalysisHistory();
        setAnalysisHistory(history);
        
        // Calculate real stats from API data - only high and medium risk
        const thisWeekAnalyses = history.length;
        const totalInfringements = history.reduce((sum, analysis) => {
          // Only count high and medium risk (exclude no-risk)
          return sum + ((analysis.high_risk_found || 0) + (analysis.medium_risk_found || 0));
        }, 0);
        const totalComparisons = history.reduce((sum, analysis) => sum + (analysis.total_comparisons || 0), 0);
        const accuracy = totalComparisons > 0 ? ((totalComparisons - totalInfringements) / totalComparisons * 100) : 0;

        setQuickStats({
          thisWeek: thisWeekAnalyses,
          infringements: totalInfringements,
          accuracy: Math.round(accuracy * 10) / 10
        });

        console.log('Quick stats loaded:', { thisWeekAnalyses, totalInfringements, accuracy });
      } catch (error) {
        console.error('Failed to load quick stats:', error);
        setQuickStats({ thisWeek: 0, infringements: 0, accuracy: 0 });
        setAnalysisHistory([]);
      } finally {
        setLoading(false);
      }
    };

    loadQuickStats();
  }, []);

  const menuItems = [
    { id: 'home', label: 'Home Page', icon: Home },
    { id: 'results', label: 'Analysis Results', icon: Layout },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'client-database', label: 'Client Database', icon: Database },
    { id: 'journal-data', label: 'Journal Data', icon: BookOpen },
  ];

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
      <div className="p-6">
        <nav className="space-y-2 mb-8">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id as any)}
                className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors rounded-xl font-poppins ${
                  isActive
                    ? 'bg-black dark:bg-white text-white dark:text-black'
                    : 'text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-poppins font-semibold text-black dark:text-white mb-4 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Quick Stats
            </h3>
            
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl animate-pulse">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl">
                  <div className="text-xs font-poppins font-medium text-black dark:text-white">Total Analyses</div>
                  <div className="text-lg font-poppins font-bold text-black dark:text-white">{quickStats.thisWeek}</div>
                  <div className="text-xs font-poppins text-gray-500 dark:text-gray-400">
                    {quickStats.thisWeek === 0 ? 'No analyses yet' : 'From backend database'}
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl">
                  <div className="text-xs font-poppins font-medium text-black dark:text-white">Risk Matches</div>
                  <div className="text-lg font-poppins font-bold text-black dark:text-white">{quickStats.infringements}</div>
                  <div className="text-xs font-poppins text-gray-500 dark:text-gray-400">
                    {quickStats.infringements === 0 ? 'No risk matches found' : 'High & medium risk only'}
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl">
                  <div className="text-xs font-poppins font-medium text-black dark:text-white">Accuracy</div>
                  <div className="text-lg font-poppins font-bold text-black dark:text-white">{quickStats.accuracy}%</div>
                  <div className="text-xs font-poppins text-gray-500 dark:text-gray-400">
                    {quickStats.accuracy === 0 ? 'No data available' : 'Analysis accuracy'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
