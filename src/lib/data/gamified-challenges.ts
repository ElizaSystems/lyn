export interface GamifiedChallenge {
  id: string
  title: string
  category: 'phishing' | 'wallet' | 'smart-contract' | 'defi' | 'nft' | 'bridge' | 'social-engineering'
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  scenario: {
    background: string
    situation: string
    objective: string
    context: any // Additional context data
  }
  questions: {
    id: string
    type: 'multiple-choice' | 'true-false' | 'code-analysis' | 'simulation'
    question: string
    options?: string[]
    correctAnswer: string | string[]
    explanation: string
    points: number
    timeLimit?: number // seconds
  }[]
  hints: {
    id: string
    text: string
    penalty: number // points deducted
  }[]
  rewards: {
    xp: number
    badge?: string
    achievement?: string
  }
}

export const gamifiedChallenges: GamifiedChallenge[] = [
  {
    id: 'phishing-discord-emergency',
    title: 'Discord Emergency Scam',
    category: 'phishing',
    difficulty: 'intermediate',
    scenario: {
      background: 'You receive an urgent message in a Discord server about a limited-time airdrop.',
      situation: 'A user claiming to be a moderator DMs you saying the official airdrop website is down and provides an alternative link for "verified members only". The message includes official-looking graphics and a countdown timer showing 2 hours remaining.',
      objective: 'Identify the red flags and determine the appropriate response.',
      context: {
        messageContent: 'Hey! The main airdrop site crashed due to high traffic. Use this backup link for verified members: hxxps://officialairdrop-backup.xyz',
        senderProfile: { username: 'MOD_Support', badges: ['Verified'], joinDate: 'Today' },
        serverName: 'Official Project Server',
        memberCount: 150000
      }
    },
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'What is the FIRST red flag you should notice?',
        options: [
          'The moderator DMed you first without you asking',
          'The website domain looks suspicious',
          'There\'s a time pressure element',
          'The message has official graphics'
        ],
        correctAnswer: 'The moderator DMed you first without you asking',
        explanation: 'Real moderators rarely DM first, especially about financial opportunities. This is a common scam tactic.',
        points: 100,
        timeLimit: 30
      },
      {
        id: 'q2',
        type: 'multiple-choice',
        question: 'What should you check about the sender?',
        options: [
          'Their profile picture',
          'Their join date and server roles',
          'Their message history',
          'Their friend list'
        ],
        correctAnswer: 'Their join date and server roles',
        explanation: 'Checking when they joined (Today) and verifying their actual roles in the server member list is crucial.',
        points: 100,
        timeLimit: 30
      },
      {
        id: 'q3',
        type: 'true-false',
        question: 'You should click the link to see if it looks legitimate.',
        correctAnswer: 'false',
        explanation: 'Never click suspicious links. Verify through official channels first.',
        points: 150,
        timeLimit: 20
      },
      {
        id: 'q4',
        type: 'simulation',
        question: 'What is the BEST course of action?',
        options: [
          'Report the user and message to Discord and server admins',
          'Warn others in the general chat',
          'Block the user and ignore',
          'Ask them for more proof'
        ],
        correctAnswer: 'Report the user and message to Discord and server admins',
        explanation: 'Reporting helps protect the entire community. Admins can take action and warn others officially.',
        points: 200,
        timeLimit: 30
      }
    ],
    hints: [
      {
        id: 'hint1',
        text: 'Real moderators have special badges that can\'t be faked in the server member list.',
        penalty: 25
      },
      {
        id: 'hint2',
        text: 'Check the official announcements channel for any mention of alternative links.',
        penalty: 25
      }
    ],
    rewards: {
      xp: 500,
      badge: 'Scam Detector',
      achievement: 'Saved the Community'
    }
  },
  {
    id: 'wallet-drain-sophisticated',
    title: 'The Sophisticated Wallet Drain',
    category: 'wallet',
    difficulty: 'advanced',
    scenario: {
      background: 'You\'re browsing a popular NFT marketplace when a popup appears.',
      situation: 'The popup says "Security Update Required: Your wallet signature is needed to implement new security features. This is mandatory for all users by [today\'s date]." The site URL looks correct, SSL certificate is valid.',
      objective: 'Analyze the request and identify the attack vector.',
      context: {
        url: 'https://opensea.io/security-update',
        sslCert: 'Valid - DigiCert',
        signatureRequest: {
          message: 'Authorize security update',
          domain: 'opensea.io',
          nonce: '0x7f3d9a2b',
          expirationTime: '2024-12-31'
        }
      }
    },
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'What type of attack is this?',
        options: [
          'Phishing with typosquatting',
          'Man-in-the-middle attack',
          'Signature phishing / wallet drain',
          'DNS hijacking'
        ],
        correctAnswer: 'Signature phishing / wallet drain',
        explanation: 'This is a signature phishing attack where malicious signatures can drain your wallet.',
        points: 150,
        timeLimit: 45
      },
      {
        id: 'q2',
        type: 'code-analysis',
        question: 'What does this signature actually authorize?',
        options: [
          'A simple message signature',
          'Full wallet access and token approvals',
          'Read-only access to wallet',
          'Security update installation'
        ],
        correctAnswer: 'Full wallet access and token approvals',
        explanation: 'The vague message hides malicious contract interactions that can approve unlimited token spending.',
        points: 200,
        timeLimit: 60
      },
      {
        id: 'q3',
        type: 'multiple-choice',
        question: 'How did they make the URL look legitimate?',
        options: [
          'Using Unicode characters (homograph attack)',
          'Subdomain spoofing',
          'URL shortener',
          'Browser extension manipulation'
        ],
        correctAnswer: 'Using Unicode characters (homograph attack)',
        explanation: 'The URL uses lookalike Unicode characters. "opensea.io" might actually be "opensеa.io" with a Cyrillic "е".',
        points: 200,
        timeLimit: 45
      },
      {
        id: 'q4',
        type: 'simulation',
        question: 'You accidentally signed it. What\'s your immediate action?',
        options: [
          'Revoke all token approvals immediately',
          'Transfer assets to a new wallet',
          'Contact OpenSea support',
          'Change wallet password'
        ],
        correctAnswer: 'Transfer assets to a new wallet',
        explanation: 'Transfer valuable assets immediately to a secure wallet. Revoking approvals might be too slow.',
        points: 250,
        timeLimit: 30
      }
    ],
    hints: [
      {
        id: 'hint1',
        text: 'Check the exact URL character by character. Copy and paste it to see the real characters.',
        penalty: 50
      },
      {
        id: 'hint2',
        text: 'Legitimate platforms never ask for signatures through popups.',
        penalty: 30
      }
    ],
    rewards: {
      xp: 800,
      badge: 'Signature Guardian',
      achievement: 'Dodged the Drain'
    }
  },
  {
    id: 'defi-rug-pull-analysis',
    title: 'DeFi Protocol Rug Pull Investigation',
    category: 'defi',
    difficulty: 'expert',
    scenario: {
      background: 'A new DeFi protocol "YieldMaxPro" promises 500% APY on stablecoin deposits.',
      situation: 'The protocol has $10M TVL, verified contracts on Etherscan, active community, and endorsements from influencers. You\'re analyzing whether to invest.',
      objective: 'Identify the rug pull indicators before it\'s too late.',
      context: {
        contractAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        tvl: '$10,000,000',
        apy: '500%',
        audit: 'CertiK (Basic)',
        teamTokens: '40%',
        liquidityLocked: '6 months',
        deploymentDate: '3 days ago'
      }
    },
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'What\'s the most concerning aspect?',
        options: [
          'The 500% APY is unsustainably high',
          'Team holds 40% of tokens',
          'Protocol is only 3 days old',
          'All of the above'
        ],
        correctAnswer: 'All of the above',
        explanation: 'Multiple red flags compound the risk. Each alone is concerning, together they scream rug pull.',
        points: 100,
        timeLimit: 30
      },
      {
        id: 'q2',
        type: 'code-analysis',
        question: 'You check the contract. What function would enable a rug pull?',
        options: [
          'withdraw() with no timelock',
          'setFeePercent() with no maximum',
          'emergencyWithdraw() with admin access',
          'All could enable a rug pull'
        ],
        correctAnswer: 'All could enable a rug pull',
        explanation: 'Any function allowing unrestricted fund access or fee manipulation can facilitate a rug pull.',
        points: 250,
        timeLimit: 60
      },
      {
        id: 'q3',
        type: 'simulation',
        question: 'The team claims liquidity is locked. What should you verify?',
        options: [
          'Check the lock contract and duration',
          'Verify the lock contract can\'t be broken',
          'Ensure locked amount is significant',
          'All of the above'
        ],
        correctAnswer: 'All of the above',
        explanation: 'Liquidity locks can be fake, have backdoors, or lock insignificant amounts. Verify everything.',
        points: 200,
        timeLimit: 45
      },
      {
        id: 'q4',
        type: 'multiple-choice',
        question: 'You notice the audit is "Basic". What does this mean?',
        options: [
          'Only automated scanning, no manual review',
          'Limited scope, critical functions not reviewed',
          'No economic model evaluation',
          'All of the above'
        ],
        correctAnswer: 'All of the above',
        explanation: 'Basic audits are often inadequate. Full audits include manual review, economic analysis, and comprehensive testing.',
        points: 200,
        timeLimit: 30
      },
      {
        id: 'q5',
        type: 'true-false',
        question: 'High TVL means the protocol is safe.',
        correctAnswer: 'false',
        explanation: 'TVL can be artificially inflated by the team or fake deposits. It\'s not a safety indicator.',
        points: 150,
        timeLimit: 20
      }
    ],
    hints: [
      {
        id: 'hint1',
        text: 'Check on-chain data for large deposits from related wallets.',
        penalty: 40
      },
      {
        id: 'hint2',
        text: 'Research the team - anonymous teams are higher risk.',
        penalty: 40
      },
      {
        id: 'hint3',
        text: 'Sustainable yields in DeFi rarely exceed 20% APY.',
        penalty: 30
      }
    ],
    rewards: {
      xp: 1200,
      badge: 'Rug Pull Detective',
      achievement: 'Saved Millions'
    }
  },
  {
    id: 'bridge-hack-prevention',
    title: 'Cross-Chain Bridge Attack',
    category: 'bridge',
    difficulty: 'expert',
    scenario: {
      background: 'You\'re using a cross-chain bridge to move assets from Ethereum to BSC.',
      situation: 'After initiating a large transfer, you notice unusual activity. The bridge UI shows your transaction as "pending" for 30 minutes, but the Ethereum transaction confirmed 25 minutes ago.',
      objective: 'Identify if this is an attack and how to respond.',
      context: {
        bridgeProtocol: 'AnyBridge',
        transferAmount: '50 ETH',
        ethTxHash: '0xabc123...',
        ethConfirmations: 150,
        bridgeStatus: 'Pending validation',
        estimatedTime: '5-10 minutes'
      }
    },
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'What should you check FIRST?',
        options: [
          'The bridge contract on Etherscan',
          'The bridge\'s official status page',
          'Your BSC wallet for received funds',
          'The bridge\'s Discord for issues'
        ],
        correctAnswer: 'The bridge contract on Etherscan',
        explanation: 'Verify on-chain that your funds reached the correct bridge contract address.',
        points: 200,
        timeLimit: 30
      },
      {
        id: 'q2',
        type: 'simulation',
        question: 'The contract shows your funds but no mint on BSC. What\'s happening?',
        options: [
          'Normal delay in cross-chain validation',
          'Bridge validators are compromised',
          'Front-end hijack showing wrong status',
          'Could be any of these'
        ],
        correctAnswer: 'Could be any of these',
        explanation: 'Without more data, all scenarios are possible. Further investigation needed.',
        points: 250,
        timeLimit: 45
      },
      {
        id: 'q3',
        type: 'multiple-choice',
        question: 'You find other users reporting similar issues. What does this indicate?',
        options: [
          'Systematic bridge exploit in progress',
          'Technical issues with validators',
          'Coordinated attack on multiple users',
          'Any of these are possible'
        ],
        correctAnswer: 'Any of these are possible',
        explanation: 'Multiple users affected suggests systematic issue, but root cause needs investigation.',
        points: 200,
        timeLimit: 30
      },
      {
        id: 'q4',
        type: 'simulation',
        question: 'What\'s your immediate action plan?',
        options: [
          'Document everything and contact support',
          'Try to cancel/revert if possible',
          'Alert community and security teams',
          'All of the above in this order'
        ],
        correctAnswer: 'All of the above in this order',
        explanation: 'Document for evidence, attempt recovery, then help protect others.',
        points: 300,
        timeLimit: 45
      }
    ],
    hints: [
      {
        id: 'hint1',
        text: 'Check if the bridge has a security incident response team.',
        penalty: 50
      },
      {
        id: 'hint2',
        text: 'Some bridges have emergency pause functions.',
        penalty: 50
      }
    ],
    rewards: {
      xp: 1500,
      badge: 'Bridge Defender',
      achievement: 'Cross-Chain Crisis Manager'
    }
  },
  {
    id: 'nft-metadata-manipulation',
    title: 'NFT Metadata Manipulation Attack',
    category: 'nft',
    difficulty: 'advanced',
    scenario: {
      background: 'You own a valuable NFT from a blue-chip collection.',
      situation: 'You receive an offer 2x above floor price. The buyer insists you list on a specific "new marketplace" that offers "better royalties for creators".',
      objective: 'Identify the scam and understand the attack vector.',
      context: {
        nftCollection: 'Bored Apes',
        floorPrice: '25 ETH',
        offerAmount: '50 ETH',
        marketplace: 'NFTProMax.io',
        buyerProfile: { 
          username: 'Collector_King',
          joinDate: '2 days ago',
          previousTrades: 0
        }
      }
    },
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'Why is the buyer insisting on a specific marketplace?',
        options: [
          'Better fees for them',
          'The marketplace is compromised/fake',
          'They have credits there',
          'Tax advantages'
        ],
        correctAnswer: 'The marketplace is compromised/fake',
        explanation: 'Scammers create fake marketplaces to steal NFTs through malicious contracts.',
        points: 150,
        timeLimit: 30
      },
      {
        id: 'q2',
        type: 'simulation',
        question: 'You check the marketplace contract. What malicious function might exist?',
        options: [
          'Hidden transfer function bypassing approval',
          'Ability to change NFT metadata after sale',
          'Drain function for deposited NFTs',
          'All are possible'
        ],
        correctAnswer: 'All are possible',
        explanation: 'Fake marketplaces can have multiple attack vectors built into their contracts.',
        points: 250,
        timeLimit: 45
      },
      {
        id: 'q3',
        type: 'true-false',
        question: 'An offer significantly above floor price is always suspicious.',
        correctAnswer: 'true',
        explanation: 'While rare traits command premiums, 2x floor with conditions is a red flag.',
        points: 100,
        timeLimit: 20
      },
      {
        id: 'q4',
        type: 'multiple-choice',
        question: 'How can you safely handle this situation?',
        options: [
          'Counter-offer on OpenSea or established marketplace',
          'Ignore the offer entirely',
          'Research the marketplace thoroughly first',
          'Ask for payment upfront'
        ],
        correctAnswer: 'Counter-offer on OpenSea or established marketplace',
        explanation: 'If they\'re serious, they\'ll buy on a legitimate platform. This tests their intent.',
        points: 200,
        timeLimit: 30
      }
    ],
    hints: [
      {
        id: 'hint1',
        text: 'Check when the marketplace domain was registered.',
        penalty: 40
      },
      {
        id: 'hint2',
        text: 'Real collectors don\'t insist on unknown platforms.',
        penalty: 30
      }
    ],
    rewards: {
      xp: 700,
      badge: 'NFT Guardian',
      achievement: 'Avoided the Fake Marketplace'
    }
  },
  {
    id: 'social-engineering-insider',
    title: 'The Inside Job',
    category: 'social-engineering',
    difficulty: 'expert',
    scenario: {
      background: 'You\'re a DAO contributor with multisig access.',
      situation: 'A "new team member" DMs you about an urgent treasury issue. They claim the lead dev asked them to coordinate signature collection for an emergency fix. They provide transaction details and say 3/5 signatures are already collected.',
      objective: 'Identify the social engineering tactics and respond appropriately.',
      context: {
        message: 'Hey! Lead dev asked me to help coordinate. We need to move funds to a new gnosis safe due to a vulnerability. 3 signers already confirmed. Just need yours and one more.',
        transaction: {
          to: '0xNew...Safe',
          value: '500 ETH',
          data: 'Migration to secure safe'
        },
        claimedSigners: ['Alice.eth', 'Bob.eth', 'Charlie.eth']
      }
    },
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'What\'s the first verification step?',
        options: [
          'Check if transaction is actually pending',
          'Verify the new team member\'s identity',
          'Contact lead dev directly',
          'Check if there\'s a real vulnerability'
        ],
        correctAnswer: 'Contact lead dev directly',
        explanation: 'Always verify through established channels. Never trust DMs for critical operations.',
        points: 200,
        timeLimit: 30
      },
      {
        id: 'q2',
        type: 'simulation',
        question: 'The person claims it\'s urgent - DAO could lose millions. How do you respond?',
        options: [
          'Sign immediately to prevent loss',
          'Demand public discussion first',
          'Create urgency for verification',
          'Stall while investigating'
        ],
        correctAnswer: 'Demand public discussion first',
        explanation: 'Real emergencies in DAOs still follow process. Public discussion prevents social engineering.',
        points: 250,
        timeLimit: 45
      },
      {
        id: 'q3',
        type: 'multiple-choice',
        question: 'You check - no pending transaction exists. What does this mean?',
        options: [
          'They\'re lying about existing signatures',
          'Technical error in the multisig',
          'Signatures are on different network',
          'They haven\'t started yet'
        ],
        correctAnswer: 'They\'re lying about existing signatures',
        explanation: 'False urgency and fake consensus are classic social engineering tactics.',
        points: 200,
        timeLimit: 30
      },
      {
        id: 'q4',
        type: 'simulation',
        question: 'What\'s the appropriate DAO response?',
        options: [
          'Alert all signers immediately',
          'Post warning in DAO channels',
          'Review and update security procedures',
          'All of the above'
        ],
        correctAnswer: 'All of the above',
        explanation: 'Immediate alert, public warning, and process improvement prevent future attacks.',
        points: 300,
        timeLimit: 30
      }
    ],
    hints: [
      {
        id: 'hint1',
        text: 'Real DAO operations are transparent and documented.',
        penalty: 50
      },
      {
        id: 'hint2',
        text: 'Multisig operations should never be coordinated via DM.',
        penalty: 50
      }
    ],
    rewards: {
      xp: 1500,
      badge: 'DAO Defender',
      achievement: 'Stopped the Inside Job'
    }
  }
]

