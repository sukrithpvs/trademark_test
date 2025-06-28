
import React from 'react';
import { Filter, SortAsc, SortDesc, Search } from 'lucide-react';

interface ResultsFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  riskFilter: string;
  onRiskFilterChange: (filter: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  totalResults: number;
}

const ResultsFilters: React.FC<ResultsFiltersProps> = ({
  searchTerm,
  onSearchChange,
  riskFilter,
  onRiskFilterChange,
  sortBy,
  onSortChange,
  sortOrder,
  onSortOrderChange,
  totalResults
}) => {
  return (
    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by logo name..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black font-poppins text-sm placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={riskFilter}
              onChange={(e) => onRiskFilterChange(e.target.value)}
              className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-black dark:text-white rounded-lg px-3 py-2 text-sm font-poppins focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black"
            >
              <option value="all">All Risk Levels</option>
              <option value="high">High Risk (≥90%)</option>
              <option value="medium">Medium Risk (75-89%)</option>
              <option value="low">Low Risk (&lt;75%)</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-poppins text-gray-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-black dark:text-white rounded-lg px-3 py-2 text-sm font-poppins focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black"
            >
              <option value="similarity">Similarity Score</option>
              <option value="visual">Visual Similarity</option>
              <option value="text">Text Similarity</option>
              <option value="name">Logo Name</option>
            </select>
            <button
              onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-black rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4 text-black dark:text-white" /> : <SortDesc className="w-4 h-4 text-black dark:text-white" />}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <p className="text-sm font-poppins text-gray-500 dark:text-gray-400">
          Showing {totalResults} potential infringement{totalResults !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};

export default ResultsFilters;
