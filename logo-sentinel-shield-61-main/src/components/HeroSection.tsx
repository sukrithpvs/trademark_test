
import React from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';

interface HeroSectionProps {
  onAnalyzeClick: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onAnalyzeClick }) => {
  return (
    <section className="min-h-screen flex items-center justify-center px-6 sm:px-8 lg:px-12 bg-white dark:bg-black">
      <div className="max-w-7xl mx-auto w-full">
        {/* Hero Content */}
        <div className="text-center mb-20 animate-fade-in-up">
          <h1 className="font-poppins text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-bold text-black dark:text-white mb-8 tracking-tight leading-[0.85]">
            LogoGuard
          </h1>
          
          <p className="text-xl sm:text-2xl lg:text-3xl text-gray-600 dark:text-gray-400 mb-12 leading-relaxed font-light max-w-4xl mx-auto">
            Advanced trademark protection powered by machine learning.
            <br />
            <span className="text-gray-500 dark:text-gray-500">Fast. Simple. Scalable.</span>
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
            <button
              onClick={onAnalyzeClick}
              className="group px-12 py-4 bg-black dark:bg-white text-white dark:text-black text-lg font-medium tracking-wide rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-300 hover-scale flex items-center gap-3"
            >
              Get Started
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
            
            <button className="px-12 py-4 border border-gray-300 dark:border-gray-700 text-black dark:text-white text-lg font-medium tracking-wide rounded-full hover:bg-gray-50 dark:hover:bg-gray-950 transition-all duration-300">
              Watch Demo
            </button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm text-gray-500 dark:text-gray-500 font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              No signup required
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Free analysis
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Instant results
            </div>
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 max-w-6xl mx-auto">
          <div className="text-center p-8 rounded-2xl border border-gray-100 dark:border-gray-900 hover:border-gray-200 dark:hover:border-gray-800 transition-all duration-300 hover-lift">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-black dark:bg-white"></div>
            </div>
            <h3 className="text-xl font-medium text-black dark:text-white mb-4 tracking-wide">
              AI-Powered
            </h3>
            <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed">
              Advanced machine learning algorithms detect potential trademark infringements with 95%+ accuracy
            </p>
          </div>
          
          <div className="text-center p-8 rounded-2xl border border-gray-100 dark:border-gray-900 hover:border-gray-200 dark:hover:border-gray-800 transition-all duration-300 hover-lift">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-black dark:bg-white"></div>
            </div>
            <h3 className="text-xl font-medium text-black dark:text-white mb-4 tracking-wide">
              Batch Processing
            </h3>
            <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed">
              Process thousands of logos simultaneously with comprehensive similarity scoring and instant results
            </p>
          </div>
          
          <div className="text-center p-8 rounded-2xl border border-gray-100 dark:border-gray-900 hover:border-gray-200 dark:hover:border-gray-800 transition-all duration-300 hover-lift">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-black dark:bg-white"></div>
            </div>
            <h3 className="text-xl font-medium text-black dark:text-white mb-4 tracking-wide">
              Detailed Reports
            </h3>
            <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed">
              Generate comprehensive analysis reports with visual similarity metrics and legal recommendations
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
