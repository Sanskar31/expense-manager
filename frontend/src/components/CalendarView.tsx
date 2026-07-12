import { useMemo } from 'react';

import { TransactionType } from '../types';

type Transaction = {
  SK: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  subCategory?: string;
  note?: string;
  timestamp: string;
};

interface CalendarViewProps {
  month: string; // "YYYY-MM"
  transactions: Transaction[];
  onDayClick: (date: Date, txs: Transaction[]) => void;
}

export default function CalendarView({ month, transactions, onDayClick }: CalendarViewProps) {
  const { days, blanks, expensesByDate, maxExpense, firstDay } = useMemo(() => {
    const [year, monthNum] = month.split('-').map(Number);
    const firstDay = new Date(year, monthNum - 1, 1);
    const lastDay = new Date(year, monthNum, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const blanks = Array.from({ length: startDayOfWeek }, (_, i) => i);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const expensesByDate: Record<string, { total: number, txs: Transaction[] }> = {};
    let maxExpense = 0;

    transactions.forEach(tx => {
      if (tx.type === TransactionType.DEBIT) {
        // use local date for matching
        const txDate = new Date(tx.timestamp);
        // Only count if it matches the current year and month
        if (txDate.getFullYear() === year && txDate.getMonth() === monthNum - 1) {
          const day = txDate.getDate();
          if (!expensesByDate[day]) {
            expensesByDate[day] = { total: 0, txs: [] };
          }
          expensesByDate[day].total += tx.amount;
          expensesByDate[day].txs.push(tx);
          if (expensesByDate[day].total > maxExpense) {
            maxExpense = expensesByDate[day].total;
          }
        }
      }
    });

    return { days, blanks, expensesByDate, maxExpense, firstDay };
  }, [month, transactions]);

  const getHeatmapClass = (day: number) => {
    if (!expensesByDate[day] || expensesByDate[day].total === 0) {
      return "bg-zinc-50 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300 border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800";
    }

    const ratio = expensesByDate[day].total / maxExpense;

    if (ratio <= 0.2) return "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-100 border-rose-200 dark:border-rose-800/50 hover:bg-rose-200 dark:hover:bg-rose-800/60";
    if (ratio <= 0.4) return "bg-rose-200 dark:bg-rose-800/60 text-rose-800 dark:text-rose-100 border-rose-300 dark:border-rose-700/60 hover:bg-rose-300 dark:hover:bg-rose-700/70";
    if (ratio <= 0.6) return "bg-rose-300 dark:bg-rose-700/80 text-rose-900 dark:text-rose-50 border-rose-400 dark:border-rose-600/70 hover:bg-rose-400 dark:hover:bg-rose-600/80";
    if (ratio <= 0.8) return "bg-rose-400 dark:bg-rose-600 text-rose-950 dark:text-rose-50 border-rose-500 dark:border-rose-500/80 hover:bg-rose-500 dark:hover:bg-rose-500/90";
    return "bg-rose-500 dark:bg-rose-500 text-white dark:text-white border-rose-600 dark:border-rose-400 shadow-sm hover:bg-rose-600 dark:hover:bg-rose-600";
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-2 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {blanks.map(blank => (
          <div key={`blank-${blank}`} className="aspect-square rounded-xl bg-transparent"></div>
        ))}
        {days.map(day => {
          const hasData = expensesByDate[day] !== undefined;
          const total = hasData ? expensesByDate[day].total : 0;
          
          return (
            <div 
              key={day}
              onClick={() => {
                const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
                // Also pass all transactions (income + debit) for this date, not just debits
                const dayTxs = transactions.filter(tx => {
                  const txDate = new Date(tx.timestamp);
                  return txDate.getFullYear() === date.getFullYear() && 
                         txDate.getMonth() === date.getMonth() && 
                         txDate.getDate() === date.getDate();
                });
                onDayClick(date, dayTxs);
              }}
              className={`aspect-square rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${getHeatmapClass(day)}`}
              title={total > 0 ? `₹${total.toFixed(2)} spent` : 'No expenses'}
            >
              <span className="font-semibold text-sm sm:text-base">{day}</span>
              {total > 0 && (
                <span className="text-[10px] sm:text-xs font-medium mt-0.5 sm:mt-1 opacity-90 truncate max-w-full px-1">
                  ₹{total.toFixed(0)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
