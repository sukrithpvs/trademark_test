
import React from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';

interface CTASectionProps {
  onGetStarted: () => void;
}

const CTASection: React.FC<CTASectionProps> = ({ onGetStarted }) => {
  return (
    <section className="py-32 px-6 sm:px-8 lg:px-12 bg-white dark:bg-black border-t-2 border-gray-200 dark:border-gray-800">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-black dark:text-white mb-8 tracking-tight leading-tight uppercase">
          PROTECT YOUR
          <br />
          <span className="text-gray-600 dark:text-gray-400">BRAND TODAY</span>
        </h2>
        
        <p className="text-xl sm:text-2xl text-gray-700 dark:text-gray-300 mb-12 leading-relaxed font-medium max-w-3xl mx-auto">
          Don't let trademark infringement damage your business.
          <br />
          Start your free analysis in under 60 seconds.
        </p>
        
        {/* CTA Button */}
        <div className="mb-12">
          <button
            onClick={onGetStarted}
            className="group px-16 py-6 bg-black dark:bg-white text-white dark:text-black text-xl font-bold tracking-wider uppercase rounded-2xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-4 mx-auto"
          >
            START FREE ANALYSIS
            <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-2" />
          </button>
        </div>

        {/* Benefits List */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400 font-semibold">
            <CheckCircle className="w-5 h-5" />
            <span className="uppercase tracking-wide">Free to try</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400 font-semibold">
            <CheckCircle className="w-5 h-5" />
            <span className="uppercase tracking-wide">No credit card</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400 font-semibold">
            <CheckCircle className="w-5 h-5" />
            <span className="uppercase tracking-wide">Instant results</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
