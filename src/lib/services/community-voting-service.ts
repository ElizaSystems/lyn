import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { WalletListService } from './wallet-list-service'
import { WalletListEntry } from '@/lib/models/wallet-lists'

export interface VoteProposal {
  _id?: ObjectId
  proposalType: 'add_entry' | 'remove_entry' | 'modify_entry' | 'promote_to_global'
  targetWalletAddress: string
  targetEntryId?: ObjectId // For modify/remove operations
  
  // Proposed changes
  proposedEntry?: Partial<WalletListEntry>
  reason: string
  evidence?: {
    transactionHashes?: string[]
    screenshots?: string[]
    urls?: string[]
    additionalInfo?: string
  }

  // Proposal metadata
  proposerId: ObjectId
  proposerAddress: string
  proposerReputation: number
  
  // Voting data
  votes: {
    for: number
    against: number
    abstain: number
    voters: Array<{
      userId: ObjectId
      walletAddress: string
      vote: 'for' | 'against' | 'abstain'
      weight: number // Based on user reputation
      votedAt: Date
      reason?: string
    }>
  }

  // Status and timing
  status: 'active' | 'passed' | 'rejected' | 'expired' | 'executed'
  requiredVotes: number
  passingThreshold: number // Percentage needed to pass (e.g., 75)
  
  // Timing
  createdAt: Date
  expiresAt: Date
  executedAt?: Date
  executedBy?: ObjectId

  // Community engagement
  discussionCount: number
  supportingComments: string[]
  opposingComments: string[]
}

export interface VoterReputation {
  _id?: ObjectId
  userId: ObjectId
  walletAddress: string
  
  // Reputation metrics
  totalVotes: number
  accurateVotes: number // Votes that aligned with eventual consensus
  proposalsSubmitted: number
  successfulProposals: number
  
  // Quality metrics
  reputationScore: number // 0-1000
  trustLevel: 'new' | 'trusted' | 'expert' | 'moderator'
  specializations: string[] // Categories they're good at
  
  // Activity
  lastVoteAt?: Date
  joinedAt: Date
  isActive: boolean
  
  // Moderation
  warnings: number
  isSuspended: boolean
  suspendedUntil?: Date
}

export class CommunityVotingService {
  private static async getProposalsCollection() {
    const db = await getDatabase()
    return db.collection<VoteProposal>('vote_proposals')
  }

  private static async getReputationCollection() {
    const db = await getDatabase()
    return db.collection<VoterReputation>('voter_reputation')
  }

  /**
   * Create a new community proposal
   */
  static async createProposal(
    proposalType: VoteProposal['proposalType'],
    targetWalletAddress: string,
    reason: string,
    proposerId: ObjectId,
    proposerAddress: string,
    proposedEntry?: Partial<WalletListEntry>,
    evidence?: VoteProposal['evidence'],
    targetEntryId?: ObjectId
  ): Promise<VoteProposal> {
    const collection = await this.getProposalsCollection()

    // Get proposer reputation
    const proposerRep = await this.getUserReputation(proposerId)
    
    // Check if proposer can create proposals
    if (proposerRep.isSuspended) {
      throw new Error('User is suspended from community voting')
    }

    if (proposerRep.reputationScore < 100) {
      throw new Error('Minimum reputation score of 100 required to create proposals')
    }

    // Check for existing active proposals for the same wallet
    const existingProposal = await collection.findOne({
      targetWalletAddress,
      status: 'active'
    })

    if (existingProposal) {
      throw new Error('An active proposal already exists for this wallet')
    }

    // Calculate voting requirements based on proposal type
    const votingConfig = this.getVotingConfig(proposalType, proposerRep.trustLevel)

    const proposal: VoteProposal = {
      proposalType,
      targetWalletAddress,
      targetEntryId,
      proposedEntry,
      reason,
      evidence,
      proposerId,
      proposerAddress,
      proposerReputation: proposerRep.reputationScore,
      votes: {
        for: 0,
        against: 0,
        abstain: 0,
        voters: []
      },
      status: 'active',
      requiredVotes: votingConfig.requiredVotes,
      passingThreshold: votingConfig.passingThreshold,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (votingConfig.votingPeriodDays * 24 * 60 * 60 * 1000)),
      discussionCount: 0,
      supportingComments: [],
      opposingComments: []
    }

