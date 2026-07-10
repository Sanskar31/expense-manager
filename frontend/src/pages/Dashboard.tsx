import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { request } from "../services/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ArrowDownCircle, ArrowUpCircle, Edit2, Trash2, Heart, PieChart as PieChartIcon } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCategories } from "../contexts/CategoryContext";
import MonthPicker from "../components/MonthPicker";
import Loader from "../components/Loader";
import toast from "react-hot-toast";
import TransactionForm, { type Transaction } from '../components/TransactionForm';
import { TransactionType } from '../types';
import TransactionList from "../components/TransactionList";
import Modal from "../components/Modal";
import { Info, TrendingUp, Wallet, Loader2 } from "lucide-react";

const getLocalMonthString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [month, setMonth] = useState(getLocalMonthString());
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const { categories } = useCategories();
  
  // UI State
  const [activeTab, setActiveTab] = useState<'SCORE' | 'INCOME' | 'EXPENSE' | 'INVESTMENTS' | 'NET_BALANCE'>('NET_BALANCE');
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [viewTx, setViewTx] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const tabs = ['NET_BALANCE', 'INCOME', 'EXPENSE', 'INVESTMENTS', 'SCORE'] as const;
    const interval = setInterval(() => {
      setActiveTab(current => {
        const currentIndex = tabs.indexOf(current);
        const nextIndex = (currentIndex + 1) % tabs.length;
        return tabs[nextIndex];
      });
    }, 4000); // 4 seconds
    return () => clearInterval(interval);
  }, [isAutoPlaying]);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [viewDateTxs, setViewDateTxs] = useState<{date: Date, txs: Transaction[]} | null>(null);

  useEffect(() => {
    fetchData();
  }, [month]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const txData = await request(`/transactions?month=${month}`);
      const sortedTxs = (txData || []).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTransactions(sortedTxs);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleTxAdded = () => fetchData();
    window.addEventListener('transaction_added', handleTxAdded);
    return () => window.removeEventListener('transaction_added', handleTxAdded);
  }, [month]);

  const handleEditClick = (tx: Transaction) => {
    setEditingTx(tx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    try {
      await request('/transactions', {
        method: 'DELETE',
        body: JSON.stringify({ SK: tx.SK })
      });
      toast.success('Transaction deleted');
      await fetchData();
      if (viewDateTxs) {
        setViewDateTxs(prev => {
          if (!prev) return null;
          return {
            date: prev.date,
            txs: prev.txs.filter(t => t.SK !== tx.SK)
          };
        });
      }
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
  };

  // Calculations
  const isTxInvestment = (tx: Transaction) => {
    const cat = categories.find(c => c.SK === `CAT#${tx.categoryId}` || c.name === tx.categoryId);
    return cat?.isInvestment;
  };

  const debits = transactions.filter(t => t.type === TransactionType.DEBIT);
  const credits = transactions.filter(t => t.type === TransactionType.CREDIT);

  const investmentTxs = debits.filter(isTxInvestment);
  const expenseTxs = debits.filter(t => !isTxInvestment(t));

  const totalCredit = credits.reduce((acc, t) => acc + t.amount, 0);
  const totalInvestment = investmentTxs.reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = expenseTxs.reduce((acc, t) => acc + t.amount, 0);
  const totalDebit = debits.reduce((acc, t) => acc + t.amount, 0); // Raw debit
  
  const balance = totalCredit - totalDebit;
  
  const hasTransactions = debits.length > 0 || credits.length > 0;
  const healthScore = totalCredit > 0 ? Math.max(0, Math.min(10, Math.round(((totalCredit - totalExpense) / totalCredit) * 10))) : 0;
  const scoreDisplay = hasTransactions ? `${healthScore}/10` : `-`;
  
  const [yearStr, monthStr] = month.split('-');
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === parseInt(yearStr) && (today.getMonth() + 1) === parseInt(monthStr);
  const daysInMonth = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
  const daysToDivideBy = isCurrentMonth ? today.getDate() : daysInMonth;
  const dailyAverage = totalExpense / daysToDivideBy;
  
  let scoreColor = "text-slate-400 bg-slate-100 dark:bg-slate-800";
  if (hasTransactions) {
    scoreColor = "text-rose-500 bg-rose-100 dark:bg-rose-500/10";
    if (healthScore >= 8) scoreColor = "text-emerald-500 bg-emerald-100 dark:bg-emerald-500/10";
    else if (healthScore >= 4) scoreColor = "text-amber-500 bg-amber-100 dark:bg-amber-500/10";
  }

  const categoryTotals = expenseTxs.reduce((acc: Record<string, number>, tx) => {
    const catName = categories.find(c => c.SK === `CAT#${tx.categoryId}`)?.name || tx.categoryId;
    acc[catName] = (acc[catName] || 0) + tx.amount;
    return acc;
  }, {});

  const chartData = Object.keys(categoryTotals).map(key => ({
    name: key,
    value: categoryTotals[key]
  }));

  const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header & Month Selector */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg transition-colors">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">📊 Financial Overview</h1>
            <p className="text-slate-500 dark:text-slate-400">Track and manage your expenses</p>
          </div>
          <div className="mt-4 sm:mt-0 z-40">
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Metrics Card & Transaction Form */}
          <div className="lg:col-span-1 flex flex-col gap-8 h-full">
            
            {/* Consolidated Metrics Card */}
            <div 
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg overflow-hidden transition-colors flex flex-1 min-h-[300px]"
              onMouseEnter={() => setIsAutoPlaying(false)}
              onMouseLeave={() => setIsAutoPlaying(true)}
            >
              <div className="flex flex-col border-r border-slate-200 dark:border-slate-800 shrink-0 w-16 items-center py-4 gap-4 bg-slate-50/50 dark:bg-slate-800/20">
                {[
                  { id: 'NET_BALANCE', emoji: '⚖️' },
                  { id: 'INCOME', emoji: '💰' },
                  { id: 'EXPENSE', emoji: '📉' },
                  { id: 'INVESTMENTS', emoji: '📈' },
                  { id: 'SCORE', emoji: '❤️' }
                ].map(tab => (
                  <button 
                    key={tab.id} 
                    onClick={() => setActiveTab(tab.id as any)}
                    title={tab.id.replace('_', ' ')}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${activeTab === tab.id ? 'bg-blue-100 dark:bg-blue-500/20 scale-110 shadow-sm opacity-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800 opacity-50 hover:opacity-100'}`}
                  >
                    {tab.emoji}
                  </button>
                ))}
              </div>
              <div className="p-6 flex-1 flex flex-col justify-center items-center text-center relative group">
                <div key={activeTab + (loading ? '-loading' : '')} className="animate-fade-slide-up w-full flex flex-col items-center">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-40">
                      <div className="relative mb-4">
                        <div className="absolute inset-0 rounded-full blur-md opacity-40 bg-blue-500 animate-pulse"></div>
                        <Loader2 className="animate-spin text-blue-600 dark:text-blue-400 relative z-10" size={40} />
                      </div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">Loading data...</p>
                    </div>
                  ) : (
                    <>
                      {activeTab === 'SCORE' && (
                        <>
                          <p 
                            className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1 justify-center cursor-help relative group/info"
                            onMouseEnter={() => setIsInfoOpen(true)}
                            onMouseLeave={() => setIsInfoOpen(false)}
                            onClick={() => setIsInfoOpen(!isInfoOpen)}
                          >
                            Health Score
                            <Info size={14} />
                            <div className={`absolute top-full mt-2 w-64 p-3 bg-slate-900 dark:bg-slate-700 text-white dark:text-slate-100 text-xs rounded-lg transition-opacity z-50 shadow-lg ${isInfoOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                              Formula: ((Total Income - True Expenses) / Total Income) * 10. Excludes investments.
                            </div>
                          </p>
                          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${scoreColor.split(' ').slice(1).join(' ')} mx-auto`}>
                            <Heart className={scoreColor.split(' ')[0]} size={40} />
                          </div>
                          <h3 className={`text-4xl font-bold ${scoreColor.split(' ')[0]}`}>{scoreDisplay}</h3>
                        </>
                      )}
                      {activeTab === 'INCOME' && (
                        <>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Total Income</p>
                          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 bg-emerald-100 dark:bg-emerald-400/10 mx-auto">
                            <ArrowUpCircle className="text-emerald-600 dark:text-emerald-400" size={40} />
                          </div>
                          <h3 className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">₹{totalCredit.toFixed(2)}</h3>
                        </>
                      )}
                      {activeTab === 'EXPENSE' && (
                        <>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">True Expenses</p>
                          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 bg-rose-100 dark:bg-rose-400/10 mx-auto">
                            <ArrowDownCircle className="text-rose-600 dark:text-rose-400" size={40} />
                          </div>
                          <h3 className="text-4xl font-bold text-rose-600 dark:text-rose-400">₹{totalExpense.toFixed(2)}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">Avg Daily: ₹{dailyAverage.toFixed(2)}</p>
                        </>
                      )}
                      {activeTab === 'INVESTMENTS' && (
                        <>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Total Investments</p>
                          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 bg-blue-100 dark:bg-blue-400/10 mx-auto">
                            <TrendingUp className="text-blue-600 dark:text-blue-400" size={40} />
                          </div>
                          <h3 className="text-4xl font-bold text-blue-600 dark:text-blue-400">₹{totalInvestment.toFixed(2)}</h3>
                        </>
                      )}
                      {activeTab === 'NET_BALANCE' && (
                        <>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Net Balance (Cashflow)</p>
                          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 bg-indigo-100 dark:bg-indigo-400/10 mx-auto">
                            <Wallet className="text-indigo-600 dark:text-indigo-400" size={40} />
                          </div>
                          <h3 className={`text-4xl font-bold ${balance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
                            {balance >= 0 ? '+' : '-'}₹{Math.abs(balance).toFixed(2)}
                          </h3>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <TransactionForm 
              editingTx={editingTx} 
              onSuccess={() => {
                setEditingTx(null);
                fetchData();
              }} 
              onCancel={() => setEditingTx(null)}
            />
          </div>

          {/* Right Column: Chart & Transaction List */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg p-6 transition-colors h-[350px] flex flex-col">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Expense Breakdown</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Excludes investments.</p>
              <div className="flex-1 w-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center"><Loader text="Loading chart..." className="h-full" /></div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: unknown) => `₹${Number(value).toFixed(2)}`}
                        contentStyle={{ 
                          backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                          borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', 
                          borderRadius: '0.5rem', 
                          color: theme === 'dark' ? '#f8fafc' : '#0f172a' 
                        }}
                        itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                      />
                      <Legend 
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        content={(props: { payload?: ReadonlyArray<{ color?: string; value?: number | string; payload?: unknown }> }) => {
                          const { payload } = props;
                          if (!payload) return null;
                          return (
                            <ul className="flex flex-col gap-2.5 justify-center pl-2">
                              {payload.map((entry, index: number) => (
                                <li key={`item-${index}`} className="group relative flex items-center justify-start cursor-pointer gap-2">
                                  <div style={{ backgroundColor: entry.color }} className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full shadow-sm hover:scale-110 transition-transform"></div>
                                  <span className="hidden sm:block text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                                    {entry.value}
                                  </span>
                                  <div className="sm:hidden absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-900 dark:bg-slate-700 text-white dark:text-slate-100 text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg border border-slate-700/50 dark:border-slate-600/50">
                                    {entry.value}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <PieChartIcon size={48} className="mb-2 opacity-50" />
                    <p>No expenses for this month</p>
                  </div>
                )}
              </div>
            </div>

            <TransactionList 
              transactions={transactions} 
              onTxClick={(tx) => setViewTx(tx)}
              setViewDateTxs={setViewDateTxs}
              loading={loading}
              month={month}
              onAddClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          </div>
        </div>
      </main>

      <Modal 
        isOpen={!!viewTx} 
        onClose={() => setViewTx(null)}
        title="Transaction Details"
      >
        {viewTx && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Date</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {new Date(viewTx.timestamp).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Amount</p>
              <p className={`font-bold text-xl ${viewTx.type === 'CREDIT' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {viewTx.type === 'CREDIT' ? '+' : '-'}₹{viewTx.amount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Category</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {categories.find(c => c.SK === `CAT#${viewTx.categoryId}`)?.name || viewTx.categoryId}
              </p>
            </div>
            {viewTx.description && (
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Description</p>
                <p className="text-slate-900 dark:text-white mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  {viewTx.description}
                </p>
              </div>
            )}
            <div className="pt-4 flex gap-3">
              <button
                onClick={() => {
                  handleEditClick(viewTx);
                  setViewTx(null);
                }}
                className="flex-1 flex justify-center items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors font-medium"
              >
                <Edit2 size={16} /> Edit
              </button>
              <button
                onClick={() => {
                  handleDeleteTransaction(viewTx);
                  setViewTx(null);
                }}
                className="flex-1 flex justify-center items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors font-medium"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
      
      <Modal 
        isOpen={!!viewDateTxs} 
        onClose={() => setViewDateTxs(null)}
        title={viewDateTxs ? new Date(viewDateTxs.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ""}
        maxWidth="max-w-2xl"
      >
        {viewDateTxs && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
             {viewDateTxs.txs.map(tx => (
               <div key={tx.SK} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${tx.type === 'CREDIT' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                      {tx.type === 'CREDIT' ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {categories.find(c => c.SK === `CAT#${tx.categoryId}`)?.name || tx.categoryId}
                      </p>
                      {tx.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{tx.description}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${tx.type === 'CREDIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                      {tx.type === 'CREDIT' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                    </p>
                  </div>
               </div>
             ))}
          </div>
        )}
      </Modal>

    </div>
  );
}
