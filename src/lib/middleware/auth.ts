import { NextRequest } from 'next/server'
import { UserService } from '@/lib/services/user-service'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string
    walletAddress: string
  }
}

export async function authenticateUser(request: NextRequest): Promise<{ userId: string; walletAddress: string } | null> {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    return await UserService.validateToken(token)
  } catch (error) {
    console.error('Authentication middleware error:', error)
    return null
  }
}

export function requireAuth(handler: (req: AuthenticatedRequest, user: { userId: string; walletAddress: string }) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    const user = await authenticateUser(req)
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const authReq = req as AuthenticatedRequest
    authReq.user = user

    return handler(authReq, user)
  }
}

export async function authMiddleware(request: NextRequest): Promise<{
  success: boolean;
  user?: { id: string; walletAddress: string };
  error?: string;
}> {
  try {
    const user = await authenticateUser(request)
    
    if (!user) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    return {
      success: true,
      user: {
        id: user.userId,
        walletAddress: user.walletAddress
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error)
    return {
      success: false,
      error: 'Authentication failed'
    }
  }
}