# Bill Vending Service Backend

A robust backend service for electricity bill vending that allows users to purchase electricity using a funded wallet. This system handles transactions asynchronously, supports event-driven processing, and ensures proper failure handling and concurrency control.

## Architecture Overview

![Architecture Diagram](https://via.placeholder.com/800x500)

### System Components

1. **User & Authentication System**
   - User registration and authentication
   - JWT-based security
   - Session management

2. **Wallet Management System**
   - Wallet funding
   - Balance checking
   - Transaction history

3. **Bill Payment System**
   - Initiating bill payments
   - Processing payments asynchronously
   - Handling external API communication

4. **Transaction Processing**
   - Queue-based asynchronous processing
   - Event-driven architecture
   - Automatic rollback mechanisms

5. **Concurrency Control**
   - Optimistic locking for transactions
   - Idempotent operations
   - Race condition prevention

## Technical Stack

- **Framework**: NestJS (Node.js with TypeScript)
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Queue System**: Bull with Redis
- **API Documentation**: Swagger
- **Testing**: Jest
- **Containerization**: Docker & Docker Compose
- **Logging**: Winston with structured logging

## Data Models

### User
- id: UUID
- email: string
- password: string (hashed)
- createdAt: Date
- updatedAt: Date

### Wallet
- id: UUID
- userId: UUID
- balance: decimal
- version: number (for optimistic locking)
- createdAt: Date
- updatedAt: Date

### Transaction
- id: UUID
- walletId: UUID
- type: enum (FUNDING, PAYMENT, REVERSAL)
- amount: decimal
- status: enum (PENDING, COMPLETED, FAILED, REVERSED)
- reference: string
- metadata: JSON
- createdAt: Date
- updatedAt: Date

### BillPayment
- id: UUID
- userId: UUID
- transactionId: UUID
- meterNumber: string
- amount: decimal
- provider: string
- status: enum (PENDING, COMPLETED, FAILED)
- reference: string
- token?: string
- createdAt: Date
- updatedAt: Date

## API Endpoints

### Authentication
- POST `/api/users/register` - Register a new user
- POST `/api/users/login` - Login and get access token

### Wallet Management
- GET `/api/wallets/balance` - Get wallet balance
- POST `/api/wallets/fund` - Fund wallet
- GET `/api/wallets/transactions` - Get transaction history

### Bill Payment
- POST `/api/bills/pay` - Initiate bill payment
- GET `/api/bills/:id` - Get bill payment details
- GET `/api/bills` - Get bill payment history

### Transactions
- GET `/api/transactions/:id` - Get transaction details
- GET `/api/transactions` - Get all transactions

## Async Processing & Event Handling

The system uses a queue-based approach for asynchronous transaction processing:

1. When a bill payment is initiated, funds are locked in the wallet and a transaction is created with PENDING status
2. The payment request is queued in a Bull queue
3. A worker processes the payment by calling the external bill payment API
4. On successful payment, the transaction is marked as COMPLETED
5. On failure, a reversal event is triggered, and the transaction is marked as FAILED
6. The reversal event is processed by another worker that returns the funds to the wallet and marks the transaction as REVERSED

## Concurrency Control

To handle concurrency and prevent race conditions:

1. **Optimistic Locking**: The wallet entity includes a version field that is used to prevent simultaneous updates
2. **Idempotency**: All operations accept and return a client-generated reference ID to prevent duplicate transactions
3. **Database Transactions**: Critical operations are wrapped in database transactions to ensure data consistency

## Error Handling & Logging

The system implements comprehensive error handling:

1. **Structured Logging**: All operations are logged with request IDs, user IDs, and other contextual information
2. **Error Classification**: Errors are classified as client errors (4xx) or server errors (5xx)
3. **Automatic Retries**: Failed external API calls are automatically retried with exponential backoff
4. **Alerting**: Critical failures trigger alerts (configurable)

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- Docker and Docker Compose
- PostgreSQL (if running without Docker)
- Redis (if running without Docker)

### Environment Variables

Create a `.env` file with the following variables:

```
# Application
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=billvending

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=1d

# External API (mock)
EXTERNAL_API_URL=https://mock-api.example.com
EXTERNAL_API_KEY=your_api_key
```

### Running with Docker

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/bill-vending-service.git
   cd bill-vending-service
   ```

2. Build and start the containers:
   ```bash
   docker-compose up -d
   ```

3. The API will be available at http://localhost:3000
4. Swagger documentation will be available at http://localhost:3000/api/docs

### Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/bill-vending-service.git
   cd bill-vending-service
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start PostgreSQL and Redis (or use Docker for just these services)
   ```bash
   docker-compose up -d postgres redis
   ```

4. Run database migrations:
   ```bash
   npm run migration:run
   ```

5. Start the development server:
   ```bash
   npm run start:dev
   ```

6. The API will be available at http://localhost:3000
7. Swagger documentation will be available at http://localhost:3000/api/docs

## Testing

### Unit Tests

```bash
npm run test
```

### Integration Tests

```bash
npm run test:e2e
```

### Test Coverage

```bash
npm run test:cov
```

## API Documentation

Comprehensive API documentation is available via Swagger UI at `/api/docs` when the application is running.

## Key Design Decisions

1. **Event-Driven Architecture**: The system uses events and queues to decouple critical operations and ensure system resilience.

2. **Optimistic Concurrency Control**: The wallet service uses optimistic locking to prevent race conditions when multiple transactions are processed simultaneously.

3. **Idempotent API Design**: All payment endpoints accept client-generated IDs to prevent duplicate transactions.

4. **Comprehensive Transaction States**: Transactions go through well-defined states (PENDING, COMPLETED, FAILED, REVERSED) to ensure consistency.

5. **Automatic Rollbacks**: If a payment fails after funds are deducted, an automatic rollback process returns the funds to the wallet.

## Improvements & Future Work

1. **Distributed Tracing**: Add distributed tracing for better debugging and performance monitoring
2. **Enhanced Security**: Add rate limiting and additional security headers
3. **Metrics Collection**: Implement Prometheus metrics for system monitoring
4. **Caching Strategy**: Implement Redis caching for frequently accessed data
5. **Horizontal Scaling**: Enhance the architecture to support horizontal scaling of workers