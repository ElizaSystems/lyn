'use client'
import { useState, useRef, useEffect } from 'react'
import { Terminal as TerminalIcon, ChevronRight, Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TerminalPage() {
  const [commands, setCommands] = useState<Array<{ input: string; output: string; timestamp: Date }>>([
    {
      input: 'lyn --version',
      output: 'LYN AI Terminal v1.0.0\nConnected to security network\nReady for commands...',
      timestamp: new Date()
    }
  ])
  const [currentInput, setCurrentInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight)
  }, [commands])

  const processCommand = async (input: string) => {
    try {
      const response = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: input })
      })
      
      const data = await response.json()
      
      if (data.action === 'clear') {
        setCommands([])
        return
      }
      
      setCommands(prev => [...prev, { input, output: data.output || '', timestamp: new Date() }])
      setCommandHistory(prev => [...prev, input])
      setHistoryIndex(-1)
    } catch (error) {
      console.error('Command execution error:', error)
      setCommands(prev => [...prev, { 
        input, 
        output: 'Error: Failed to execute command', 
        timestamp: new Date() 
      }])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentInput.trim()) {
      processCommand(currentInput)
      setCurrentInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setCurrentInput('')
      }
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="h-full p-6">
      <div className="h-full flex flex-col bg-background/50 backdrop-blur-sm rounded-xl border border-border/50">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Terminal</h1>
            <span className="text-xs text-muted-foreground">LYN AI Command Line Interface</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCommands([])}
            className="hover:bg-primary/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>

        <div 
          ref={terminalRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-sm"
          onClick={() => inputRef.current?.focus()}
        >
          {commands.map((cmd, index) => (
            <div key={index} className="mb-4">
              <div className="flex items-center gap-2 text-primary">
                <ChevronRight className="w-4 h-4" />
                <span className="flex-1">{cmd.input}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(cmd.input)}
                  className="opacity-0 hover:opacity-100 transition-opacity"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              {cmd.output && (
                <div className="ml-6 mt-1 text-muted-foreground whitespace-pre-wrap">
                  {cmd.output}
                </div>
              )}
            </div>
          ))}
          
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-primary" />
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              placeholder="Type a command..."
              autoFocus
            />
          </form>
        </div>

        <div className="p-3 border-t border-border/50 text-xs text-muted-foreground">
          Type &apos;help&apos; for available commands • Use ↑↓ for command history
        </div>
      </div>
    </div>
  )
}