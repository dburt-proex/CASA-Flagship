import React, { useState } from 'react';
import { Activity, Shield, History, Settings, Play, MessageSquare, AlertTriangle } from 'lucide-react';
import { cn } from './lib/utils';
import { PolicyLab } from './features/policy-lab/PolicyLab';
import { OperatorChat } from './features/chat/OperatorChat';
import { Dashboard } from './features/dashboard/Dashboard';
import { BoundaryStress } from './features/stress/BoundaryStress';
import { DecisionReplay } from './features/replay/DecisionReplay';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'dry-run':
        return <PolicyLab />;
      case 'analysis':
        return <BoundaryStress />;
      case 'history':
        return <DecisionReplay />;
      case 'chat':
        return <OperatorChat />;
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
            { id: 'dry-run', icon: Play, label: 'Policy Lab' },
            { id: 'analysis', icon: AlertTriangle, label: 'Boundary Stress' },
            { id: 'history', icon: History, label: 'Decision Replay' },
            { id: 'chat', icon: MessageSquare, label: 'Operator Chat' },
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
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'settings' ? "bg-gray-800/80 text-gray-200" : "text-gray-400 hover:bg-gray-800/50"
            )}
          >
            <Settings className="w-4 h-4" />
            Settings & Admin
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
              <span className="text-xs font-mono text-emerald-500/80">PYTHON_BRIDGE_ACTIVE</span>
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
