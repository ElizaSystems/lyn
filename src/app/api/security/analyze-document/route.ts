import { NextRequest, NextResponse } from 'next/server'

interface MaliciousPatterns {
  eval_usage: boolean
  dangerous_functions: boolean
  obfuscated_code: boolean
  suspicious_urls: boolean
  base64_payloads: boolean
  shell_commands: boolean
  registry_modifications: boolean
  network_requests: boolean
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const fileContent = await file.text()
    const fileName = file.name.toLowerCase()
    
    const analysis = analyzeDocument(fileContent, fileName)
    
    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Document analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze document' },
      { status: 500 }
    )
  }
}

function analyzeDocument(content: string, fileName: string): {
  safe: boolean
  risk_level?: 'low' | 'medium' | 'high' | 'critical'
  details: string[]
  recommendations: string[]
} {
  const patterns: MaliciousPatterns = {
    eval_usage: false,
    dangerous_functions: false,
    obfuscated_code: false,
    suspicious_urls: false,
    base64_payloads: false,
    shell_commands: false,
    registry_modifications: false,
    network_requests: false
  }
  
  const details: string[] = []
  const recommendations: string[] = []
  
  const contentLower = content.toLowerCase()
  
  const evalPatterns = [
    /eval\s*\(/gi,
    /new\s+Function\s*\(/gi,
    /setTimeout\s*\([^,]+,\s*0\)/gi,
    /setInterval\s*\([^,]+,/gi
  ]
  
  if (evalPatterns.some(pattern => pattern.test(content))) {
    patterns.eval_usage = true
    details.push('Dynamic code execution detected (eval, Function constructor)')
    recommendations.push('Review all dynamic code execution carefully')
  }
  
  const dangerousFunctions = [
    'exec', 'spawn', 'execFile', 'fork',
    'require("child_process")',
    'ActiveXObject',
    'WScript.Shell',
    'Shell.Application',
    '__import__',
    'subprocess',
    'os.system',
    'popen'
  ]
  
  if (dangerousFunctions.some(func => contentLower.includes(func.toLowerCase()))) {
    patterns.dangerous_functions = true
    details.push('Potentially dangerous system functions detected')
    recommendations.push('Verify the necessity of system-level operations')
  }
  
  const obfuscationPatterns = [
    /\\x[0-9a-f]{2}/gi,
    /\\u[0-9a-f]{4}/gi,
    /String\.fromCharCode/gi,
    /atob\s*\(/gi,
    /btoa\s*\(/gi,
    /unescape\s*\(/gi,
    /[a-zA-Z]{1}\s*=\s*[a-zA-Z]{1}\s*\+\s*[a-zA-Z]{1}/g,
    /_0x[0-9a-f]+/gi
  ]
  
  const obfuscationCount = obfuscationPatterns.reduce((count, pattern) => {
    const matches = content.match(pattern)
    return count + (matches ? matches.length : 0)
  }, 0)
  
  if (obfuscationCount > 10) {
    patterns.obfuscated_code = true
    details.push('Heavy code obfuscation detected - often used to hide malicious intent')
    recommendations.push('Deobfuscate the code before running to understand its true purpose')
  }
  
  const suspiciousUrls = [
    /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/gi,
    /https?:\/\/[a-z0-9]+\.tk/gi,
    /https?:\/\/[a-z0-9]+\.ml/gi,
    /https?:\/\/[a-z0-9]+\.ga/gi,
    /https?:\/\/[a-z0-9]+\.cf/gi,
    /pastebin\.com/gi,
    /bit\.ly/gi,
    /tinyurl\.com/gi
  ]
  
  if (suspiciousUrls.some(pattern => pattern.test(content))) {
    patterns.suspicious_urls = true
    details.push('Suspicious URLs or IP addresses detected')
    recommendations.push('Verify all external URLs before allowing network connections')
  }
  
  const base64Pattern = /[A-Za-z0-9+/]{40,}={0,2}/g
  const base64Matches = content.match(base64Pattern)
  if (base64Matches && base64Matches.length > 5) {
    patterns.base64_payloads = true
    details.push('Multiple Base64 encoded strings detected - may contain hidden payloads')
    recommendations.push('Decode and inspect Base64 strings before execution')
  }
  
  const shellCommands = [
    /cmd\s*\/c/gi,
    /powershell/gi,
    /bash\s+-c/gi,
    /sh\s+-c/gi,
    /rm\s+-rf/gi,
    /format\s+[a-z]:/gi,
    /del\s+\/f/gi,
    /reg\s+add/gi,
    /netsh/gi,
    /schtasks/gi
  ]
  
  if (shellCommands.some(pattern => pattern.test(content))) {
    patterns.shell_commands = true
    details.push('Shell command execution patterns detected')
    recommendations.push('Review all system commands for legitimacy')
  }
  
  const registryPatterns = [
    /HKEY_/gi,
    /RegWrite/gi,
    /RegDelete/gi,
    /Registry\:\:/gi,
    /winreg/gi
  ]
  
  if (registryPatterns.some(pattern => pattern.test(content))) {
    patterns.registry_modifications = true
    details.push('Windows Registry modification attempts detected')
    recommendations.push('Registry modifications can affect system stability')
  }
  
  const networkPatterns = [
    /XMLHttpRequest/gi,
    /fetch\s*\(/gi,
    /WebSocket/gi,
    /socket\./gi,
    /requests\./gi,
    /urllib/gi,
    /net\.request/gi,
    /http\.get/gi,
    /axios/gi
  ]
  
  if (networkPatterns.some(pattern => pattern.test(content))) {
    patterns.network_requests = true
    details.push('Network communication capabilities detected')
    recommendations.push('Monitor network traffic if executing this code')
  }
  
  if (fileName.endsWith('.exe') || fileName.endsWith('.dll') || fileName.endsWith('.bat') || fileName.endsWith('.ps1')) {
    details.push('Executable file type detected - high risk')
    recommendations.push('Scan with antivirus before execution')
  }
  
  if (fileName.endsWith('.zip') || fileName.endsWith('.rar') || fileName.endsWith('.7z')) {
    details.push('Archive file detected - may contain hidden malicious files')
    recommendations.push('Extract and scan contents in a sandbox environment')
  }
  
  const macroPatterns = [
    /Sub\s+Auto_?Open\s*\(/gi,
    /Sub\s+Workbook_Open\s*\(/gi,
    /Sub\s+Document_Open\s*\(/gi,
    /CreateObject\s*\(/gi,
    /\.Run\s+/gi
  ]
  
  if (macroPatterns.some(pattern => pattern.test(content))) {
    details.push('Office macro patterns detected - commonly used for malware delivery')
    recommendations.push('Disable macros unless from a trusted source')
  }
  
  const patternCount = Object.values(patterns).filter(Boolean).length
  
  let risk_level: 'low' | 'medium' | 'high' | 'critical'
  if (patternCount === 0) {
    risk_level = 'low'
  } else if (patternCount <= 2) {
    risk_level = 'medium'
  } else if (patternCount <= 4) {
    risk_level = 'high'
  } else {
    risk_level = 'critical'
  }
  
  const safe = patternCount === 0 && !fileName.match(/\.(exe|dll|bat|ps1|vbs|jar)$/i)
  
  if (safe) {
    details.push('No obvious malicious patterns detected')
    recommendations.push('Still recommended to scan with updated antivirus software')
    recommendations.push('Execute in a sandboxed environment if unsure')
  }
  
  return {
    safe,
    risk_level,
    details,
    recommendations
  }
}