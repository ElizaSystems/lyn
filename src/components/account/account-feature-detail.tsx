import { address, Address } from 'gill'
import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { ExplorerLink } from '@/components/cluster/cluster-ui'
import { AppHero } from '@/components/app-hero'
import { ellipsify } from '@/lib/utils'

import { AccountBalance, AccountButtons, AccountTokens, AccountTransactions } from './account-ui'

export default function AccountFeatureDetail() {
  const params = useParams()
  const validAddress = useMemo(() => {
    if (!params.address || typeof params.address !== 'string') {
      return
    }
    try {
      return address(params.address)
    } catch {
      return
    }
  }, [params])
  if (!validAddress) {
    return <div>Error loading account</div>
  }

  return (
    <div>
      <AppHero
        title={<AccountBalance address={validAddress} />}
        subtitle={
          <div className="my-4">
            <ExplorerLink address={validAddress.toString()} label={ellipsify(validAddress.toString())} />
          </div>
        }
      >
        <div className="my-4">
          <AccountButtons address={validAddress} />
        </div>
      </AppHero>
      <div className="space-y-8">
        <AccountTokens address={validAddress} />
        <AccountTransactions address={validAddress} />
      </div>
    </div>
  )
}
