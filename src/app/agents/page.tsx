'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Bot, 
  Shield, 
  AlertTriangle, 
  Activity,
  TrendingUp,
  Users,
  FileSearch,
  Zap,
  RefreshCw,
  Play,
  Pause,
  Settings
} from 'lucide-react'

interface Agent {
  type: string
  totalRuns: number
  successRate: number
  threatsDetected: number
  avgConfidence: number
  status?: 'active' | 'paused' | 'error'
}

interface AgentActivity {
  id: string
  agentType: string
  task: string
  status: string
  timestamp: string
}

export default function AgentsDashboard() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [recentActivity, setRecentActivity] = useState<AgentActivity[]>([])
  const [pendingTasks, setPendingTasks] = useState(0)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchAgentStatus = async () => {
    try {
      const response = await fetch('/api/agents/status')
      if (response.ok) {
        const data = await response.json()
        setAgents(data.agents || [])
        setRecentActivity(data.recentActivity || [])
        setPendingTasks(data.pendingTasks || 0)
      }
    } catch (error) {
      console.error('Failed to fetch agent status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgentStatus()
    
    // Auto-refresh every 10 seconds
    const interval = autoRefresh ? setInterval(fetchAgentStatus, 10000) : null
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'fraud_detection':
        return <Shield className="w-5 h-5" />
      case 'contract_audit':
        return <FileSearch className="w-5 h-5" />
      case 'threat_hunt':
        return <AlertTriangle className="w-5 h-5" />
      case 'compliance':
        return <Users className="w-5 h-5" />
      case 'referral_optimize':
        return <TrendingUp className="w-5 h-5" />
      default:
        return <Bot className="w-5 h-5" />
    }
  }

  const getAgentName = (type: string) => {
    const names: Record<string, string> = {
      fraud_detection: 'Fraud Detector',
      contract_audit: 'Contract Auditor',
      threat_hunt: 'Threat Hunter',
      compliance: 'Compliance Monitor',
      referral_optimize: 'Referral Optimizer'
    }
    return names[type] || type
  }

  const triggerAgent = async (type: string) => {
    try {
      const response = await fetch(`/api/agents/${type}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: true })
      })
      
      if (response.ok) {
        console.log(`Triggered ${type} agent`)
        fetchAgentStatus() // Refresh status
      }
    } catch (error) {
      console.error(`Failed to trigger ${type}:`, error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading agent status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold">AI Agents Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAgentStatus}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Now
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            Monitor and control autonomous AI agents protecting the LYN ecosystem
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Active Agents</span>
              <Activity className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold">{agents.length}</div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Pending Tasks</span>
              <Zap className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold">{pendingTasks}</div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Threats Detected</span>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold">
              {agents.reduce((sum, a) => sum + a.threatsDetected, 0)}
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Avg Success Rate</span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold">
              {agents.length > 0 
                ? Math.round(agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length * 100)
                : 0}%
            </div>
          </Card>
        </div>

        {/* Agent Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {agents.map((agent) => (
            <Card key={agent.type} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getAgentIcon(agent.type)}
                  <h3 className="font-semibold">{getAgentName(agent.type)}</h3>
                </div>
                <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                  {agent.status || 'active'}
                </Badge>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Runs</span>
                  <span className="font-medium">{agent.totalRuns}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-medium">
                    {Math.round(agent.successRate * 100)}%
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Threats Found</span>
                  <span className="font-medium">{agent.threatsDetected}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Confidence</span>
                  <span className="font-medium">
                    {Math.round(agent.avgConfidence * 100)}%
                  </span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerAgent(agent.type)}
                  className="flex-1"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Run
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <Settings className="w-3 h-3 mr-1" />
                  Config
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Agent Activity</h3>
          <div className="space-y-2">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={activity.id || index} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    {getAgentIcon(activity.agentType)}
                    <div>
                      <p className="font-medium text-sm">{getAgentName(activity.agentType)}</p>
                      <p className="text-xs text-muted-foreground">{activity.task}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={activity.status === 'completed' ? 'default' : 'secondary'}>
                      {activity.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No recent activity
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}