import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.MONGODB_DB_NAME = 'test'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.NODE_ENV = 'test'

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeAll(() => {
  console.error = jest.fn()
  console.warn = jest.fn()
})

afterAll(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})