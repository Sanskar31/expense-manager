import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { request } from '../services/api';
import { useAuth } from './AuthContext';

export type Category = {
  PK?: string;
  SK: string;
  name: string;
  icon: string;
  subcategories: Record<string, string>;
  isArchived: boolean;
  isInvestment?: boolean;
};

type CategoryContextType = {
  categories: Category[];
  loading: boolean;
  refreshCategories: () => Promise<void>;
};

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const refreshCategories = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await request('/categories');
      setCategories(data);
    } catch (err) {
      console.error("Failed to fetch categories", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshCategories();
    } else {
      setCategories([]);
      setLoading(false);
    }
  }, [user]);

  return (
    <CategoryContext.Provider value={{ categories, loading, refreshCategories }}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategories must be used within a CategoryProvider');
  }
  return context;
}
