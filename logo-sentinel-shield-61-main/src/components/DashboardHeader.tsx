
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const DashboardHeader: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between px-4 sm:px-8 py-4">
        <div className="flex items-center space-x-8">
          <h1 className="font-poppins text-xl font-bold text-black dark:text-white uppercase">LogoGuard Dashboard</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleTheme}
            className="p-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors rounded-xl"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-white" />
            ) : (
              <Moon className="w-4 h-4 text-black" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
