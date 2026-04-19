import React, { useState } from 'react';
import { Activity, Shield, History, Settings, Play, MessageSquare, AlertTriangle, LogOut, ShieldAlert, Terminal } from 'lucide-react';
import { cn } from './lib/utils';
import { PolicyLab } from './features/policy-lab/PolicyLab';
import { OperatorChat } from './features/chat/OperatorChat';
import { Dashboard } from './features/dashboard/Dashboard';
import { BoundaryStress } from './features/stress/BoundaryStress';
import { DecisionReplay } from './features/replay/DecisionReplay';
import { ReviewGate } from './features/review/ReviewGate';
import { OpsMetricsView } from './components/OpsMetricsView';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { isAuthenticated, user, login, logout } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-gray-300 font-sans">
        <div className="w-full max-w-md p-8 bg-[#0d0d12] border border-gray-800/60 rounded-xl shadow-2xl">
          <div className="flex items-center justify-center gap-3 text-blue-400 font-semibold tracking-wide mb-8">
            <Shield className="w-8 h-8" />
            <span className="text-xl">CASA CONTROL</span>
          </div>
          <h2 className="text-center text-gray-400 mb-8">Operator Authentication Required</h2>
          
          <div className="space-y-4">
            <button
              onClick={async () => {
                setIsLoggingIn(true);
                await login('operator');
                setIsLoggingIn(false);
              }}
              disabled={isLoggingIn}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Login as Operator
            </button>
            <button
              onClick={async () => {
                setIsLoggingIn(true);
                await login('admin');
                setIsLoggingIn(false);
              }}
              disabled={isLoggingIn}
              className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Login as Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'review':
        return <ReviewGate />;
      case 'dry-run':
        return <PolicyLab />;
      case 'analysis':
        return <BoundaryStress />;
      case 'history':
        return <DecisionReplay />;
      case 'chat':
        return <OperatorChat />;
      case 'ops':
        return <OpsMetricsView />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500 font-mono text-sm">
            Module [{activeTab}] is currently offline or under construction.
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-gray-300 font-sans selection:bg-blue-500/30 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800/60 bg-[#0d0d12] flex flex-col z-10">
        <div className="p-6 border-b border-gray-800/60">
          <div className="flex items-center gap-3 text-blue-400 font-semibold tracking-wide">
            <Shield className="w-6 h-6" />
            <span>CASA CONTROL</span>
          </div>
          <div className="mt-2 text-xs text-gray-500 font-mono">v2.0.0-rc2 | NODE_ENV: prod</div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'dashboard', icon: Activity, label: 'System Dashboard' },
            { id: 'review', icon: ShieldAlert, label: 'Review Gate' },
            { id: 'dry-run', icon: Play, label: 'Policy Lab' },
            { id: 'analysis', icon: AlertTriangle, label: 'Boundary Stress' },
            { id: 'history', icon: History, label: 'Audit Ledger' },
            { id: 'chat', icon: MessageSquare, label: 'Operator Chat' },
            { id: 'ops', icon: Terminal, label: 'Ops Metrics' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === item.id 
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.05)]" 
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800/60">
          <div className="mb-4 px-4 py-2 bg-gray-900/50 rounded-lg text-xs font-mono text-gray-400">
            <div>User: {user?.email}</div>
            <div>Role: <span className={user?.role === 'admin' ? 'text-red-400' : 'text-blue-400'}>{user?.role}</span></div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800/50 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/10 via-[#0a0a0c] to-[#0a0a0c]">
        <header className="h-16 border-b border-gray-800/60 flex items-center px-8 justify-between bg-[#0d0d12]/50 backdrop-blur-md z-10">
          <h1 className="text-lg font-medium text-gray-100 capitalize tracking-wide">
            {activeTab.replace('-', ' ')}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
              <span className="text-xs font-mono text-emerald-500/80">BACKEND_BRIDGE_ACTIVE</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
