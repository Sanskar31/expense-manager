import { useState, useEffect } from "react";
import { List, Grid, Wallet, Search, X } from "lucide-react";
import { useCategories } from "../contexts/CategoryContext";
import CalendarView from "./CalendarView";
import Loader from "./Loader";
import { type Transaction } from "./TransactionForm";
import { TransactionType } from "../types";
import { request } from "../services/api";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [timeMode, setTimeMode] = useState<'month' | 'all'>('month');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    if (timeMode === 'all' && allTransactions.length === 0) {
      const fetchAll = async () => {
        setLoadingAll(true);
        try {
          const data = await request('/transactions');
          const sortedAll = (data || []).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setAllTransactions(sortedAll);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingAll(false);
        }
      };
      fetchAll();
    }
  }, [timeMode]);

  const fuzzyMatch = (pattern: string, str: string) => {
    let patternIdx = 0;
    let strIdx = 0;
    const patternLen = pattern.length;
    const strLen = str.length;
    while (patternIdx < patternLen && strIdx < strLen) {
      if (pattern[patternIdx] === str[strIdx]) {
        patternIdx++;
      }
      strIdx++;
    }
    return patternIdx === patternLen;
  };

  // Reset page when switching mode or searching
  useEffect(() => {
    setPage(1);
  }, [timeMode, searchQuery]);

  const sourceTransactions = timeMode === 'month' ? transactions : allTransactions;
  const filteredTransactions = sourceTransactions.filter(tx => {
    if (!searchQuery.trim()) return true;
    const queryTerms = searchQuery.toLowerCase().trim().split(/\s+/);
    
    const txCat = categories.find(c => c.SK === `CAT#${tx.categoryId}`);
    const catName = txCat?.name?.toLowerCase() || '';
    const subcats = txCat?.subcategories as Record<string, string>;
    const subCatName = (tx.subcategoryId && subcats ? subcats[tx.subcategoryId] : tx.subcategoryId)?.toLowerCase() || '';
    
    const combinedString = `${tx.description || ''} ${tx.amount} ${catName} ${subCatName} ${tx.paymentMode || ''}`.toLowerCase();
    const words = combinedString.split(/[\s\W]+/);
    
    return queryTerms.every(term => {
      // Direct substring match (e.g. "500", "swigg")
      if (combinedString.includes(term)) return true;
      // Fuzzy match per word (e.g. "dnr" matches "dinner")
      return words.some(word => fuzzyMatch(term, word));
    });
  });

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

      {viewMode === 'list' && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-12 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-700/50 dark:hover:bg-slate-700 rounded-full transition-all duration-200 flex items-center justify-center scale-95 hover:scale-100"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/50 self-start sm:self-auto w-full sm:w-auto shadow-inner">
            <button 
              onClick={() => setTimeMode('month')}
              className={`flex-1 sm:flex-none px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${timeMode === 'month' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
            >
              This Month
            </button>
            <button 
              onClick={() => setTimeMode('all')}
              className={`flex-1 sm:flex-none px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${timeMode === 'all' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
            >
              All Time
            </button>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="py-8"><Loader className="min-h-0" text="Loading transactions..." /></div>
      ) : loadingAll && timeMode === 'all' ? (
        <div className="py-8"><Loader className="min-h-0" text="Loading all transactions..." /></div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
            <Wallet size={32} className="text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Transactions Yet</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6 text-sm">
            {searchQuery ? "No transactions match your search." : (timeMode === 'month' ? `You haven't logged any income or expenses for ${new Date(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.` : "You haven't logged any transactions yet.")}
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
          {filteredTransactions.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map(tx => {
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
              {searchQuery ? `Found ${filteredTransactions.length} result${filteredTransactions.length !== 1 ? 's' : ''}` : `Total ${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? 's' : ''} ${timeMode === 'month' ? 'this month' : 'overall'}`}
            </span>
            
            {filteredTransactions.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-50 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Page {page} of {Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)}
                </span>
                <button 
                  onClick={() => setPage(p => Math.min(Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE), p + 1))}
                  disabled={page === Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)}
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
