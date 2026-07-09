import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Modal from './Modal';
import TransactionForm from './TransactionForm';
import { useAuth } from '../contexts/AuthContext';

export default function GlobalFAB() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Keyboard shortcut (optional but nice)
  useEffect(() => {
    const handleKeyDown = () => {
      // Cmd/Ctrl + K or just 'c' outside inputs to open? We can skip this for now.
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!user) return null;

  const handleSuccess = () => {
    setIsOpen(false);
    // Dispatch a custom event that Dashboard/Analysis can listen to
    window.dispatchEvent(new Event('transaction_added'));
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-2xl shadow-blue-600/50 ring-4 ring-blue-500/20 hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.7)] hover:scale-110 active:scale-95 transition-all z-40"
        aria-label="Add Transaction"
      >
        <Plus size={28} />
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="New Transaction">
        <TransactionForm 
          editingTx={null}
          onSuccess={handleSuccess} 
          onCancel={() => setIsOpen(false)} 
        />
      </Modal>
    </>
  );
}
