import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Navbar from './components/layout/Navbar.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import IncidentDetails from './pages/IncidentDetails.jsx';
import Projects from './pages/Projects.jsx';
import Billing from './pages/Billing.jsx';
import Demo from './pages/Demo.jsx';
import Settings from './pages/Settings.jsx';

function MainApp() {
  const { user, isAuthenticated, loading, login } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authView, setAuthView] = useState('landing'); // 'landing' | 'login' | 'register'
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  // Dynamically load the BugReplay SDK script
  useEffect(() => {
    if (!document.getElementById('bugreplay-sdk-script')) {
      const script = document.createElement('script');
      script.id = 'bugreplay-sdk-script';
      script.src = '/bugreplay.js';
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-xs text-zinc-500">
        Initializing BugReplay AI session...
      </div>
    );
  }

  // Unauthenticated Flow
  if (!isAuthenticated) {
    if (authView === 'login') {
      return (
        <Login
          onSwitchToRegister={() => setAuthView('register')}
          onLoggedIn={() => setActiveTab('dashboard')}
        />
      );
    }

    if (authView === 'register') {
      return (
        <Register
          onSwitchToLogin={() => setAuthView('login')}
          onRegistered={() => setActiveTab('dashboard')}
        />
      );
    }

    // Default: Marketing Landing Page
    return (
      <Landing
        onStartFree={() => setAuthView('register')}
        onTryDemo={async () => {
          try {
            await login('demo@bugreplay.dev', 'password123');
            setActiveTab('demo');
          } catch (e) {
            setAuthView('login');
          }
        }}
        onLogin={() => setAuthView('login')}
      />
    );
  }

  // Authenticated App Flow
  const handleSelectIncident = (id) => {
    setSelectedIncidentId(id);
    setActiveTab('incident-details');
  };

  const handleBackToDashboard = () => {
    setSelectedIncidentId(null);
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col">
      <Navbar activeTab={activeTab} onTabChange={(tab) => {
        setSelectedIncidentId(null);
        setActiveTab(tab);
      }} />

      <main className="flex-1">
        {activeTab === 'dashboard' && (
          <Dashboard
            onSelectIncident={handleSelectIncident}
            onGoToDemo={() => setActiveTab('demo')}
            onGoToProjects={() => setActiveTab('projects')}
          />
        )}

        {activeTab === 'incident-details' && selectedIncidentId && (
          <IncidentDetails
            incidentId={selectedIncidentId}
            onBack={handleBackToDashboard}
          />
        )}

        {activeTab === 'projects' && <Projects />}

        {activeTab === 'billing' && <Billing />}

        {activeTab === 'settings' && (
          <Settings onGoToBilling={() => setActiveTab('billing')} />
        )}

        {activeTab === 'demo' && (
          <Demo
            onOpenIncident={handleSelectIncident}
            onGoToDashboard={handleBackToDashboard}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
