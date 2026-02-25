import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface MonthSelectorProps {
  currentDate: Date; // A Date object representing the currently selected month
  onChange: (date: Date) => void; // Callback when a new month is selected
}

export function MonthSelector({ currentDate, onChange }: MonthSelectorProps) {
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth());

  useEffect(() => {
    setYear(currentDate.getFullYear());
    setMonth(currentDate.getMonth());
  }, [currentDate]);

  const handlePrevMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    onChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    onChange(newDate);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10);
    onChange(new Date(newYear, month, 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10);
    onChange(new Date(year, newMonth, 1));
  };

  // Generate year options (e.g., from 2020 to current year + 2)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2020 + 3 }, (_, i) => 2020 + i);
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm p-1">
      <button 
        onClick={handlePrevMonth}
        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex items-center gap-1 mx-2">
        <Calendar size={14} className="text-indigo-500 mr-1" />
        <select 
          value={year} 
          onChange={handleYearChange}
          className="bg-transparent text-[13px] font-bold text-slate-700 outline-none cursor-pointer appearance-none hover:text-indigo-600 focus:ring-0"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        
        <select 
          value={month} 
          onChange={handleMonthChange}
          className="bg-transparent text-[13px] font-bold text-slate-700 outline-none cursor-pointer appearance-none hover:text-indigo-600 focus:ring-0 ml-1"
        >
          {months.map(m => (
            <option key={m} value={m}>{m + 1}월</option>
          ))}
        </select>
      </div>

      <button 
        onClick={handleNextMonth}
        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
