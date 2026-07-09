import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { request } from "../services/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ArrowDownCircle, ArrowUpCircle, Edit2, Trash2, Heart, Activity } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCategories } from "../contexts/CategoryContext";
import MonthPicker from "../components/MonthPicker";
import Loader from "../components/Loader";
import toast from "react-hot-toast";
import TransactionForm, { type Transaction } from "../components/TransactionForm";
import TransactionList from "../components/TransactionList";
import Modal from "../components/Modal";
import { Info } from "lucide-react";

const getLocalMonthString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [month, setMonth] = useState(getLocalMonthString()); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const { categories } = useCategories();
  
  // UI State
  const [viewTx, setViewTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [viewDateTxs, setViewDateTxs] = useState<{date: Date, txs: Transaction[]} | null>(null);

  useEffect(() => {
    fetchData();
  }, [month]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const txData = await request(`/transactions?month=${month}`);
      setTransactions(txData || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

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

  const debits = transactions.filter(t => t.type === "DEBIT");
  const credits = transactions.filter(t => t.type === "CREDIT");
  const totalDebit = debits.reduce((acc, t) => acc + t.amount, 0);
  const totalCredit = credits.reduce((acc, t) => acc + t.amount, 0);
  const balance = totalCredit - totalDebit;
  
  const hasTransactions = debits.length > 0 || credits.length > 0;
  const healthScore = totalCredit > 0 ? Math.max(0, Math.min(10, Math.round(((totalCredit - totalDebit) / totalCredit) * 10))) : 0;
  const scoreDisplay = hasTransactions ? `${healthScore}/10` : `-`;
  
  const [yearStr, monthStr] = month.split('-');
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === parseInt(yearStr) && (today.getMonth() + 1) === parseInt(monthStr);
  const daysInMonth = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
  const daysToDivideBy = isCurrentMonth ? today.getDate() : daysInMonth;
  const dailyAverage = totalDebit / daysToDivideBy;
  
  let scoreColor = "text-slate-400 bg-slate-100 dark:bg-slate-800";
  if (hasTransactions) {
    scoreColor = "text-rose-500 bg-rose-100 dark:bg-rose-500/10";
    if (healthScore >= 8) scoreColor = "text-emerald-500 bg-emerald-100 dark:bg-emerald-500/10";
    else if (healthScore >= 4) scoreColor = "text-amber-500 bg-amber-100 dark:bg-amber-500/10";
  }

  const categoryTotals = debits.reduce((acc: any, tx) => {
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Income</p>
              <h3 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">₹{totalCredit.toFixed(2)}</h3>
            </div>
            <div className="p-4 bg-emerald-100 dark:bg-emerald-400/10 rounded-full">
              <ArrowUpCircle className="text-emerald-600 dark:text-emerald-400" size={32} />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Expenses</p>
              <h3 className="text-3xl font-bold text-rose-600 dark:text-rose-400">₹{totalDebit.toFixed(2)}</h3>
            </div>
            <div className="p-4 bg-rose-100 dark:bg-rose-400/10 rounded-full">
              <ArrowDownCircle className="text-rose-600 dark:text-rose-400" size={32} />
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 rounded-2xl p-6 shadow-md dark:shadow-xl flex items-center justify-between border border-blue-400/30 dark:border-blue-500/30">
            <div>
              <p className="text-sm font-medium text-blue-100 dark:text-blue-200 mb-1">Monthly Net Balance</p>
              <h3 className="text-3xl font-bold text-white">₹{balance.toFixed(2)}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors col-span-1 md:col-span-2 lg:col-span-1 relative group">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Health Score</p>
                <div className="relative">
                  <Info size={16} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 dark:bg-slate-700 text-white dark:text-slate-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                    Formula: ((Total Income - Total Expenses) / Total Income) * 10. Indicates how much of your income you are saving. A score of 10 means you saved all your income, 0 means you spent all or more.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-700"></div>
                  </div>
                </div>
              </div>
              <h3 className={`text-3xl font-bold ${scoreColor.split(' ')[0]}`}>{scoreDisplay}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Avg Daily Spend: ₹{dailyAverage.toFixed(2)}</p>
            </div>
            <div className={`p-4 rounded-full ${scoreColor.split(' ').slice(1).join(' ')}`}>
              <Heart className={scoreColor.split(' ')[0]} size={32} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1">
            <TransactionForm 
              editingTx={editingTx} 
              onSuccess={() => {
                setEditingTx(null);
                fetchData();
              }} 
              onCancel={() => setEditingTx(null)}
            />
          </div>

          <div className="lg:col-span-2 space-y-8">
            {/* Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg p-6 transition-colors">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Expense Breakdown</h2>
              <div className="h-72 sm:h-80 w-full pb-4 sm:pb-0">
                {loading ? (
                  <div className="h-full flex items-center justify-center"><Loader text="Loading chart..." /></div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => `₹${Number(value).toFixed(2)}`}
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
                        content={(props: any) => {
                          const { payload } = props;
                          return (
                            <ul className="flex flex-col gap-2.5 justify-center pl-2">
                              {payload.map((entry: any, index: number) => (
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
                  <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                    No expense data for this month.
                  </div>
                )}
              </div>
            </div>

            <TransactionList 
              transactions={transactions} 
              loading={loading} 
              month={month} 
              onAddClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
              onTxClick={(tx) => setViewTx(tx)}
              setViewDateTxs={setViewDateTxs}
            />
          </div>
        </div>
      </main>

      <Modal 
        isOpen={viewTx !== null} 
        onClose={() => setViewTx(null)} 
        title="Transaction Details"
      >
        {viewTx && (
          <div>
            <div className="flex flex-col items-center mb-8">
              <div className={`w-20 h-20 rounded-full mb-4 flex items-center justify-center border-4 ${viewTx.type === 'DEBIT' ? 'bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'}`}>
                <span className="text-4xl leading-none">{categories.find(c => c.SK === `CAT#${viewTx.categoryId}`)?.icon || "🏷️"}</span>
              </div>
              <div className={`text-4xl font-bold ${viewTx.type === 'DEBIT' ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {viewTx.type === 'DEBIT' ? '-' : '+'}₹{viewTx.amount.toFixed(2)}
              </div>
              <div className="text-slate-500 dark:text-slate-400 mt-2 text-lg text-center font-medium">{viewTx.description}</div>
            </div>
            
            <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Date & Time</span>
                <span className="font-medium text-slate-900 dark:text-white text-right">
                  {new Date(viewTx.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Category</span>
                <span className="font-medium text-slate-900 dark:text-white text-right">
                  {categories.find(c => c.SK === `CAT#${viewTx.categoryId}`)?.name || viewTx.categoryId}
                </span>
              </div>
              {viewTx.subcategoryId && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Subcategory</span>
                  <span className="font-medium text-slate-900 dark:text-white text-right">
                    {categories.find(c => c.SK === `CAT#${viewTx.categoryId}`)?.subcategories?.[viewTx.subcategoryId] || viewTx.subcategoryId}
                  </span>
                </div>
              )}
              {viewTx.paymentMode && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Payment Mode</span>
                  <span className="font-medium text-slate-900 dark:text-white text-right">{viewTx.paymentMode}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Type</span>
                <span className="font-medium text-slate-900 dark:text-white text-right">{viewTx.type === 'DEBIT' ? 'Expense' : 'Income'}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => {
                  const tx = viewTx;
                  setViewTx(null);
                  handleEditClick(tx);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Edit2 size={18} /> Edit
              </button>
              <button 
                onClick={() => {
                  const tx = viewTx;
                  setViewTx(null);
                  handleDeleteTransaction(tx);
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Trash2 size={18} /> Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Daily Transactions Modal */}
      <Modal
        isOpen={viewDateTxs !== null}
        onClose={() => setViewDateTxs(null)}
        title="Daily Transactions"
        subtitle={viewDateTxs ? viewDateTxs.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : undefined}
        maxWidth="max-w-lg"
      >
        {viewDateTxs && (
          <div>
            {viewDateTxs.txs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">No transactions on this day.</div>
            ) : (
              <div className="space-y-3">
                {viewDateTxs.txs.map(tx => {
                  const txCat = categories.find(c => c.SK === `CAT#${tx.categoryId}`) || { name: tx.categoryId, icon: "🏷️", subcategories: {} as Record<string, string> };
                  const subcats = txCat.subcategories as Record<string, string>;
                  const txSubCatName = tx.subcategoryId && subcats ? subcats[tx.subcategoryId] : tx.subcategoryId;

                  return (
                    <div 
                      key={tx.SK} 
                      onClick={() => {
                        setViewDateTxs(null);
                        setViewTx(tx);
                      }}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-700/50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${tx.type === 'DEBIT' ? 'bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'}`}>
                          <span className="text-xl leading-none">{txCat.icon}</span>
                        </div>
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {tx.description || "No Description"}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                            {new Date(tx.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            {` • ${txCat.name}${txSubCatName ? ` (${txSubCatName})` : ''}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <div className={`font-bold text-base ${tx.type === 'DEBIT' ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {tx.type === 'DEBIT' ? '-' : '+'}₹{tx.amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
