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
    if (response.status === 429) {
      toast.error("Too many requests. Please try again later.", { duration: 5000 });
      throw new Error("Rate limit exceeded");
    }
    if (response.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error("Session expired");
    }

    const err = await response.json().catch(() => ({}));
    const errorMsg = err.message || "Request failed";
    toast.error(errorMsg);
    throw new Error(errorMsg);
  }
  return response.json();
};
