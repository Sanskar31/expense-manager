import { useState, useEffect } from "react";
import { request } from "../services/api";
import { Loader2, Users, Receipt, Phone } from "lucide-react";
import toast from "react-hot-toast";

type UserStats = {
  mobileNumber: string;
  name: string;
  txCount: number;
};

export default function Admin() {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await request("/admin/users");
      // Sort by transaction count descending
      setUsers(data.sort((a: UserStats, b: UserStats) => b.txCount - a.txCount));
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Users className="text-blue-600 dark:text-blue-400" size={32} />
          Admin Panel
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          View registered users and their transaction statistics.
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
          <p>Loading user data...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">Name</th>
                  <th className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">Mobile Number</th>
                  <th className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300 text-right">Transactions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.mobileNumber} className="hover:bg-slate-50 dark:hover:bg-slate-800/25 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">
                            {user.name ? user.name[0].toUpperCase() : "?"}
                          </div>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{user.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Phone size={16} className="opacity-70" />
                          {user.mobileNumber}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2 text-slate-900 dark:text-slate-100 font-medium">
                          <Receipt size={18} className="text-slate-400" />
                          {user.txCount}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>Total Registered Users: <strong className="text-slate-900 dark:text-white">{users.length}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
