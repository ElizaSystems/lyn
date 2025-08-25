/**
 * Test Setup File
 */

import '@testing-library/jest-dom'

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS = 'test-mint-address'
process.env.NEXT_PUBLIC_SOLANA_RPC = 'https://api.devnet.solana.com'
process.env.OPENAI_API_KEY = 'test-openai-key'

// Mock fetch for tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    status: 200
  })
) as jest.Mock

// Mock console methods to reduce noise in tests
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = jest.fn((message) => {
    if (
      !message?.includes('MongoClient') &&
      !message?.includes('OpenAI')
    ) {
      originalError(message)
    }
  })
  
  console.warn = jest.fn((message) => {
    if (!message?.includes('API key not configured')) {
      originalWarn(message)
    }
  })
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})