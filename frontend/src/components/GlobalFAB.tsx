import { useState, useEffect } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import Modal from './Modal';
import TransactionForm from './TransactionForm';
import { useAuth } from '../contexts/AuthContext';
import Assistant from '../pages/Assistant';

export default function GlobalFAB() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

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
        onClick={() => setIsAssistantOpen(true)}
        className="fixed bottom-[6.5rem] right-6 sm:bottom-[7.5rem] sm:right-8 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-2xl shadow-blue-600/50 ring-4 ring-blue-500/20 hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.7)] hover:scale-110 active:scale-95 transition-all z-40 group"
        aria-label="Ask AI Assistant"
      >
        <Sparkles size={26} className="text-white" />
      </button>

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

      {/* Near-Fullscreen Assistant Modal */}
      {isAssistantOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAssistantOpen(false);
          }}
        >
          <div className="relative w-full max-w-6xl h-[100dvh] sm:h-[90vh] bg-white dark:bg-zinc-900 rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border-0 sm:border border-zinc-200 dark:border-zinc-800">
            {/* Custom Close Button absolute positioned over Assistant header */}
            <button 
              onClick={() => setIsAssistantOpen(false)}
              className="absolute top-4 right-4 z-50 p-2 bg-zinc-100/80 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full transition-colors backdrop-blur-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <div className="flex-1 h-full w-full [&>div]:h-full [&>div]:border-0 [&>div]:rounded-none [&>div]:shadow-none">
              <Assistant />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
