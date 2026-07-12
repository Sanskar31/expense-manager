import { Wallet } from "lucide-react";

interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

const Loader = ({ text = "Loading...", fullScreen = false, className }: LoaderProps) => {
  const content = (
    <div className="flex flex-col items-center justify-center space-y-6 p-8">
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Outer glowing ring */}
        <div className="absolute inset-0 rounded-full blur-md opacity-30 bg-blue-500 animate-pulse"></div>
        {/* Track ring */}
        <div className="absolute inset-0 rounded-full border-[3px] border-zinc-200 dark:border-zinc-800"></div>
        {/* Spinning gradient ring */}
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-blue-500 dark:border-t-blue-400 animate-spin"></div>
        {/* Center icon */}
        <Wallet className="w-7 h-7 text-blue-600 dark:text-blue-400 animate-pulse relative z-10" />
      </div>
      <p className="text-lg font-medium text-zinc-600 dark:text-zinc-300 tracking-wide animate-pulse">
        {text}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        {content}
      </div>
    );
  }

  return (
    <div className={`w-full flex items-center justify-center ${className || 'min-h-[40vh]'}`}>
      {content}
    </div>
  );
};

export default Loader;
