'use client'
import { useState } from 'react'
import { useWallet } from '@/components/solana/solana-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Flame, CheckCircle, Loader2, Info } from 'lucide-react'
import { ShareOnX } from '@/components/share-on-x'

interface UsernameRegistrationProps {
  tokenBalance: number
  onSuccess?: (username: string) => void
}

const REQUIRED_BALANCE = 100000 // Need to hold 100k LYN
const BURN_AMOUNT = 10 // TEMP: Burn 10 LYN for registration during testing

export function UsernameRegistration({ tokenBalance, onSuccess }: UsernameRegistrationProps) {
  const { publicKey } = useWallet()
  const [username, setUsername] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [burnTxSignature, setBurnTxSignature] = useState('')
  const [step, setStep] = useState<'input' | 'burn-instructions' | 'verify' | 'complete'>('input')

  const checkAvailability = async () => {
    if (username.length < 3) {
      setAvailable(null)
      return
    }

    setChecking(true)
    try {
      const response = await fetch(`/api/user/register-username?username=${username}`)
      const data = await response.json()
      setAvailable(data.available)
      setError(data.available ? null : 'Username is already taken')
    } catch (error) {
      console.error('Failed to check username:', error)
      setError('Failed to check availability')
    } finally {
      setChecking(false)
    }
  }

  const handleShowBurnInstructions = () => {
    if (!available) return
    setStep('burn-instructions')
  }

  const handleVerifyBurn = async () => {
    if (!publicKey || !burnTxSignature) return

    setRegistering(true)
    setError(null)
    setStep('verify')

    try {
      // Register username with burn proof
      console.log('Registering username with burn proof...')
      const response = await fetch('/api/user/register-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          walletAddress: publicKey.toString(),
          signature: burnTxSignature,
          transaction: burnTxSignature
        })
      })

      if (response.ok || response.status === 202) {
        const data = await response.json()
        setStep('complete')
        if (onSuccess) {
          onSuccess(username)
        }
        console.log('Username registered successfully!', data)
        
        // Reload after a short delay to ensure auth state is refreshed
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Registration failed')
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError((err as Error).message || 'Failed to complete registration')
      setStep('burn-instructions')
    } finally {
      setRegistering(false)
    }
  }

  const canRegister = tokenBalance >= REQUIRED_BALANCE
  const hasEnoughToBurn = tokenBalance >= (REQUIRED_BALANCE + BURN_AMOUNT)

  if (step === 'complete') {
    return (
      <div className="space-y-4 p-6 bg-green-500/10 rounded-lg border border-green-500/30">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-green-500" />
          <div>
            <h3 className="font-semibold">Registration Complete!</h3>
            <p className="text-sm text-muted-foreground">
              Username <span className="font-mono">@{username}</span> has been registered
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {BURN_AMOUNT.toLocaleString()} LYN tokens were burned
            </p>
          </div>
        </div>
        <ShareOnX
          text={`Just secured my @${username} handle on LYN! Burned ${BURN_AMOUNT.toLocaleString()} $LYN tokens to join the elite. 🔥`}
          hashtags={['LYN', 'Solana', 'Web3', 'DeFi']}
          url="https://lyn.ai"
          variant="default"
          className="w-full"
          successMessage="Flexed on X!"
        />
      </div>
    )
  }

  if (step === 'burn-instructions') {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Flame className="h-5 w-5 text-orange-500" />
            Burn Instructions
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            To register username <span className="font-mono">@{username}</span>, you need to burn {BURN_AMOUNT.toLocaleString()} LYN tokens.
          </p>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-muted/50 rounded">
              <p className="font-medium mb-1">Manual Burn Process:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Open your Solana wallet (Phantom, Solflare, etc.)</li>
                <li>Send exactly {BURN_AMOUNT.toLocaleString()} LYN tokens to the burn address:</li>
                <li className="font-mono text-xs break-all bg-black/20 p-2 rounded mt-1">
                  1111111111111111111111111111111111111111111
                </li>
                <li>Copy the transaction signature</li>
                <li>Paste it below to verify and complete registration</li>
              </ol>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="burnTx">Burn Transaction Signature</Label>
          <Input
            id="burnTx"
            placeholder="Enter transaction signature after burning"
            value={burnTxSignature}
            onChange={(e) => setBurnTxSignature(e.target.value.trim())}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setStep('input')
              setBurnTxSignature('')
              setError(null)
            }}
          >
            Back
          </Button>
          <Button
            onClick={handleVerifyBurn}
            disabled={!burnTxSignature || registering}
            className="flex-1"
          >
            {registering ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying Burn...
              </>
            ) : (
              'Verify Burn & Register'
            )}
          </Button>
        </div>
        
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {step === 'input' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="username">Choose Your Username</Label>
            <div className="flex gap-2">
              <Input
                id="username"
                placeholder="Enter username (3-20 characters)"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase())
                  setAvailable(null)
                  setError(null)
                }}
                onBlur={checkAvailability}
                disabled={registering}
                className={available === false ? 'border-red-500' : available === true ? 'border-green-500' : ''}
              />
              {checking && <Loader2 className="h-5 w-5 animate-spin" />}
              {available === true && <CheckCircle className="h-5 w-5 text-green-500" />}
              {available === false && <AlertCircle className="h-5 w-5 text-red-500" />}
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        </>
      )}

      <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
        <h4 className="font-medium flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          Registration Requirements
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Token Balance Required:</span>
            <span className={canRegister ? 'text-green-500' : 'text-red-500'}>
              {tokenBalance.toLocaleString()} / {REQUIRED_BALANCE.toLocaleString()} LYN
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Registration Fee (Burned):</span>
            <span className="text-orange-500">{BURN_AMOUNT.toLocaleString()} LYN</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Total Needed:</span>
            <span className={hasEnoughToBurn ? 'text-green-500' : 'text-yellow-500'}>
              {(REQUIRED_BALANCE + BURN_AMOUNT).toLocaleString()} LYN
            </span>
          </div>
        </div>
        {!hasEnoughToBurn && (
          <p className="text-xs text-yellow-500">
            Note: You need {REQUIRED_BALANCE.toLocaleString()} LYN to hold + {BURN_AMOUNT.toLocaleString()} LYN to burn
          </p>
        )}
      </div>

      {step === 'input' && (
        <Button
          onClick={handleShowBurnInstructions}
          disabled={!available || !hasEnoughToBurn || !publicKey}
          className="w-full"
        >
          <Flame className="h-4 w-4 mr-2" />
          Register Username (Burn {BURN_AMOUNT.toLocaleString()} LYN)
        </Button>
      )}

      <p className="text-xs text-muted-foreground text-center">
        This will permanently burn {BURN_AMOUNT.toLocaleString()} LYN tokens from your wallet.
        The burn is irreversible and helps maintain the deflationary tokenomics.
      </p>
    </div>
  )
}