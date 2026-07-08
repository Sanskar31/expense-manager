import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface MonthPickerProps {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
}

export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(parseInt(value.split('-')[0], 10));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const [y, m] = value.split('-');
  const selectedYear = parseInt(y, 10);
  const selectedMonthIndex = parseInt(m, 10) - 1;

  const handleSelect = (monthIndex: number) => {
    const paddedMonth = String(monthIndex + 1).padStart(2, '0');
    onChange(`${currentYear}-${paddedMonth}`);
    setIsOpen(false);
  };

  const formattedValue = new Date(selectedYear, selectedMonthIndex).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
      >
        <Calendar size={18} className="text-blue-500 dark:text-blue-400" />
        <span className="font-medium pr-1">{formattedValue}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-4 transition-all">
          <div className="flex justify-between items-center mb-4 px-1">
            <button onClick={() => setCurrentYear(y => y - 1)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-slate-900 dark:text-white text-lg">{currentYear}</span>
            <button onClick={() => setCurrentYear(y => y + 1)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {months.map((month, index) => {
              const isSelected = selectedYear === currentYear && selectedMonthIndex === index;
              return (
                <button
                  key={month}
                  onClick={() => handleSelect(index)}
                  className={`py-2 rounded-xl text-sm font-medium transition-all transform active:scale-95 ${
                    isSelected 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {month}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
