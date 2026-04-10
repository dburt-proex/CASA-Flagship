export const api = {
  async post<T>(endpoint: string, payload: any): Promise<T> {
    const res = await fetch(`/api${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `API Error: ${res.statusText}`);
    }
    
    return res.json();
  },

  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`/api${endpoint}`);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `API Error: ${res.statusText}`);
    }
    
    return res.json();
  }
};
