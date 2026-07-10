import toast from "react-hot-toast";

export const request = async (endpoint: string, options: RequestInit = {}) => {
  // Temporary local mock for admin panel since backend is not deployed
  if (endpoint === '/admin/users' && import.meta.env.DEV) {
    return [
      { mobileNumber: "+919828376660", name: "Sanskar", txCount: 42 },
      { mobileNumber: "+1234567890", name: "Alice", txCount: 15 },
      { mobileNumber: "+0987654321", name: "Bob", txCount: 3 }
    ];
  }

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
