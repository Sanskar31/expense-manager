import { useEffect, useRef } from 'react';
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
  const modalRef = useRef<HTMLDivElement>(null);

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
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Scrollable Container */}
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div 
          className="flex min-h-full items-start justify-center p-4 pt-16 sm:pt-24"
          onClick={handleBackdropClick}
        >
          
          {/* Modal Panel */}
          <div className={`relative bg-white dark:bg-slate-900 rounded-2xl w-full ${maxWidth} shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col text-left`}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
                {subtitle && <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
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
