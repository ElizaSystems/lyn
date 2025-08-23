import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { CommunityVotingService } from '@/lib/services/community-voting-service'
import { authMiddleware } from '@/lib/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const proposalId = searchParams.get('proposalId')
    const userId = searchParams.get('userId')

    switch (action) {
      case 'active_proposals': {
        const proposalType = searchParams.get('type') as any
        const walletAddress = searchParams.get('wallet')
        const limit = parseInt(searchParams.get('limit') || '20')
        const offset = parseInt(searchParams.get('offset') || '0')

        const result = await CommunityVotingService.getActiveProposals({
          proposalType,
          walletAddress: walletAddress || undefined,
          limit,
          offset
        })

        return NextResponse.json(result)
      }

      case 'proposal_details': {
        if (!proposalId) {
          return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 })
        }

        const details = await CommunityVotingService.getProposalDetails(
          new ObjectId(proposalId)
        )

        return NextResponse.json(details)
      }

      case 'user_profile': {
        const targetUserId = userId || authResult.user.userId
        
        const profile = await CommunityVotingService.getUserVotingProfile(
          new ObjectId(targetUserId)
        )

        return NextResponse.json(profile)
      }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['active_proposals', 'proposal_details', 'user_profile']
        }, { status: 400 })
    }
  } catch (error) {
    console.error('[Community Voting API] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'create_proposal': {
        const {
          proposalType,
          targetWalletAddress,
          reason,
          proposedEntry,
          evidence,
          targetEntryId
        } = data

        if (!proposalType || !targetWalletAddress || !reason) {
          return NextResponse.json(
            { error: 'Missing required fields: proposalType, targetWalletAddress, reason' },
            { status: 400 }
          )
        }

        const proposal = await CommunityVotingService.createProposal(
          proposalType,
          targetWalletAddress,
          reason,
          new ObjectId(authResult.user.userId),
          authResult.user.walletAddress,
          proposedEntry,
          evidence,
          targetEntryId ? new ObjectId(targetEntryId) : undefined
        )

        return NextResponse.json({
          proposal,
          message: 'Proposal created successfully and is now open for voting'
        })
      }

      case 'cast_vote': {
        const { proposalId, vote, reason } = data

        if (!proposalId || !vote) {
          return NextResponse.json(
            { error: 'Missing proposalId or vote' },
            { status: 400 }
          )
        }

        if (!['for', 'against', 'abstain'].includes(vote)) {
          return NextResponse.json(
            { error: 'Vote must be "for", "against", or "abstain"' },
            { status: 400 }
          )
        }

        const updatedProposal = await CommunityVotingService.castVote(
          new ObjectId(proposalId),
          new ObjectId(authResult.user.userId),
          authResult.user.walletAddress,
          vote,
          reason
        )

        return NextResponse.json({
          proposal: updatedProposal,
          message: `Vote "${vote}" recorded successfully`
        })
      }

      case 'execute_proposal': {
        const { proposalId } = data

        if (!proposalId) {
          return NextResponse.json(
            { error: 'Missing proposalId' },
            { status: 400 }
          )
        }

        const result = await CommunityVotingService.executeProposal(
          new ObjectId(proposalId),
          new ObjectId(authResult.user.userId)
        )

        if (result.success) {
          return NextResponse.json({
            result: result.result,
            message: 'Proposal executed successfully'
          })
        } else {
          return NextResponse.json({
            error: result.error,
            message: 'Proposal execution failed'
          }, { status: 400 })
        }
      }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['create_proposal', 'cast_vote', 'execute_proposal']
        }, { status: 400 })
    }
  } catch (error) {
    console.error('[Community Voting API] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    )
  }
}