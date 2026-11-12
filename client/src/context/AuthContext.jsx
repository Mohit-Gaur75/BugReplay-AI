import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('bugreplay_token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('bugreplay_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user profile and projects on initial mount or token change
  useEffect(() => {
    if (!token) {
      setUser(null);
      setProjects([]);
      setActiveProject(null);
      setLoading(false);
      return;
    }

    fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Session expired');
        const data = await res.json();
        setUser(data.user);
        setProjects(data.projects || []);
        if (data.projects && data.projects.length > 0) {
          setActiveProject(data.projects[0]);
        }
        localStorage.setItem('bugreplay_user', JSON.stringify(data.user));
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('bugreplay_token', data.token);
    localStorage.setItem('bugreplay_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (email, password) => {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    localStorage.setItem('bugreplay_token', data.token);
    localStorage.setItem('bugreplay_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('bugreplay_token');
    localStorage.removeItem('bugreplay_user');
    setToken('');
    setUser(null);
    setProjects([]);
    setActiveProject(null);
  };

  const updatePlan = async (planTier) => {
    const res = await fetch('/api/v1/projects/plan', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ plan_tier: planTier })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update plan');
    setUser(data.user);
    localStorage.setItem('bugreplay_user', JSON.stringify(data.user));
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        projects,
        activeProject,
        setActiveProject,
        loading,
        login,
        register,
        logout,
        updatePlan
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
