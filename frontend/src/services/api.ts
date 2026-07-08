import toast from "react-hot-toast";

export const request = async (endpoint: string, options: RequestInit = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(`/api${endpoint}`, { 
    ...options, 
    headers,
    credentials: "include" 
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const errorMsg = err.message || "Request failed";
    toast.error(errorMsg);
    throw new Error(errorMsg);
  }
  return response.json();
};
