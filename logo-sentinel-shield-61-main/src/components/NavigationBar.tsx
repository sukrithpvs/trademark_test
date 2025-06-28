
import React from 'react';
import { Sun, Moon, Menu } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface NavigationBarProps {
  onTryItOut: () => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({ onTryItOut }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-8 lg:px-12 py-4 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-900">
      <div className="font-poppins font-bold text-xl sm:text-2xl text-black dark:text-white uppercase">
        LogoGuard
      </div>
      
      <div className="flex items-center space-x-8">
        {/* Navigation links */}
        <div className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors duration-300 tracking-wide">
            Features
          </a>
          <a href="#pricing" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors duration-300 tracking-wide">
            Pricing
          </a>
          <a href="#contact" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors duration-300 tracking-wide">
            Contact
          </a>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors duration-300"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-black dark:text-white" />
            ) : (
              <Moon className="w-4 h-4 text-black dark:text-white" />
            )}
          </button>

          <button
            onClick={onTryItOut}
            className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-medium tracking-wide rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-300"
          >
            Try Now
          </button>

          <button className="md:hidden p-2.5 rounded-full hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors duration-300">
            <Menu className="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default NavigationBar;
