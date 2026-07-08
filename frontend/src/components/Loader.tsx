import { Loader2 } from "lucide-react";

interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
}

const Loader = ({ text = "Loading...", fullScreen = false }: LoaderProps) => {
  const content = (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <div className="relative">
        {/* Outer glowing ring */}
        <div className="absolute inset-0 rounded-full blur-md opacity-40 bg-blue-500 animate-pulse"></div>
        {/* Spinning icon */}
        <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin relative z-10" />
      </div>
      <p className="text-lg font-medium text-slate-600 dark:text-slate-300 animate-pulse">
        {text}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-center min-h-[40vh]">
      {content}
    </div>
  );
};

export default Loader;
