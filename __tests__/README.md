# Test Suite Documentation

This directory contains comprehensive test suites for the LYN AI MongoDB integration and user-based storage system.

## Test Structure

```
__tests__/
├── utils/
│   ├── test-db.ts          # MongoDB test database setup
│   └── test-helpers.ts     # Common test utilities
├── lib/
│   ├── mongodb.test.ts     # MongoDB connection tests
│   ├── services/
│   │   └── user-service.test.ts  # User service tests
│   └── middleware/
│       └── auth.test.ts    # Authentication middleware tests
├── app/
│   └── api/
│       └── tasks.test.ts   # Tasks API endpoint tests
├── integration/
│   └── complete-workflow.test.ts  # End-to-end integration tests
└── README.md              # This file
```

## Test Categories

### Unit Tests (`__tests__/lib/`)
- **MongoDB Connection Tests**: Test database connectivity, operations, and error handling
- **User Service Tests**: Test user authentication, task management, and wallet operations
- **Authentication Middleware Tests**: Test JWT validation, token extraction, and auth flows

### API Tests (`__tests__/app/api/`)
- **Tasks API Tests**: Test CRUD operations, authentication, and error scenarios

### Integration Tests (`__tests__/integration/`)
- **Complete Workflow Tests**: End-to-end testing of user task lifecycle

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### CI Mode (for continuous integration)
```bash
npm run test:ci
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

## Test Database

Tests use MongoDB Memory Server for isolated testing:
- Each test suite gets a fresh in-memory MongoDB instance
- No external database dependencies
- Tests are completely isolated from each other
- Automatic cleanup after test completion

## Test Utilities

### `test-db.ts`
- `setupTestDb()`: Creates a new in-memory MongoDB instance
- `teardownTestDb()`: Cleans up and stops the MongoDB instance
- `clearTestDb()`: Clears all collections for test isolation
- `getTestDb()`: Returns the current test database instance

### `test-helpers.ts`
- `generateTestWallet()`: Creates a test Solana wallet keypair
- `signMessage()`: Signs a message with a test wallet
- `createTestUser()`: Creates test user data
- `createTestTask()`: Creates test task data
- `mockRequest()`: Creates mock Next.js request objects
- `expectValidObjectId()`: Validates MongoDB ObjectId format

## Test Coverage Areas

### Authentication & Authorization
- ✅ Wallet signature verification
- ✅ JWT token creation and validation
- ✅ Session management
- ✅ User isolation and security
- ✅ Rate limiting
- ✅ Error handling

### Database Operations
- ✅ MongoDB connection management
- ✅ CRUD operations
- ✅ Data validation
- ✅ Concurrent operation handling
- ✅ Error scenarios
- ✅ Index usage and aggregation

### API Endpoints
- ✅ Tasks CRUD operations
- ✅ Request validation
- ✅ Response formatting
- ✅ Error handling
- ✅ Authentication integration

### User Management
- ✅ User creation and updates
- ✅ Task management
- ✅ Wallet management
- ✅ Data isolation between users

### Integration Scenarios
- ✅ Complete task lifecycle
- ✅ Multi-user scenarios
- ✅ Concurrent operations
- ✅ Database state consistency
- ✅ Error recovery

## Mocking Strategy

The test suite uses strategic mocking to isolate components:

1. **MongoDB Connection**: Mocked to use test database instance
2. **Authentication**: Mocked to provide controlled user contexts
3. **External Services**: Mocked to prevent external dependencies
4. **Next.js Requests**: Mocked for consistent API testing

## Environment Variables

Test environment uses these variables:
```env
MONGODB_URI=mongodb://localhost:27017/test
MONGODB_DB_NAME=test
JWT_SECRET=test-jwt-secret
NODE_ENV=test
```

## Best Practices

1. **Isolation**: Each test is completely isolated with fresh data
2. **Cleanup**: Automatic cleanup prevents test interference
3. **Mocking**: Strategic mocking eliminates external dependencies
4. **Coverage**: Comprehensive coverage of success and error paths
5. **Documentation**: Clear test descriptions and expected outcomes
6. **Performance**: Fast execution with in-memory database

## Adding New Tests

When adding new tests:

1. Use appropriate test utilities from `test-helpers.ts`
2. Follow the existing mocking patterns
3. Clear test data in `beforeEach` hooks
4. Test both success and error scenarios
5. Include integration tests for complex workflows
6. Update this README with new test categories

## Continuous Integration

The test suite is integrated into the CI pipeline:
- Runs on every commit
- Generates coverage reports
- Fails the build if tests don't pass
- Includes linting and formatting checks

## Debugging Tests

For debugging failed tests:

1. Use `test:watch` mode for immediate feedback
2. Check console output for error details
3. Use `console.log` or debugger statements
4. Verify mock implementations
5. Check test database state if needed

## Performance

Test suite performance metrics:
- Setup time: ~500ms (MongoDB Memory Server)
- Individual test execution: ~10-100ms
- Full suite: ~30-60 seconds
- Memory usage: ~100MB (in-memory database)