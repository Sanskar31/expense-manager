import { useEffect } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
};

export default function Modal({ isOpen, onClose, title, subtitle, children, maxWidth = "max-w-md" }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isOpen]);


  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Scrollable Container */}
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div 
          className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 sm:pt-24"
          onClick={handleBackdropClick}
        >
          
          {/* Modal Panel */}
          <div className={`relative bg-white dark:bg-zinc-900 mt-auto sm:mt-0 rounded-t-3xl sm:rounded-2xl w-full ${maxWidth} shadow-2xl border-t sm:border border-zinc-200 dark:border-zinc-800 flex flex-col text-left animate-fade-in`}>
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{title}</h2>
                {subtitle && <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-300 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              {children}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
