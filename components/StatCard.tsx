
import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  highlight?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  highlight
}) => {
  return (
    <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center ${iconColor} mb-2`}>
        {icon}
      </div>
      <p className="text-slate-500 text-xs font-medium mb-0.5">{label}</p>
      <h3 className={`text-2xl font-display font-bold ${highlight ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}
      </h3>
    </div>
  );
};
