import { useState, useEffect, useMemo } from 'react';
import Navbar from "../components/Navbar";
import { request } from "../services/api";
import Loader from "../components/Loader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { TrendingUp, Flame, Download, Activity, ArrowUpRight, ArrowDownRight, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { useCategories } from "../contexts/CategoryContext";

type Transaction = {
  SK: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  categoryId: string;
  timestamp: string;
  description?: string;
};

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#14b8a6', '#3b82f6', '#8b5cf6', '#d946ef'];

export default function Analysis() {
  const { categories } = useCategories();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const defaultEndDate = new Date().toLocaleDateString('en-CA');

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>(defaultEndDate);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const txData = await request('/transactions') as Transaction[];
      setAllTransactions(txData || []);
      
      if (txData && txData.length > 0) {
        const earliestTx = txData.reduce((earliest, tx) => {
          return tx.timestamp < earliest.timestamp ? tx : earliest;
        });
        const earliestDate = new Date(earliestTx.timestamp);
        const firstDayOfMonth = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1).toLocaleDateString('en-CA');
        
        // Only set if not already set by the user
        setStartDate(prev => prev || firstDayOfMonth);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch analytics data.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setEndDate(defaultEndDate);
    if (allTransactions.length > 0) {
      const earliestTx = allTransactions.reduce((earliest, tx) => {
        return tx.timestamp < earliest.timestamp ? tx : earliest;
      });
      const earliestDate = new Date(earliestTx.timestamp);
      const firstDayOfMonth = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1).toLocaleDateString('en-CA');
      setStartDate(firstDayOfMonth);
    } else {
      setStartDate("");
    }
  };

  const getCategoryName = (catId: string) => {
    return categories.find(c => c.SK === `CAT#${catId}` || c.name === catId)?.name || catId;
  };

  const { transactions, hottestMonth, monthChartData, dailyAverage, yoyData, pieData, lineData } = useMemo(() => {
    if (!allTransactions.length) return { transactions: [], hottestMonth: null, monthChartData: [], dailyAverage: 0, yoyData: null, pieData: [], lineData: [] };

    // Filter by date range
    const filteredTxs = allTransactions.filter(tx => {
      if (startDate && tx.timestamp < startDate) return false;
      if (endDate && tx.timestamp > endDate + 'T23:59:59.999Z') return false;
      return true;
    });

    const debits = filteredTxs.filter(t => t.type === 'DEBIT');
    
    // Daily Average
    let dailyAverage = 0;
    if (debits.length > 0) {
      const totalSpent = debits.reduce((acc, t) => acc + t.amount, 0);
      let days = 1;
      if (startDate && endDate) {
        days = Math.max(1, (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24));
      } else {
        const earliest = new Date(Math.min(...debits.map(t => new Date(t.timestamp).getTime())));
        const latest = new Date(Math.max(...debits.map(t => new Date(t.timestamp).getTime())));
        days = Math.max(1, (latest.getTime() - earliest.getTime()) / (1000 * 3600 * 24));
      }
      dailyAverage = totalSpent / days;
    }

    // Year over Year
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    let currYearSpent = 0;
    let lastYearSpent = 0;
    allTransactions.filter(t => t.type === 'DEBIT').forEach(tx => {
      const y = new Date(tx.timestamp).getFullYear();
      if (y === currentYear) currYearSpent += tx.amount;
      if (y === lastYear) lastYearSpent += tx.amount;
    });
    const yoyData = { currentYear, lastYear, currYearSpent, lastYearSpent };

    // Month & Day totals
    const monthTotals: Record<string, number> = {};
    const dayTotals: Record<string, number> = {};
    const catTotals: Record<string, number> = {};
    const monthCatTotals: Record<string, Record<string, number>> = {};

    debits.forEach(tx => {
      const date = new Date(tx.timestamp);
      const yyyyMm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const yyyyMmDd = tx.timestamp.slice(0, 10);
      const catName = getCategoryName(tx.categoryId);

      monthTotals[yyyyMm] = (monthTotals[yyyyMm] || 0) + tx.amount;
      dayTotals[yyyyMmDd] = (dayTotals[yyyyMmDd] || 0) + tx.amount;
      catTotals[catName] = (catTotals[catName] || 0) + tx.amount;
      
      if (!monthCatTotals[yyyyMm]) monthCatTotals[yyyyMm] = {};
      monthCatTotals[yyyyMm][catName] = (monthCatTotals[yyyyMm][catName] || 0) + tx.amount;
    });

    let hottestMonth = { month: "", amount: 0 };
    Object.entries(monthTotals).forEach(([month, amount]) => {
      if (amount > hottestMonth.amount) hottestMonth = { month, amount };
    });

    let hottestDay = { day: "", amount: 0 };
    Object.entries(dayTotals).forEach(([day, amount]) => {
      if (amount > hottestDay.amount) hottestDay = { day, amount };
    });

    const monthChartData = Object.entries(monthTotals)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({
        month: new Date(month + "-01").toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        spending: amount
      }));

    // Top 5 Categories Pie Chart
    const pieData = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
      
    const topCatNames = pieData.map(p => p.name);

    // Line chart data (Month by Month for top categories)
    const lineData = Object.keys(monthTotals).sort().map(month => {
      const dataPoint: any = { month: new Date(month + "-01").toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) };
      topCatNames.forEach(cat => {
        dataPoint[cat] = monthCatTotals[month]?.[cat] || 0;
      });
      return dataPoint;
    });

    return { 
      transactions: filteredTxs,
      hottestMonth: hottestMonth.amount > 0 ? hottestMonth : null, 
      monthChartData,
      dailyAverage,
      yoyData,
      pieData,
      lineData
    };
  }, [allTransactions, startDate, endDate, categories]);

  const handleExportCSV = () => {
    if (!transactions.length) return;
    const headers = ["Date", "Description", "Category", "Type", "Amount"];
    const csvContent = [
      headers.join(","),
      ...transactions.map(t => [
        new Date(t.timestamp).toLocaleDateString(),
        `"${(t.description || "").replace(/"/g, '""')}"`,
        `"${getCategoryName(t.categoryId)}"`,
        t.type,
        t.amount
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `PocketLog_Export_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="h-[80vh] flex items-center justify-center">
          <Loader text="Analyzing spending patterns..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 sm:pb-8">
      <Navbar />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 mt-4 sm:mt-8 space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="text-blue-600 dark:text-blue-400" />
              Analysis Hub
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Discover your spending patterns and trends.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
              <span className="text-slate-400">to</span>
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={handleReset}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <RotateCcw size={16} /> Reset
              </button>
            )}
            {transactions.length > 0 && (
              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Download size={16} /> Export CSV
              </button>
            )}
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-full mb-5">
              <Activity size={40} className="text-blue-400 dark:text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Not Enough Data Yet</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md text-center">
              You need to log some income or expenses before we can generate meaningful insights and trends for you.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* YoY Card */}
            {yoyData && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm col-span-1 lg:col-span-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Year-over-Year ({yoyData.currentYear} vs {yoyData.lastYear})</p>
                  <div className="flex items-baseline gap-4 mt-2">
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white">₹{yoyData.currYearSpent.toFixed(0)}</h3>
                    <div className="text-sm text-slate-500">vs ₹{yoyData.lastYearSpent.toFixed(0)}</div>
                  </div>
                </div>
                <div className={`p-4 rounded-full flex items-center gap-2 ${yoyData.currYearSpent > yoyData.lastYearSpent ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10'}`}>
                  {yoyData.currYearSpent > yoyData.lastYearSpent ? <ArrowUpRight size={28} /> : <ArrowDownRight size={28} />}
                </div>
              </div>
            )}

            {/* Daily Average */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm col-span-1 lg:col-span-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Daily Average Spending</p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">₹{dailyAverage.toFixed(2)}</h3>
              </div>
              <div className="p-4 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Activity size={28} />
              </div>
            </div>

            {/* Hottest Month Card */}
            <div className="bg-gradient-to-br from-rose-500 to-orange-500 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden group hover:scale-[1.02] transition-transform col-span-1 lg:col-span-2">
              <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Flame size={120} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-rose-100 font-medium mb-4 uppercase tracking-wider text-sm">
                  <Flame size={18} />
                  Hottest Month so far
                </div>
                {hottestMonth ? (
                  <>
                    <h3 className="text-4xl font-black mb-2">
                      {new Date(hottestMonth.month + "-01").toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </h3>
                    <p className="text-2xl font-semibold opacity-90">₹{hottestMonth.amount.toFixed(2)}</p>
                  </>
                ) : (
                  <p>No expenses found.</p>
                )}
              </div>
            </div>

            {/* Top 5 Donut Chart */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 col-span-1 lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Top Categories</h3>
              <div className="h-48 w-full">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => `₹${Number(value).toFixed(2)}`}
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
                  <div className="h-full flex items-center justify-center text-slate-400">No data</div>
                )}
              </div>
            </div>

            {/* Monthly Trend Bar Chart */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 col-span-1 md:col-span-2 lg:col-span-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Total Spending Trend</h3>
              <div className="h-72 w-full">
                {monthChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                      <YAxis width={90} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, 'Spending']}
                      />
                      <Bar dataKey="spending" fill="#3b82f6" radius={[6, 6, 0, 0]} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">Not enough data to show trends.</div>
                )}
              </div>
            </div>

            {/* Category Trend Line Chart */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 col-span-1 md:col-span-2 lg:col-span-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Top Categories Evolution</h3>
              <div className="h-72 w-full">
                {lineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                      <YAxis width={90} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => `₹${Number(value).toFixed(2)}`}
                      />
                      <Legend 
                        verticalAlign="top" 
                        height={48}
                        content={(props: any) => {
                          const { payload } = props;
                          return (
                            <ul className="flex flex-wrap gap-4 justify-center pb-4">
                              {payload.map((entry: any, index: number) => (
                                <li key={`item-${index}`} className="group relative flex items-center justify-center cursor-pointer gap-2">
                                  <div style={{ backgroundColor: entry.color }} className="flex-shrink-0 w-3 h-3 sm:w-4 sm:h-4 rounded-full shadow-sm hover:scale-110 transition-transform"></div>
                                  <span className="hidden sm:block text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                                    {entry.value}
                                  </span>
                                  <div className="sm:hidden absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-700 text-white dark:text-slate-100 text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg border border-slate-700/50 dark:border-slate-600/50">
                                    {entry.value}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          );
                        }}
                      />
                      {pieData.map((cat, idx) => (
                        <Line key={cat.name} type="monotone" dataKey={cat.name} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">Not enough data to show trends.</div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
