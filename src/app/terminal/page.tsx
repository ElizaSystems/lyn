'use client'
import { useState, useRef, useEffect } from 'react'
import { Terminal as TerminalIcon, ChevronRight, Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TerminalPage() {
  const [commands, setCommands] = useState<Array<{ input: string; output: string; timestamp: Date }>>([
    {
      input: 'lyn --version',
      output: `LYN Security CLI v3.0.0
Connected to security network
Ready for commands...

🎓 New to LYN CLI? Type 'tutorial start' for a guided walkthrough!
🔧 Want to build security apps? Type 'help create' to get started!
📊 Check system status with 'status' command.`,
      timestamp: new Date()
    }
  ])
  const [currentInput, setCurrentInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const availableCommands = [
    'help', 'create', 'deploy', 'generate', 'scan', 'monitor', 'analyze', 
    'threat-intel', 'status', 'metrics', 'wallet', 'token', 'price', 'supply',
    'template', 'tutorial', 'history', 'clear', 'version'
  ]

  useEffect(() => {
    terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight)
  }, [commands])

  // Auto-completion
  useEffect(() => {
    const input = currentInput.toLowerCase()
    if (input.length > 0) {
      const matches = availableCommands.filter(cmd => cmd.startsWith(input))
      setSuggestions(matches)
      setShowSuggestions(matches.length > 0 && matches[0] !== input)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [currentInput])

  const processCommand = async (input: string) => {
    setIsProcessing(true)
    setShowSuggestions(false)
    
    // Add command to display immediately
    setCommands(prev => [...prev, { input, output: '⏳ Processing...', timestamp: new Date() }])
    
    try {
      const response = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: input })
      })
      
      const data = await response.json()
      
      if (data.action === 'clear') {
        setCommands([])
        setIsProcessing(false)
        return
      }
      
      // Update the last command with the actual output
      setCommands(prev => {
        const newCommands = [...prev]
        newCommands[newCommands.length - 1] = { input, output: data.output || '', timestamp: new Date() }
        return newCommands
      })
      
      setCommandHistory(prev => [...prev, input])
      setHistoryIndex(-1)
    } catch (error) {
      console.error('Command execution error:', error)
      setCommands(prev => {
        const newCommands = [...prev]
        newCommands[newCommands.length - 1] = { 
          input, 
          output: 'Error: Failed to execute command', 
          timestamp: new Date() 
        }
        return newCommands
      })
    } finally {
      setIsProcessing(false)
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
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (suggestions.length > 0) {
        setCurrentInput(suggestions[0])
        setShowSuggestions(false)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
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
          
          <div className="relative">
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
                disabled={isProcessing}
                autoFocus
              />
            </form>
            
            {/* Auto-completion suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute bottom-full left-6 mb-1 bg-gray-900 border border-border/50 rounded-lg p-2 shadow-lg">
                {suggestions.slice(0, 5).map((suggestion, index) => (
                  <div
                    key={suggestion}
                    className="px-2 py-1 text-sm hover:bg-primary/20 rounded cursor-pointer"
                    onClick={() => {
                      setCurrentInput(suggestion)
                      setShowSuggestions(false)
                      inputRef.current?.focus()
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
                <div className="text-xs text-muted-foreground mt-1 px-2">
                  Press Tab to complete
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-border/50 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <div>
              Type &apos;help&apos; for commands • ↑↓ for history • Tab to complete • &apos;tutorial start&apos; for guided setup
            </div>
            <div className="flex items-center space-x-4">
              <span>LYN CLI v3.0</span>
              <span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}