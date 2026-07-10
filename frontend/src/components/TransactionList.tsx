import { useState } from "react";
import { List, Grid, Wallet } from "lucide-react";
import { useCategories } from "../contexts/CategoryContext";
import CalendarView from "./CalendarView";
import Loader from "./Loader";
import { type Transaction } from "./TransactionForm";
import { TransactionType } from "../types";

type Props = {
  transactions: Transaction[];
  loading: boolean;
  month: string;
  onAddClick: () => void;
  onTxClick: (tx: Transaction) => void;
  setViewDateTxs: (view: {date: Date, txs: Transaction[]} | null) => void;
};

export default function TransactionList({ 
  transactions, 
  loading, 
  month, 
  onAddClick, 
  onTxClick,
  setViewDateTxs
}: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const { categories } = useCategories();

  // Reset page when month changes (handled implicitly by Dashboard, or we can handle it here)
  // Actually, since Dashboard passes new transactions, we should reset page when transactions change or month changes
  // We'll leave it as is, or reset it if `transactions` length changes drastically, but let's keep it simple.

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg p-6 transition-colors">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Transactions</h2>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
            title="List View"
          >
            <List size={18} />
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
            title="Calendar View"
          >
            <Grid size={18} />
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="py-8"><Loader text="Loading transactions..." /></div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
            <Wallet size={32} className="text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Transactions Yet</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6 text-sm">
            You haven't logged any income or expenses for {new Date(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.
          </p>
          <button 
            onClick={onAddClick}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
          >
            Start Adding Expenses
          </button>
        </div>
      ) : viewMode === 'calendar' ? (
        <div className="pt-2">
          <CalendarView 
            month={month} 
            transactions={transactions} 
            onDayClick={(date, txs) => setViewDateTxs({date, txs})} 
          />
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map(tx => {
            const txCat = categories.find(c => c.SK === `CAT#${tx.categoryId}`) || { name: tx.categoryId, icon: "🏷️", subcategories: {} as Record<string, string> };
            const subcats = txCat.subcategories as Record<string, string>;
            const txSubCatName = tx.subcategoryId && subcats ? subcats[tx.subcategoryId] : tx.subcategoryId;

            return (
              <div 
                key={tx.SK} 
                onClick={() => onTxClick(tx)}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-700/50 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${tx.type === TransactionType.DEBIT ? 'bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'}`}>
                    <span className="text-xl leading-none">{txCat.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {tx.description || "No Description"}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                      {new Date(tx.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      {` • ${txCat.name}${txSubCatName ? ` (${txSubCatName})` : ''}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <div className={`font-bold text-base sm:text-lg ${tx.type === TransactionType.DEBIT ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {tx.type === TransactionType.DEBIT ? '-' : '+'}₹{tx.amount.toFixed(2)}
                  </div>
                  {tx.paymentMode && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                      {tx.paymentMode}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg">
              Total {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} this month
            </span>
            
            {transactions.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-50 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Page {page} of {Math.ceil(transactions.length / ITEMS_PER_PAGE)}
                </span>
                <button 
                  onClick={() => setPage(p => Math.min(Math.ceil(transactions.length / ITEMS_PER_PAGE), p + 1))}
                  disabled={page === Math.ceil(transactions.length / ITEMS_PER_PAGE)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-50 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