// Speed run challenges - shorter, focused scenarios
export const speedRunChallenges: GamifiedChallenge[] = [
  {
    id: 'speed-wallet-check',
    title: 'Quick Wallet Assessment',
    category: 'wallet',
    difficulty: 'beginner',
    scenario: {
      background: 'Rapid wallet security check.',
      situation: 'You have 60 seconds to identify all security issues with this wallet setup.',
      objective: 'Find all vulnerabilities quickly.',
      context: {
        seedPhraseStorage: 'Screenshot in phone photos',
        walletType: 'Hot wallet',
        connectedSites: 15,
        tokenApprovals: 'Unlimited on 8 contracts',
        lastSecurityCheck: 'Never'
      }
    },
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'Most critical issue?',
        options: [
          'Seed phrase in photos',
          'Too many connected sites',
          'Unlimited approvals',
          'No security checks'
        ],
        correctAnswer: 'Seed phrase in photos',
        explanation: 'Seed phrase in photos = instant compromise risk if phone is hacked/lost.',
        points: 100,
        timeLimit: 15
      }
    ],
    hints: [],
    rewards: {
      xp: 100,
      achievement: 'Speed Scanner'
    }
  }
]

// Tournament-specific challenges
export const tournamentChallenges: GamifiedChallenge[] = [
  {
    id: 'tournament-grand-heist',
    title: 'The Grand Heist Prevention',
    category: 'smart-contract',
    difficulty: 'expert',
    scenario: {
      background: 'Major protocol under attack RIGHT NOW.',
      situation: 'You\'re monitoring a DeFi protocol when you notice unusual activity. Multiple flash loans, price manipulation, and suspicious contract calls are happening in real-time.',
      objective: 'Identify the attack vector and the appropriate emergency response.',
      context: {
        flashLoans: '5 concurrent from different protocols',
        priceMovement: 'Token A: +400%, Token B: -95%',
        suspiciousContract: '0xAttacker...',
        protocolTVL: '$50M at risk',
        timeElapsed: '2 blocks (26 seconds)'
      }
    },
    questions: [
      {
        id: 'q1',
        type: 'simulation',
        question: 'IMMEDIATE ACTION REQUIRED:',
        options: [
          'Pause protocol if you have access',
          'Alert team and community',
          'Try to front-run the attacker',
          'Contact block producers'
        ],
        correctAnswer: 'Pause protocol if you have access',
        explanation: 'If you have pause authority, use it immediately. Every second counts.',
        points: 500,
        timeLimit: 10
      },
      {
        id: 'q2',
        type: 'multiple-choice',
        question: 'Attack vector identification:',
        options: [
          'Price oracle manipulation',
          'Reentrancy attack',
          'Governance takeover',
          'Integer overflow'
        ],
        correctAnswer: 'Price oracle manipulation',
        explanation: 'Flash loans + extreme price movements = oracle manipulation attack.',
        points: 400,
        timeLimit: 15
      }
    ],
    hints: [],
    rewards: {
      xp: 2000,
      badge: 'Crisis Commander',
      achievement: 'Saved the Protocol'
    }
  }
]