import { useState } from "react";
import Navbar from "../components/Navbar";
import { request } from "../services/api";
import { Plus, Edit2, Loader2, Archive, Play, X } from "lucide-react";
import toast from "react-hot-toast";
import { useCategories } from "../contexts/CategoryContext";

type Category = {
  PK?: string;
  SK: string;
  name: string;
  icon: string;
  isArchived?: boolean;
  isInvestment?: boolean;
  subcategories: Record<string, string>;
};

export default function Category() {
  const { categories, refreshCategories } = useCategories();
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subcatList, setSubcatList] = useState<string[]>([]);
  const [newSubcatInput, setNewSubcatInput] = useState("");

  const handleEdit = (cat: Category) => {
    setEditingCat(cat);
    setSubcatList(Object.values(cat.subcategories || {}));
    setNewSubcatInput("");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (SK: string, isArchived?: boolean) => {
    const action = isArchived ? "unarchive" : "archive";
    if (!window.confirm(`Are you sure you want to ${action} this category?`)) return;
    try {
      await request(`/categories?SK=${encodeURIComponent(SK)}`, { method: "DELETE" });
      toast.success(`Category ${action}d`);
      refreshCategories();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${action} category`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat) return;
    setIsSubmitting(true);
    
    // Attempt to preserve existing keys for existing names
    const newSubcategories: Record<string, string> = {};
    const existingEntries = Object.entries(editingCat.subcategories || {});
    
    subcatList.forEach(subName => {
      const existingKey = existingEntries.find(([_, v]) => v === subName)?.[0];
      if (existingKey) {
        newSubcategories[existingKey] = subName;
      } else {
        newSubcategories[crypto.randomUUID()] = subName; // Assign new UUID for new subcategory
      }
    });

    try {
      await request("/categories", {
        method: "POST",
        body: JSON.stringify({
          originalSK: editingCat.PK ? editingCat.SK : undefined,
          name: editingCat.name,
          icon: editingCat.icon,
          isArchived: editingCat.isArchived,
          isInvestment: editingCat.isInvestment,
          subcategories: newSubcategories,
        }),
      });
      setEditingCat(null);
      toast.success('Category saved successfully');
      await refreshCategories();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Category Manager</h1>
          <button 
            onClick={() => {
              setEditingCat({ PK: "", SK: "", name: "New Category", icon: "🏷️", subcategories: {}, isArchived: false });
              setSubcatList([]);
              setNewSubcatInput("");
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus size={18} /> Add Category
          </button>
        </div>

        {editingCat && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 mb-8 shadow-xl transition-colors">
            <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
              {editingCat.PK ? "Edit Category" : "New Category"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Category Name</label>
                  <input 
                    type="text" 
                    value={editingCat.name}
                    onChange={e => setEditingCat({...editingCat, name: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Icon (Emoji)</label>
                  <input 
                    type="text" 
                    value={editingCat.icon}
                    onChange={e => setEditingCat({...editingCat, icon: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isInvestment"
                  checked={!!editingCat.isInvestment}
                  onChange={e => setEditingCat({...editingCat, isInvestment: e.target.checked})}
                  className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                />
                <label htmlFor="isInvestment" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  This category represents an Investment
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">Subcategories</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {subcatList.map(sub => (
                    <span key={sub} className="flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-full border border-slate-200 dark:border-slate-700">
                      {sub}
                      <button 
                        type="button" 
                        onClick={() => setSubcatList(subcatList.filter(s => s !== sub))}
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors ml-1"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newSubcatInput}
                    onChange={e => setNewSubcatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newSubcatInput.trim() && !subcatList.includes(newSubcatInput.trim())) {
                          setSubcatList([...subcatList, newSubcatInput.trim()]);
                          setNewSubcatInput("");
                        }
                      }
                    }}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    placeholder="Add a subcategory"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (newSubcatInput.trim() && !subcatList.includes(newSubcatInput.trim())) {
                        setSubcatList([...subcatList, newSubcatInput.trim()]);
                        setNewSubcatInput("");
                      }
                    }}
                    className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors text-white shadow-sm disabled:opacity-70">
                  {isSubmitting && <Loader2 className="animate-spin w-4 h-4" />}
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditingCat(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 rounded-lg font-medium transition-colors text-slate-700 dark:text-slate-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat: Category) => (
              <div key={cat.SK} className={`bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-slate-700 transition-colors group shadow-sm hover:shadow-md ${cat.isArchived ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{cat.name}</h3>
                  </div>
                  <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => handleEdit(cat)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Category"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(cat.SK, cat.isArchived)}
                      className={`p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${cat.isArchived ? 'hover:text-emerald-500 dark:hover:text-emerald-400' : 'hover:text-amber-500 dark:hover:text-amber-400'}`}
                      title={cat.isArchived ? "Unarchive Category" : "Archive Category"}
                    >
                      {cat.isArchived ? <Play size={18} /> : <Archive size={18} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {Object.values(cat.subcategories || {}).map((sub: string) => (
                    <span key={sub} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm rounded-full border border-slate-200 dark:border-slate-700">
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </main>
    </div>
  );
}
