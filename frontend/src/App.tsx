import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CategoryProvider } from "./contexts/CategoryContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Analysis from "./pages/Analysis";
import { Toaster } from "react-hot-toast";

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
                <Toaster position="top-right" />
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                  <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
                </Routes>
              </div>
            </PullToRefresh>
          </BrowserRouter>
        </CategoryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
