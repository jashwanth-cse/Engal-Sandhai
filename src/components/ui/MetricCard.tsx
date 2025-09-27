import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, className = '' }) => {
  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 flex items-center space-x-4 ${className}`}>
      <div className="flex-shrink-0">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-600 truncate">{title}</p>
        <p className="text-2xl font-bold text-slate-900 truncate">{value}</p>
      </div>
    </div>
  );
};

export default MetricCard;

