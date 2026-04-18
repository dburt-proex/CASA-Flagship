function handleUnauthorized(): never {
  localStorage.removeItem('casa_token');
  localStorage.removeItem('casa_user');
  window.location.reload();
  // reload() navigates away; this throw keeps the return type as `never`
  throw new Error('Unauthorized — session cleared');
}

export const api = {
  async post<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
    const token = localStorage.getItem('casa_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorized();
      }
      const errorData = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(errorData.error ?? `API Error: ${res.statusText}`);
    }
    
    return res.json() as Promise<T>;
  },

  async get<T>(endpoint: string): Promise<T> {
    const token = localStorage.getItem('casa_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api${endpoint}`, {
      headers
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorized();
      }
      const errorData = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(errorData.error ?? `API Error: ${res.statusText}`);
    }
    
    return res.json() as Promise<T>;
  }
};
