import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { request } from "../services/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ArrowDownCircle, ArrowUpCircle, Plus, Loader2, Edit2, Calendar, ChevronDown, X, Grid, List, CreditCard, Wallet, Trash2, Heart } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCategories } from "../contexts/CategoryContext";
import MonthPicker from "../components/MonthPicker";
import Loader from "../components/Loader";
import CalendarView from "../components/CalendarView";
import toast from "react-hot-toast";

type Transaction = {
  SK: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  categoryId: string;
  subcategoryId?: string;
  description?: string;
  paymentMode?: string;
  timestamp: string;
};

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const { theme } = useTheme();
  const { categories } = useCategories();
  
  // Form State
  const [type, setType] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [editingSK, setEditingSK] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI State
  const [viewTx, setViewTx] = useState<Transaction | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [viewDateTxs, setViewDateTxs] = useState<{date: Date, txs: Transaction[]} | null>(null);

  useEffect(() => {
    setPage(1);
    fetchData();
  }, [month]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const txData = await request(`/transactions?month=${month}`);
      const sortedTx = (txData || []).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTransactions(sortedTx);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) {
      toast.error("Description is mandatory.");
      return;
    }
    if (!amount || !categoryId || !txDate) {
      toast.error("Please fill all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedDate = new Date(txDate);
      const currentTime = new Date();
      selectedDate.setHours(currentTime.getHours(), currentTime.getMinutes(), currentTime.getSeconds());

      const newTx = {
        originalSK: editingSK,
        type,
        amount: Number(amount),
        categoryId,
        subcategoryId,
        description,
        paymentMode,
        timestamp: selectedDate.toISOString(),
      };
      
      await request("/transactions", {
        method: "POST",
        body: JSON.stringify(newTx),
      });
      
      toast.success(editingSK ? "Transaction updated!" : "Transaction added!");
      
      // Clear form
      setAmount("");
      setDescription("");
      setPaymentMode("");
      setSubcategoryId("");
      setCategoryId("");
      setEditingSK(null);
      setTxDate(new Date().toISOString().slice(0, 10));
      
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (tx: Transaction) => {
    setEditingSK(tx.SK);
    setType(tx.type);
    setAmount(tx.amount.toString());
    setCategoryId(tx.categoryId);
    setSubcategoryId(tx.subcategoryId || "");
    setDescription(tx.description || "");
    setPaymentMode(tx.paymentMode || "");
    setTxDate(tx.timestamp.slice(0, 10));
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

  const activeCategories = categories.filter(c => !c.isArchived);
  const selectedCat = categories.find(c => c.SK === `CAT#${categoryId}` || c.name === categoryId); // Fallback to name during migration transition
  
  const debits = transactions.filter(t => t.type === "DEBIT");
  const credits = transactions.filter(t => t.type === "CREDIT");
  const totalDebit = debits.reduce((acc, t) => acc + t.amount, 0);
  const totalCredit = credits.reduce((acc, t) => acc + t.amount, 0);
  const balance = totalCredit - totalDebit;
  
  const hasTransactions = debits.length > 0 || credits.length > 0;
  const healthScore = totalCredit > 0 ? Math.max(0, Math.min(10, Math.round(((totalCredit - totalDebit) / totalCredit) * 10))) : 0;
  const scoreDisplay = hasTransactions ? `${healthScore}/10` : `-`;
  
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Health Score</p>
              <h3 className={`text-3xl font-bold ${scoreColor.split(' ')[0]}`}>{scoreDisplay}</h3>
            </div>
            <div className={`p-4 rounded-full ${scoreColor.split(' ').slice(1).join(' ')}`}>
              <Heart className={scoreColor.split(' ')[0]} size={32} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Add Transaction Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg p-6 transition-colors">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {editingSK ? <Edit2 size={20} className="text-blue-500 dark:text-blue-400" /> : <Plus size={20} className="text-blue-500 dark:text-blue-400" />}
                {editingSK ? "Edit Transaction" : "New Transaction"}
              </h2>
              {editingSK && (
                <button 
                  onClick={() => {
                    setEditingSK(null);
                    setAmount("");
                    setDescription("");
                    setPaymentMode("");
                    setTxDate(new Date().toISOString().slice(0, 10));
                  }}
                  className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6 border border-slate-200 dark:border-slate-700">
              <button 
                onClick={() => setType("DEBIT")} 
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${type === "DEBIT" ? "bg-white dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
              >
                Expense
              </button>
              <button 
                onClick={() => setType("CREDIT")} 
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${type === "CREDIT" ? "bg-white dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
              >
                Income
              </button>
            </div>

            <form onSubmit={handleAddTx} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                  Description <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" value={description} onChange={e => setDescription(e.target.value)} required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder={type === "DEBIT" ? "What did you pay for?" : "How did you get this money?"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                  Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required 
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                  Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input 
                    type="date" value={txDate} onChange={e => setTxDate(e.target.value)} required 
                    className="w-full min-w-0 max-w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-4 pr-10 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Calendar size={20} />
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select 
                    value={categoryId} onChange={e => setCategoryId(e.target.value)} required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-4 pr-10 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select Category</option>
                    {activeCategories.map(c => <option key={c.SK} value={c.SK.replace('CAT#', '')}>{c.icon} {c.name}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>

              {selectedCat && Object.keys(selectedCat.subcategories || {}).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Subcategory</label>
                  <div className="relative">
                    <select 
                      value={subcategoryId} onChange={e => setSubcategoryId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-4 pr-10 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">None</option>
                      {Object.entries(selectedCat.subcategories).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown size={20} />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Payment Mode (Optional)</label>
                <div className="relative">
                  <select 
                    value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-4 pr-10 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">None</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="Cash">Cash</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <CreditCard size={20} />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors shadow-md shadow-blue-500/20 disabled:opacity-70 flex items-center justify-center gap-2">
                {isSubmitting && <Loader2 className="animate-spin w-5 h-5" />}
                {editingSK ? "Update" : "Add"} {type === "DEBIT" ? "Expense" : "Income"}
              </button>
            </form>
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

            {/* Transactions List */}
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
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus size={18} /> Start Adding Expenses
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
                        onClick={() => setViewTx(tx)}
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
                              {new Date(tx.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              {` • ${txCat.name}${txSubCatName ? ` (${txSubCatName})` : ''}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <div className={`font-bold text-base sm:text-lg ${tx.type === 'DEBIT' ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {tx.type === 'DEBIT' ? '-' : '+'}₹{tx.amount.toFixed(2)}
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
                  
                  {transactions.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-50 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
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
              )}
            </div>
          </div>
        </div>
      </main>

      {/* View Transaction Modal */}
      {viewTx && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Transaction Details</h2>
                <button onClick={() => setViewTx(null)} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
                  <X size={24} />
                </button>
              </div>
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
          </div>
        </div>
      )}
      
      {/* Daily Transactions Modal */}
      {viewDateTxs && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Daily Transactions</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  {viewDateTxs.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setViewDateTxs(null)} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
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
          </div>
        </div>
      )}
    </div>
  );
}
