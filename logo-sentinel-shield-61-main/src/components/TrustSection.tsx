
import React from 'react';
import { Shield, Zap, Users, Award } from 'lucide-react';

const TrustSection = () => {
  return (
    <section className="py-24 px-6 sm:px-8 lg:px-12 bg-gray-50 dark:bg-gray-950 border-t-2 border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-6 tracking-tight uppercase">
            TRUSTED BY
            <br />
            <span className="text-gray-600 dark:text-gray-400">INDUSTRY LEADERS</span>
          </h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 font-medium max-w-3xl mx-auto">
            Join thousands of companies protecting their brand identity with our AI-powered solution
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          <div className="text-center p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-black dark:bg-white flex items-center justify-center">
              <Shield className="w-8 h-8 text-white dark:text-black" />
            </div>
            <div className="text-3xl font-bold text-black dark:text-white mb-2">10K+</div>
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">BRANDS PROTECTED</div>
          </div>

          <div className="text-center p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-black dark:bg-white flex items-center justify-center">
              <Zap className="w-8 h-8 text-white dark:text-black" />
            </div>
            <div className="text-3xl font-bold text-black dark:text-white mb-2">95%</div>
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">ACCURACY RATE</div>
          </div>

          <div className="text-center p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-black dark:bg-white flex items-center justify-center">
              <Users className="w-8 h-8 text-white dark:text-black" />
            </div>
            <div className="text-3xl font-bold text-black dark:text-white mb-2">500+</div>
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">ACTIVE CLIENTS</div>
          </div>

          <div className="text-center p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-black dark:bg-white flex items-center justify-center">
              <Award className="w-8 h-8 text-white dark:text-black" />
            </div>
            <div className="text-3xl font-bold text-black dark:text-white mb-2">24/7</div>
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">MONITORING</div>
          </div>
        </div>

        {/* Company Logos Placeholder */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-8 items-center opacity-60">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 bg-gray-300 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">
                COMPANY {i}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
