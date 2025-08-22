'use client'
import { useState, useEffect } from 'react'
import { Zap, Plus, Play, Pause, Settings, Trash2, Clock, CheckCircle, AlertCircle, RefreshCw, PlayCircle, History } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Task {
  _id?: string
  id?: string
  userId?: string
  name: string
  description: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  type: 'security-scan' | 'wallet-monitor' | 'price-alert' | 'auto-trade' | 'threat-hunter' | 'portfolio-tracker' | 'smart-contract-audit' | 'defi-monitor' | 'nft-tracker' | 'governance-monitor'
  frequency: string
  lastRun?: Date | string
  nextRun?: Date | string | null
  successRate: number
  executionCount?: number
  successCount?: number
  failureCount?: number
  lastResult?: {
    success: boolean
    message: string
    data?: Record<string, unknown>
    error?: string
  }
  config?: Record<string, unknown>
  createdAt?: Date | string
  updatedAt?: Date | string
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customTask, setCustomTask] = useState({
    name: '',
    description: '',
    type: 'security-scan' as Task['type'],
    frequency: 'Every 24 hours'
  })
  // Holds per-type configuration while creating a custom task
  const [customConfig, setCustomConfig] = useState<Record<string, unknown>>({})
  const [executingTask, setExecutingTask] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState<string | null>(null)
  const [taskHistory, setTaskHistory] = useState<Array<{ id: string; status: string; result?: Record<string, unknown>; executedAt: string; success?: boolean; startTime?: string; duration?: number; error?: string }>>([])
  // Settings modal state for editing an existing task's configuration
  const [settingsTask, setSettingsTask] = useState<Task | null>(null)
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({})

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks', {
        credentials: 'include'
      })
      
      if (response.status === 401) {
        console.error('Authentication required')
        setLoading(false)
        return
      }
      
      const data = await response.json()
      setTasks(data)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
      setLoading(false)
    }
  }


  const [showCreateModal, setShowCreateModal] = useState(false)

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'active':
        return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      case 'paused':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getTypeColor = (type: Task['type']) => {
    switch (type) {
      case 'security-scan':
        return 'text-primary border-primary/30 bg-primary/10'
      case 'wallet-monitor':
        return 'text-secondary border-secondary/30 bg-secondary/10'
      case 'price-alert':
        return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10'
      case 'auto-trade':
        return 'text-green-500 border-green-500/30 bg-green-500/10'
      case 'threat-hunter':
        return 'text-red-500 border-red-500/30 bg-red-500/10'
      case 'portfolio-tracker':
        return 'text-blue-500 border-blue-500/30 bg-blue-500/10'
      case 'smart-contract-audit':
        return 'text-purple-500 border-purple-500/30 bg-purple-500/10'
      case 'defi-monitor':
        return 'text-cyan-500 border-cyan-500/30 bg-cyan-500/10'
      case 'nft-tracker':
        return 'text-pink-500 border-pink-500/30 bg-pink-500/10'
      case 'governance-monitor':
        return 'text-orange-500 border-orange-500/30 bg-orange-500/10'
      default:
        return 'text-muted-foreground border-border/30 bg-muted/10'
    }
  }

  const toggleTaskStatus = async (taskId: string) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'toggle', id: taskId })
      })
      
      if (response.ok) {
        const updatedTask = await response.json()
        setTasks(tasks.map(task => (task._id || task.id) === taskId ? updatedTask : task))
      }
    } catch (error) {
      console.error('Failed to toggle task:', error)
    }
  }

  const deleteTask = async (taskId: string) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'delete', id: taskId })
      })
      
      if (response.ok) {
        setTasks(tasks.filter(task => (task._id || task.id) !== taskId))
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }
  
  const executeTask = async (taskId: string) => {
    setExecutingTask(taskId)
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'execute', id: taskId })
      })
      
      if (response.ok) {
        const result = await response.json()
        // Refresh tasks to show updated execution info
        fetchTasks()
        
        // Show success/failure feedback
        if (result.execution?.success) {
          console.log('Task executed successfully:', result)
        } else {
          console.error('Task execution failed:', result)
        }
      }
    } catch (error) {
      console.error('Failed to execute task:', error)
    } finally {
      setExecutingTask(null)
    }
  }
  
  const fetchTaskHistory = async (taskId: string) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'history', id: taskId, limit: 10 })
      })
      
      if (response.ok) {
        const data = await response.json()
        setTaskHistory(data.history || [])
        setShowHistory(taskId)
      }
    } catch (error) {
      console.error('Failed to fetch task history:', error)
    }
  }

  const createTask = async (taskData: { name: string; description: string; type: string; frequency: string; config?: Record<string, unknown>; executeNow?: boolean }) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'create', ...taskData })
      })
      
      if (response.ok) {
        const newTask = await response.json()
        setTasks([...tasks, newTask])
        setShowCreateModal(false)
        setShowCustomForm(false)
      }
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'update', id: taskId, updates })
      })
      if (response.ok) {
        const updated = await response.json()
        setTasks(tasks.map(t => (t._id || t.id) === taskId ? updated : t))
        return updated as Task
      }
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Continuous'
    const d = new Date(date)
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    
    if (diff < 0) {
      const ago = Math.abs(diff)
      if (ago < 60000) return 'Just now'
      if (ago < 3600000) return `${Math.floor(ago / 60000)} minutes ago`
      if (ago < 86400000) return `${Math.floor(ago / 3600000)} hours ago`
      return `${Math.floor(ago / 86400000)} days ago`
    } else {
      if (diff < 60000) return 'In a moment'
      if (diff < 3600000) return `In ${Math.floor(diff / 60000)} minutes`
      if (diff < 86400000) return `In ${Math.floor(diff / 3600000)} hours`
      return `In ${Math.floor(diff / 86400000)} days`
    }
  }

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Automated Tasks</h1>
            <p className="text-sm text-muted-foreground">Manage your AI agent&apos;s automated workflows</p>
          </div>
        </div>
        <Button 
          className="bg-primary hover:bg-primary/90"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Active Tasks</p>
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <Play className="w-4 h-4 text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'active').length}</p>
          <p className="text-xs text-muted-foreground mt-1">Running continuously</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold">
            {tasks.length > 0 ? 
              (tasks.reduce((sum, task) => sum + (task.successRate || 100), 0) / tasks.length).toFixed(1) : 
              '100.0'
            }%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Average across all tasks</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Executions</p>
            <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-secondary" />
            </div>
          </div>
          <p className="text-2xl font-bold">
            {tasks.reduce((sum, task) => sum + (task.executionCount || 0), 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">All time</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Alerts Generated</p>
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-bold">
            {tasks.reduce((sum, task) => {
              const alerts = task.lastResult?.data?.alerts as string[] || []
              return sum + alerts.length
            }, 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Recent alerts</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Tasks</h2>
        
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No tasks created yet. Click &quot;Create Task&quot; to get started.
          </div>
        ) : (
          tasks.map((task) => (
          <div key={task._id || task.id} className="glass-card p-6 rounded-xl border border-border/50 hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {getStatusIcon(task.status)}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{task.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-md border ${getTypeColor(task.type)}`}>
                      {task.type.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                  
                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{task.frequency}</span>
                    </div>
                    <div>Last run: {formatDate(task.lastRun || null)}</div>
                    <div>Next run: {formatDate(task.nextRun || null)}</div>
                                      <div className="flex items-center gap-1">
                    <div className="w-20 h-1 bg-border rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-secondary"
                        style={{ width: `${task.successRate}%` }}
                      />
                    </div>
                    <span>{task.successRate.toFixed(1)}%</span>
                  </div>
                  {task.executionCount && (
                    <div className="text-xs text-muted-foreground">
                      {task.executionCount} runs ({task.successCount} success, {task.failureCount} failed)
                    </div>
                  )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => executeTask(task._id || task.id || '')}
                  disabled={executingTask === (task._id || task.id)}
                  className="hover:bg-green-500/10"
                  title="Execute now"
                >
                  {executingTask === (task._id || task.id) ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4 text-green-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleTaskStatus(task._id || task.id || '')}
                  className="hover:bg-primary/10"
                  title={task.status === 'active' ? 'Pause task' : 'Resume task'}
                >
                  {task.status === 'active' ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchTaskHistory(task._id || task.id || '')}
                  className="hover:bg-primary/10"
                  title="View history"
                >
                  <History className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-primary/10"
                  title="Settings"
                  onClick={() => {
                    setSettingsTask(task)
                    // Prime edit config with existing config
                    setEditConfig(task.config || {})
                  }}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTask(task._id || task.id || '')}
                  className="hover:bg-red-500/10 text-red-500"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Last execution result */}
            {task.lastResult && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${
                task.lastResult.success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
              }`}>
                <div className="font-medium mb-1">
                  Last Result: {task.lastResult.success ? 'Success' : 'Failed'}
                </div>
                <div className="text-muted-foreground">
                  {task.lastResult.message}
                </div>
                {(task.lastResult.data?.alerts && Array.isArray(task.lastResult.data.alerts) && task.lastResult.data.alerts.length > 0) ? (
                  <div className="mt-2">
                    Alerts: {(task.lastResult.data.alerts as string[]).join(', ')}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))
        )}
      </div>
      
      {/* Task History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-xl border border-border/50 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Task Execution History</h2>
            {taskHistory.length > 0 ? (
              <div className="space-y-3">
                {taskHistory.map((execution, index) => (
                  <div key={index} className="p-3 rounded-lg bg-sidebar/30 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {execution.success ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="text-sm font-medium">
                          {execution.success ? 'Successful' : 'Failed'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {execution.startTime ? new Date(execution.startTime).toLocaleString() : 'Unknown'}
                      </span>
                    </div>
                    {execution.duration && (
                      <div className="text-xs text-muted-foreground">
                        Duration: {execution.duration}ms
                      </div>
                    )}
                    {execution.error && (
                      <div className="text-xs text-red-500 mt-1">
                        Error: {execution.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No execution history available
              </p>
            )}
            <Button 
              className="w-full mt-6" 
              variant="ghost"
              onClick={() => {
                setShowHistory(null)
                setTaskHistory([])
              }}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {showCustomForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-xl border border-border/50 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Create Custom Task</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Task Name</label>
                <input
                  type="text"
                  value={customTask.name}
                  onChange={(e) => setCustomTask({ ...customTask, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                  placeholder="Enter task name"
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Description</label>
                <textarea
                  value={customTask.description}
                  onChange={(e) => setCustomTask({ ...customTask, description: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary resize-none"
                  placeholder="Describe what this task does"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Task Type</label>
                <select
                  value={customTask.type}
                  onChange={(e) => setCustomTask({ ...customTask, type: e.target.value as Task['type'] })}
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="security-scan">Security Scan</option>
                  <option value="wallet-monitor">Wallet Monitor</option>
                  <option value="price-alert">Price Alert</option>
                  <option value="auto-trade">Auto Trade (Simulated)</option>
                  <option value="threat-hunter">Threat Hunter</option>
                  <option value="portfolio-tracker">Portfolio Tracker</option>
                  <option value="smart-contract-audit">Smart Contract Audit</option>
                  <option value="defi-monitor">DeFi Monitor</option>
                  <option value="nft-tracker">NFT Tracker</option>
                  <option value="governance-monitor">Governance Monitor</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Frequency</label>
                <select
                  value={customTask.frequency}
                  onChange={(e) => setCustomTask({ ...customTask, frequency: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="Real-time">Real-time</option>
                  <option value="Every 5 minutes">Every 5 minutes</option>
                  <option value="Every 30 minutes">Every 30 minutes</option>
                  <option value="Every hour">Every hour</option>
                  <option value="Every 6 hours">Every 6 hours</option>
                  <option value="Every 12 hours">Every 12 hours</option>
                  <option value="Every 24 hours">Every 24 hours</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>

              {/* Conditional configuration for specific task types */}
              {customTask.type === 'price-alert' && (
                <div className="space-y-3 border-t border-border/50 pt-4">
                  <div className="text-sm font-medium">Price Alert Settings</div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Token Mint (Solana)</label>
                    <input
                      type="text"
                      value={(customConfig.tokenMint as string) || ''}
                      onChange={(e) => setCustomConfig({ ...customConfig, tokenMint: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                      placeholder="Token mint address (defaults to env if empty)"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Token Symbol</label>
                    <input
                      type="text"
                      value={(customConfig.tokenSymbol as string) || ''}
                      onChange={(e) => setCustomConfig({ ...customConfig, tokenSymbol: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                      placeholder="e.g., LYN"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Above ($)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={(customConfig as any)?.priceThreshold?.above ?? ''}
                        onChange={(e) => {
                          const above = e.target.value
                          setCustomConfig({
                            ...customConfig,
                            priceThreshold: { ...(customConfig as any).priceThreshold, above: above === '' ? undefined : parseFloat(above) }
                          })
                        }}
                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                        placeholder="Notify when price goes above"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Below ($)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={(customConfig as any)?.priceThreshold?.below ?? ''}
                        onChange={(e) => {
                          const below = e.target.value
                          setCustomConfig({
                            ...customConfig,
                            priceThreshold: { ...(customConfig as any).priceThreshold, below: below === '' ? undefined : parseFloat(below) }
                          })
                        }}
                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                        placeholder="Notify when price goes below"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Change (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={(customConfig as any)?.priceThreshold?.percentChange ?? ''}
                        onChange={(e) => {
                          const pct = e.target.value
                          setCustomConfig({
                            ...customConfig,
                            priceThreshold: { ...(customConfig as any).priceThreshold, percentChange: pct === '' ? undefined : parseFloat(pct) }
                          })
                        }}
                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                        placeholder="Absolute % change vs last run"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button 
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={() => {
                  if (customTask.name && customTask.description) {
                    // Only include non-empty config keys
                    const config: Record<string, unknown> = {}
                    if (customTask.type === 'price-alert') {
                      if ((customConfig.tokenMint as string)?.trim()) config.tokenMint = (customConfig.tokenMint as string).trim()
                      if ((customConfig.tokenSymbol as string)?.trim()) config.tokenSymbol = (customConfig.tokenSymbol as string).trim()
                      const threshold = (customConfig as any).priceThreshold || {}
                      const cleaned: Record<string, number> = {}
                      if (typeof threshold.above === 'number' && !Number.isNaN(threshold.above)) cleaned.above = threshold.above
                      if (typeof threshold.below === 'number' && !Number.isNaN(threshold.below)) cleaned.below = threshold.below
                      if (typeof threshold.percentChange === 'number' && !Number.isNaN(threshold.percentChange)) cleaned.percentChange = threshold.percentChange
                      if (Object.keys(cleaned).length > 0) config.priceThreshold = cleaned
                    }
                    createTask({ ...customTask, config })
                    setShowCustomForm(false)
                    setCustomTask({
                      name: '',
                      description: '',
                      type: 'security-scan',
                      frequency: 'Every 24 hours'
                    })
                    setCustomConfig({})
                  }
                }}
                disabled={!customTask.name || !customTask.description}
              >
                Create Task
              </Button>
              <Button 
                className="flex-1" 
                variant="ghost"
                onClick={() => {
                  setShowCustomForm(false)
                  setCustomTask({
                    name: '',
                    description: '',
                    type: 'security-scan',
                    frequency: 'Every 24 hours'
                  })
                  setCustomConfig({})
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-xl border border-border/50 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Create New Task</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure automated workflows for your AI agent
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <Button 
                  className="w-full justify-start text-left" 
                  variant="outline"
                  onClick={() => createTask({
                    name: 'Security Scan Task',
                    description: 'Automated security scanning of URLs, wallets, and contracts',
                    type: 'security-scan',
                    frequency: 'Every 24 hours'
                  })}
                >
                  <div>
                    <div className="font-medium">🛡️ Security Scan</div>
                    <div className="text-xs text-muted-foreground">Scan URLs, wallets & contracts</div>
                  </div>
                </Button>
                
                <Button 
                  className="w-full justify-start text-left" 
                  variant="outline"
                  onClick={() => createTask({
                    name: 'Threat Hunter',
                    description: 'Actively hunt for new threats across intelligence sources',
                    type: 'threat-hunter',
                    frequency: 'Every hour'
                  })}
                >
                  <div>
                    <div className="font-medium">🔍 Threat Hunter</div>
                    <div className="text-xs text-muted-foreground">Hunt new threats & indicators</div>
                  </div>
                </Button>
                
                <Button 
                  className="w-full justify-start text-left" 
                  variant="outline"
                  onClick={() => createTask({
                    name: 'Portfolio Tracker',
                    description: 'Track portfolio performance and rebalancing opportunities',
                    type: 'portfolio-tracker',
                    frequency: 'Every 30 minutes'
                  })}
                >
                  <div>
                    <div className="font-medium">📊 Portfolio Tracker</div>
                    <div className="text-xs text-muted-foreground">Monitor portfolio performance</div>
                  </div>
                </Button>
                
                <Button 
                  className="w-full justify-start text-left" 
                  variant="outline"
                  onClick={() => createTask({
                    name: 'Smart Contract Auditor',
                    description: 'Continuous audit of smart contracts for vulnerabilities',
                    type: 'smart-contract-audit',
                    frequency: 'Every 6 hours'
                  })}
                >
                  <div>
                    <div className="font-medium">🔐 Contract Auditor</div>
                    <div className="text-xs text-muted-foreground">Audit smart contracts</div>
                  </div>
                </Button>
                
                <Button 
                  className="w-full justify-start text-left" 
                  variant="outline"
                  onClick={() => createTask({
                    name: 'DeFi Monitor',
                    description: 'Monitor DeFi protocols for yield opportunities and risks',
                    type: 'defi-monitor',
                    frequency: 'Every hour'
                  })}
                >
                  <div>
                    <div className="font-medium">🏦 DeFi Monitor</div>
                    <div className="text-xs text-muted-foreground">Track DeFi yields & risks</div>
                  </div>
                </Button>
                
                <Button 
                  className="w-full justify-start text-left" 
                  variant="outline"
                  onClick={() => createTask({
                    name: 'NFT Tracker',
                    description: 'Track NFT collection floor prices and market activity',
                    type: 'nft-tracker',
                    frequency: 'Every 30 minutes'
                  })}
                >
                  <div>
                    <div className="font-medium">🖼️ NFT Tracker</div>
                    <div className="text-xs text-muted-foreground">Monitor NFT collections</div>
                  </div>
                </Button>
                
                <Button 
                  className="w-full justify-start text-left" 
                  variant="outline"
                  onClick={() => {
                    // Open the custom form prefilled for Price Alert so user can enter thresholds
                    setShowCreateModal(false)
                    setShowCustomForm(true)
                    setCustomTask({
                      name: 'Price Alert',
                      description: 'Monitor token price changes and market movements',
                      type: 'price-alert',
                      frequency: 'Every 5 minutes'
                    })
                    setCustomConfig({ priceThreshold: {} })
                  }}
                >
                  <div>
                    <div className="font-medium">💰 Price Alert</div>
                    <div className="text-xs text-muted-foreground">Monitor price changes</div>
                  </div>
                </Button>
                
                <Button 
                  className="w-full justify-start text-left" 
                  variant="outline"
                  onClick={() => createTask({
                    name: 'Governance Monitor',
                    description: 'Track DAO proposals and voting deadlines',
                    type: 'governance-monitor',
                    frequency: 'Every 12 hours'
                  })}
                >
                  <div>
                    <div className="font-medium">🗳️ Governance Monitor</div>
                    <div className="text-xs text-muted-foreground">Track DAO proposals</div>
                  </div>
                </Button>
              </div>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false)
                  setShowCustomForm(true)
                }}
              >
                Custom Task
              </Button>
            </div>
            <Button 
              className="w-full mt-6" 
              variant="ghost"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Settings Modal for editing an existing task */}
      {settingsTask && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-xl border border-border/50 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Edit Task Settings</h2>
            {settingsTask.type === 'price-alert' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Token Mint (Solana)</label>
                  <input
                    type="text"
                    value={(editConfig.tokenMint as string) || ''}
                    onChange={(e) => setEditConfig({ ...editConfig, tokenMint: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Token Symbol</label>
                  <input
                    type="text"
                    value={(editConfig.tokenSymbol as string) || ''}
                    onChange={(e) => setEditConfig({ ...editConfig, tokenSymbol: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Above ($)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={(editConfig as any)?.priceThreshold?.above ?? ''}
                      onChange={(e) => setEditConfig({ ...editConfig, priceThreshold: { ...(editConfig as any).priceThreshold, above: e.target.value === '' ? undefined : parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Below ($)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={(editConfig as any)?.priceThreshold?.below ?? ''}
                      onChange={(e) => setEditConfig({ ...editConfig, priceThreshold: { ...(editConfig as any).priceThreshold, below: e.target.value === '' ? undefined : parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Change (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={(editConfig as any)?.priceThreshold?.percentChange ?? ''}
                      onChange={(e) => setEditConfig({ ...editConfig, priceThreshold: { ...(editConfig as any).priceThreshold, percentChange: e.target.value === '' ? undefined : parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No configurable settings for this task type yet.</div>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={async () => {
                  const id = settingsTask._id || settingsTask.id || ''
                  const cleaned: Record<string, unknown> = { ...editConfig }
                  if ((cleaned as any).priceThreshold) {
                    const pt = (cleaned as any).priceThreshold
                    const pruned: Record<string, number> = {}
                    if (typeof pt.above === 'number' && !Number.isNaN(pt.above)) pruned.above = pt.above
                    if (typeof pt.below === 'number' && !Number.isNaN(pt.below)) pruned.below = pt.below
                    if (typeof pt.percentChange === 'number' && !Number.isNaN(pt.percentChange)) pruned.percentChange = pt.percentChange
                    ;(cleaned as any).priceThreshold = pruned
                  }
                  const updated = await updateTask(id, { config: cleaned })
                  if (updated) {
                    setSettingsTask(null)
                    setEditConfig({})
                  }
                }}
              >
                Save
              </Button>
              <Button
                className="flex-1"
                variant="ghost"
                onClick={() => { setSettingsTask(null); setEditConfig({}) }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}