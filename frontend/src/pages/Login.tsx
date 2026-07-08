import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { request } from "../services/api";
import { Loader2, Wallet } from "lucide-react";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate mobile number format: + followed by 1-3 digits country code, then exactly 10 digits
    const mobileRegex = /^\+\d{1,3}\d{10}$/;
    if (!mobileRegex.test(mobile)) {
      setError("Please enter a valid mobile number with country code (e.g. +919876543210)");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLogin) {
        const res = await request("/auth/login", {
          method: "POST",
          body: JSON.stringify({ mobileNumber: mobile, password }),
        });
        login(res.user);
        navigate("/");
      } else {
        await request("/auth/register", {
          method: "POST",
          body: JSON.stringify({ mobileNumber: mobile, password, name }),
        });
        login({ mobileNumber: mobile, name });
        navigate("/");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-700 backdrop-blur-sm transition-colors">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-500/30">
            <Wallet className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
          PocketLog
        </h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8 font-medium">
          {isLogin ? "Welcome Back" : "Create Account"}
        </p>
        
        {error && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-500 rounded-lg text-red-600 dark:text-red-200 text-sm text-center">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" placeholder="John Doe" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Mobile Number</label>
            <input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" placeholder="+1234567890" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2">
            {isSubmitting && <Loader2 className="animate-spin w-5 h-5" />}
            {isLogin ? "Sign In" : "Sign Up"}
          </button>
        </form>
        
        <p className="mt-6 text-center text-slate-600 dark:text-slate-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors">
            {isLogin ? "Register here" : "Login here"}
          </button>
        </p>
      </div>
    </div>
  );
}
