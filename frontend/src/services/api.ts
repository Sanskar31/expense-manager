import toast from "react-hot-toast";

export const request = async (endpoint: string, options: RequestInit = {}) => {


  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  let response;
  try {
    response = await fetch(`/api${endpoint}`, { 
      ...options, 
      headers,
      credentials: "include",
      signal: controller.signal
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      toast.error("Request timed out. The network might be too slow.");
      throw new Error("Request timed out");
    }
    toast.error("Network error. Please check your internet connection.");
    throw new Error("Network error");
  } finally {
    clearTimeout(timeoutId);
  }
  
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
