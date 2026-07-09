import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CategoryProvider } from "./contexts/CategoryContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Analysis from "./pages/Analysis";
import { Toaster, ToastBar, toast } from "react-hot-toast";
import { X } from "lucide-react";
import GlobalFAB from "./components/GlobalFAB";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" />;
};

import PullToRefresh from "./components/PullToRefresh";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CategoryProvider>
          <BrowserRouter>
            <PullToRefresh onRefresh={() => window.location.reload()}>
              <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50 font-sans transition-colors duration-200">
                <Toaster position="top-right">
                  {(t) => (
                    <ToastBar toast={t}>
                      {({ icon, message }) => (
                        <>
                          {icon}
                          {message}
                          {t.type !== 'loading' && (
                            <button
                              onClick={() => toast.dismiss(t.id)}
                              className="ml-2 flex-shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </ToastBar>
                  )}
                </Toaster>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                  <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
                </Routes>
                
                <footer className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Made with ❤️ by <a href="https://www.linkedin.com/in/sanskaragarwal05/" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Sanskar Agarwal</a>
                </footer>
              </div>
            </PullToRefresh>
            <GlobalFAB />
          </BrowserRouter>
        </CategoryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
