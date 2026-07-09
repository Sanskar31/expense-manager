import { useState, useEffect } from "react";
import { Loader2, Calendar, ChevronDown, CreditCard, Edit2, Plus, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { request } from "../services/api";
import { useCategories } from "../contexts/CategoryContext";

export type Transaction = {
  SK: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  categoryId: string;
  subcategoryId?: string;
  description?: string;
  paymentMode?: string;
  timestamp: string;
};

const getLocalDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Props = {
  editingTx: Transaction | null;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function TransactionForm({ editingTx, onSuccess, onCancel }: Props) {
  const { categories } = useCategories();
  
  const [type, setType] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [txDate, setTxDate] = useState(getLocalDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingTx) {
      setType(editingTx.type);
      setAmount(editingTx.amount.toString());
      setCategoryId(editingTx.categoryId);
      setSubcategoryId(editingTx.subcategoryId || "");
      setDescription(editingTx.description || "");
      setPaymentMode(editingTx.paymentMode || "");
      setTxDate(editingTx.timestamp.slice(0, 10));
    } else {
      resetForm();
    }
  }, [editingTx]);

  const resetForm = () => {
    setType("DEBIT");
    setAmount("");
    setCategoryId("");
    setSubcategoryId("");
    setDescription("");
    setPaymentMode("");
    setTxDate(getLocalDateString());
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
        originalSK: editingTx?.SK || null,
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
      
      toast.success(editingTx ? "Transaction updated!" : "Transaction added!");
      resetForm();
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCategories = categories.filter(c => !c.isArchived);
  const selectedCat = categories.find(c => c.SK === `CAT#${categoryId}` || c.name === categoryId);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg p-6 transition-colors">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          {editingTx ? <Edit2 size={20} className="text-blue-500 dark:text-blue-400" /> : <Plus size={20} className="text-blue-500 dark:text-blue-400" />}
          {editingTx ? "Edit Transaction" : "New Transaction"}
        </h2>
        {editingTx && (
          <button 
            onClick={() => {
              resetForm();
              onCancel();
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
          type="button"
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${type === "DEBIT" ? "bg-white dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
        >
          Expense
        </button>
        <button 
          onClick={() => setType("CREDIT")} 
          type="button"
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
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1 flex items-center justify-between">
            <span>Category <span className="text-rose-500">*</span></span>
            {type === 'DEBIT' && selectedCat?.isInvestment && (
              <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                <TrendingUp size={12} /> Investment
              </span>
            )}
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
          {editingTx ? "Update" : "Add"} {type === "DEBIT" ? "Expense" : "Income"}
        </button>
      </form>
    </div>
  );
}