    const result = await collection.insertOne(proposal)
    const createdProposal = { ...proposal, _id: result.insertedId }

    // Update proposer statistics
    await this.updateProposerStats(proposerId)

    console.log(`[CommunityVoting] New proposal created: ${proposalType} for ${targetWalletAddress}`)

    return createdProposal
  }

  /**
   * Cast a vote on a proposal
   */
  static async castVote(
    proposalId: ObjectId,
    userId: ObjectId,
    walletAddress: string,
    vote: 'for' | 'against' | 'abstain',
    reason?: string
  ): Promise<VoteProposal> {
    const collection = await this.getProposalsCollection()

    // Get proposal
    const proposal = await collection.findOne({ _id: proposalId })
    if (!proposal) {
      throw new Error('Proposal not found')
    }

    if (proposal.status !== 'active') {
      throw new Error('Proposal is not active for voting')
    }

    if (proposal.expiresAt < new Date()) {
      throw new Error('Proposal has expired')
    }

    // Get voter reputation
    const voterRep = await this.getUserReputation(userId)
    
    if (voterRep.isSuspended) {
      throw new Error('User is suspended from voting')
    }

    // Check if user already voted
    const existingVote = proposal.votes.voters.find(v => v.userId.equals(userId))
    if (existingVote) {
      throw new Error('User has already voted on this proposal')
    }

    // Calculate vote weight based on reputation
    const voteWeight = this.calculateVoteWeight(voterRep)

    // Add vote
    const voteRecord = {
      userId,
      walletAddress,
      vote,
      weight: voteWeight,
      votedAt: new Date(),
      reason
    }

    const voteUpdate: any = {
      $push: { 'votes.voters': voteRecord },
      $set: { updatedAt: new Date() }
    }

    // Update vote counts
    switch (vote) {
      case 'for':
        voteUpdate.$inc = { 'votes.for': voteWeight }
        break
      case 'against':
        voteUpdate.$inc = { 'votes.against': voteWeight }
        break
      case 'abstain':
        voteUpdate.$inc = { 'votes.abstain': voteWeight }
        break
    }

    const updatedProposal = await collection.findOneAndUpdate(
      { _id: proposalId },
      voteUpdate,
      { returnDocument: 'after' }
    )

    if (!updatedProposal) {
      throw new Error('Failed to update proposal with vote')
    }

    // Update voter statistics
    await this.updateVoterStats(userId)

    // Check if proposal should be executed
    await this.checkAndExecuteProposal(updatedProposal)

    console.log(`[CommunityVoting] Vote cast: ${vote} on proposal ${proposalId}`)

    return updatedProposal
  }

  /**
   * Get active proposals
   */
  static async getActiveProposals(
    options?: {
      proposalType?: VoteProposal['proposalType']
      walletAddress?: string
      limit?: number
      offset?: number
    }
  ): Promise<{
    proposals: VoteProposal[]
    total: number
  }> {
    const collection = await this.getProposalsCollection()

    const query: any = { status: 'active', expiresAt: { $gt: new Date() } }
    
    if (options?.proposalType) {
      query.proposalType = options.proposalType
    }
    
    if (options?.walletAddress) {
      query.targetWalletAddress = options.walletAddress
    }

    const total = await collection.countDocuments(query)
    const proposals = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(options?.offset || 0)
      .limit(options?.limit || 20)
      .toArray()

    return { proposals, total }
  }

  /**
   * Get proposal details with voting breakdown
   */
  static async getProposalDetails(proposalId: ObjectId): Promise<VoteProposal & {
    votingBreakdown: {
      totalVotes: number
      totalWeight: number
      forPercentage: number
      againstPercentage: number
      abstainPercentage: number
      remainingTime: number
      canExecute: boolean
    }
    recentVotes: Array<{
      walletAddress: string
      vote: string
      weight: number
      votedAt: Date
      reason?: string
    }>
  }> {
    const collection = await this.getProposalsCollection()
    
    const proposal = await collection.findOne({ _id: proposalId })
    if (!proposal) {
      throw new Error('Proposal not found')
    }

    const totalVotes = proposal.votes.voters.length
    const totalWeight = proposal.votes.for + proposal.votes.against + proposal.votes.abstain
    
    const forPercentage = totalWeight > 0 ? (proposal.votes.for / totalWeight) * 100 : 0
    const againstPercentage = totalWeight > 0 ? (proposal.votes.against / totalWeight) * 100 : 0
    const abstainPercentage = totalWeight > 0 ? (proposal.votes.abstain / totalWeight) * 100 : 0

    const remainingTime = Math.max(0, proposal.expiresAt.getTime() - Date.now())
    const canExecute = forPercentage >= proposal.passingThreshold && 
                      totalWeight >= proposal.requiredVotes

    const recentVotes = proposal.votes.voters
      .sort((a, b) => b.votedAt.getTime() - a.votedAt.getTime())
      .slice(0, 10)
      .map(v => ({
        walletAddress: v.walletAddress.slice(0, 8) + '...',
        vote: v.vote,
        weight: v.weight,
        votedAt: v.votedAt,
        reason: v.reason
      }))

    return {
      ...proposal,
      votingBreakdown: {
        totalVotes,
        totalWeight,
        forPercentage,
        againstPercentage,
        abstainPercentage,
        remainingTime,
        canExecute
      },
      recentVotes
    }
  }

  /**
   * Execute a passed proposal
   */
  static async executeProposal(
    proposalId: ObjectId,
    executorId: ObjectId
  ): Promise<{
    success: boolean
    result?: any
    error?: string
  }> {
    const collection = await this.getProposalsCollection()
    
    const proposal = await collection.findOne({ _id: proposalId })
    if (!proposal) {
      throw new Error('Proposal not found')
    }

    if (proposal.status !== 'active') {
      throw new Error('Proposal is not active')
    }

    // Check if proposal meets execution criteria
    const totalWeight = proposal.votes.for + proposal.votes.against + proposal.votes.abstain
    const forPercentage = (proposal.votes.for / totalWeight) * 100

    if (forPercentage < proposal.passingThreshold || totalWeight < proposal.requiredVotes) {
      throw new Error('Proposal does not meet execution criteria')
    }

    try {
      let result: any = null

      // Execute based on proposal type
      switch (proposal.proposalType) {
        case 'add_entry':
          if (!proposal.proposedEntry) {
            throw new Error('No proposed entry data')
          }

          result = await WalletListService.addWalletToList({
            ...proposal.proposedEntry as any,
            walletAddress: proposal.targetWalletAddress,
            ownerId: proposal.proposerId,
            ownerAddress: proposal.proposerAddress,
            visibility: 'public',
            isGlobal: false,
            source: 'community_vote',
            tags: [...(proposal.proposedEntry.tags || []), 'community_approved']
          })
          break

        case 'remove_entry':
          if (!proposal.targetEntryId) {
            throw new Error('No target entry ID')
          }
          // Implementation would remove the entry
          result = { removed: true, entryId: proposal.targetEntryId }
          break

        case 'modify_entry':
          if (!proposal.targetEntryId || !proposal.proposedEntry) {
            throw new Error('Missing target entry ID or proposed changes')
          }
          result = await WalletListService.updateWalletListEntry(
            proposal.targetEntryId,
            proposal.proposedEntry,
            proposal.proposerId
          )
          break

        case 'promote_to_global':
          if (!proposal.targetEntryId) {
            throw new Error('No target entry ID')
          }
          result = await WalletListService.updateWalletListEntry(
            proposal.targetEntryId,
            { isGlobal: true, visibility: 'public' },
            proposal.proposerId
          )
          break
      }

      // Update proposal status
      await collection.updateOne(
        { _id: proposalId },
        {
          $set: {
            status: 'executed',
            executedAt: new Date(),
            executedBy: executorId
          }
        }
      )

      // Update reputation for all voters based on successful execution
      await this.updateVoterReputationPostExecution(proposal, true)

      console.log(`[CommunityVoting] Proposal ${proposalId} executed successfully`)

      return { success: true, result }

    } catch (error) {
      await collection.updateOne(
        { _id: proposalId },
        {
          $set: {
            status: 'rejected',
            executedAt: new Date(),
            executedBy: executorId
          }
        }
      )

      console.error(`[CommunityVoting] Proposal execution failed:`, error)

      return { success: false, error: error.message }
    }
  }

  /**
   * Get user's voting history and reputation
   */
  static async getUserVotingProfile(userId: ObjectId): Promise<{
    reputation: VoterReputation
    recentVotes: Array<{
      proposalId: ObjectId
      proposalType: string
      vote: string
      votedAt: Date
      outcome: string
    }>
    statistics: {
      totalVotes: number
      successfulVotes: number
      accuracyRate: number
      proposalsSubmitted: number
      proposalSuccessRate: number
    }
  }> {
    const reputation = await this.getUserReputation(userId)
    
    // Get recent votes
    const proposalsCollection = await this.getProposalsCollection()
    const recentVotes = await proposalsCollection
      .find(
        { 'votes.voters.userId': userId },
        { 
          projection: {
            _id: 1,
            proposalType: 1,
            status: 1,
            'votes.voters.$': 1
          }
        }
      )
      .sort({ 'votes.voters.votedAt': -1 })
      .limit(20)
      .toArray()

    const votingHistory = recentVotes.map(p => {
      const vote = p.votes.voters[0]
      return {
        proposalId: p._id!,
        proposalType: p.proposalType,
        vote: vote.vote,
        votedAt: vote.votedAt,
        outcome: p.status
      }
    })

    const statistics = {
      totalVotes: reputation.totalVotes,
      successfulVotes: reputation.accurateVotes,
      accuracyRate: reputation.totalVotes > 0 ? 
        (reputation.accurateVotes / reputation.totalVotes) * 100 : 0,
      proposalsSubmitted: reputation.proposalsSubmitted,
      proposalSuccessRate: reputation.proposalsSubmitted > 0 ? 
        (reputation.successfulProposals / reputation.proposalsSubmitted) * 100 : 0
    }

    return {
      reputation,
      recentVotes: votingHistory,
      statistics
    }
  }

  /**
   * Clean up expired proposals
   */
  static async cleanupExpiredProposals(): Promise<{
    expiredCount: number
    rejectedCount: number
  }> {
    const collection = await this.getProposalsCollection()
    
    const now = new Date()
    
    // Find expired active proposals
    const expiredProposals = await collection.find({
      status: 'active',
      expiresAt: { $lt: now }
    }).toArray()

    let rejectedCount = 0

    for (const proposal of expiredProposals) {
      const totalWeight = proposal.votes.for + proposal.votes.against + proposal.votes.abstain
      const forPercentage = totalWeight > 0 ? (proposal.votes.for / totalWeight) * 100 : 0

      const newStatus = forPercentage >= proposal.passingThreshold && 
                       totalWeight >= proposal.requiredVotes ? 'passed' : 'rejected'
      
      if (newStatus === 'rejected') {
        rejectedCount++
      }

      await collection.updateOne(
        { _id: proposal._id },
        { $set: { status: newStatus } }
      )

      // Update voter reputations
      await this.updateVoterReputationPostExecution(proposal, newStatus === 'passed')
    }

    console.log(`[CommunityVoting] Cleaned up ${expiredProposals.length} expired proposals, ${rejectedCount} rejected`)

    return {
      expiredCount: expiredProposals.length,
      rejectedCount
    }
  }

  // Private helper methods

  private static async getUserReputation(userId: ObjectId): Promise<VoterReputation> {
    const collection = await this.getReputationCollection()
    
    let reputation = await collection.findOne({ userId })
    
    if (!reputation) {
      // Create new reputation record
      reputation = {
        userId,
        walletAddress: 'unknown',
        totalVotes: 0,
        accurateVotes: 0,
        proposalsSubmitted: 0,
        successfulProposals: 0,
        reputationScore: 100, // Starting score
        trustLevel: 'new',
        specializations: [],
        joinedAt: new Date(),
        isActive: true,
        warnings: 0,
        isSuspended: false
      }
      
      await collection.insertOne(reputation)
    }
    
    return reputation
  }

  private static getVotingConfig(
    proposalType: VoteProposal['proposalType'],
    trustLevel: VoterReputation['trustLevel']
  ): {
    requiredVotes: number
    passingThreshold: number
    votingPeriodDays: number
  } {
    const baseConfig = {
      add_entry: { requiredVotes: 10, passingThreshold: 75, votingPeriodDays: 7 },
      remove_entry: { requiredVotes: 15, passingThreshold: 80, votingPeriodDays: 7 },
      modify_entry: { requiredVotes: 8, passingThreshold: 70, votingPeriodDays: 5 },
      promote_to_global: { requiredVotes: 25, passingThreshold: 85, votingPeriodDays: 10 }
    }

    const config = baseConfig[proposalType]

    // Adjust requirements based on proposer trust level
    if (trustLevel === 'expert' || trustLevel === 'moderator') {
      config.requiredVotes = Math.max(5, Math.floor(config.requiredVotes * 0.8))
      config.passingThreshold -= 5
    }

    return config
  }

  private static calculateVoteWeight(reputation: VoterReputation): number {
    let weight = 1.0

    // Base weight adjustments
    if (reputation.reputationScore >= 900) weight = 3.0
    else if (reputation.reputationScore >= 750) weight = 2.5
    else if (reputation.reputationScore >= 500) weight = 2.0
    else if (reputation.reputationScore >= 300) weight = 1.5

    // Trust level bonuses
    switch (reputation.trustLevel) {
      case 'moderator': weight += 1.0; break
      case 'expert': weight += 0.5; break
      case 'trusted': weight += 0.25; break
    }

    // Accuracy bonus
    if (reputation.totalVotes > 10) {
      const accuracyRate = reputation.accurateVotes / reputation.totalVotes
      if (accuracyRate > 0.8) weight += 0.5
    }

    return Math.max(0.1, Math.min(5.0, weight))
  }

  private static async checkAndExecuteProposal(proposal: VoteProposal): Promise<void> {
    const totalWeight = proposal.votes.for + proposal.votes.against + proposal.votes.abstain
    const forPercentage = (proposal.votes.for / totalWeight) * 100

    if (forPercentage >= proposal.passingThreshold && totalWeight >= proposal.requiredVotes) {
      // Auto-execute if criteria met
      try {
        await this.executeProposal(proposal._id!, proposal.proposerId)
      } catch (error) {
        console.error(`[CommunityVoting] Auto-execution failed:`, error)
      }
    }
  }

  private static async updateProposerStats(proposerId: ObjectId): Promise<void> {
    const collection = await this.getReputationCollection()
    await collection.updateOne(
      { userId: proposerId },
      { $inc: { proposalsSubmitted: 1 } }
    )
  }

  private static async updateVoterStats(userId: ObjectId): Promise<void> {
    const collection = await this.getReputationCollection()
    await collection.updateOne(
      { userId },
      { 
        $inc: { totalVotes: 1 },
        $set: { lastVoteAt: new Date() }
      }
    )
  }

  private static async updateVoterReputationPostExecution(
    proposal: VoteProposal,
    wasSuccessful: boolean
  ): Promise<void> {
    const collection = await this.getReputationCollection()

    // Update proposer
    await collection.updateOne(
      { userId: proposal.proposerId },
      { 
        $inc: { 
          successfulProposals: wasSuccessful ? 1 : 0,
          reputationScore: wasSuccessful ? 10 : -5
        }
      }
    )

    // Update voters based on whether their vote aligned with the outcome
    for (const voter of proposal.votes.voters) {
      const alignedWithOutcome = 
        (wasSuccessful && voter.vote === 'for') ||
        (!wasSuccessful && voter.vote === 'against')

      await collection.updateOne(
        { userId: voter.userId },
        { 
          $inc: { 
            accurateVotes: alignedWithOutcome ? 1 : 0,
            reputationScore: alignedWithOutcome ? 2 : -1
          }
        }
      )
    }
  }
}