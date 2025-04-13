# Bill Vending API

A backend service for bill vending that allows users to purchase electricity using a funded wallet. The system handles transactions asynchronously, supports event-driven processing, and ensures proper failure handling and concurrency control.

## Architecture Overview

The system is built using TypeScript with NestJS framework and follows these architectural principles:

1. **Clean Architecture**: 
   - Separation of concerns using modules, services, and controllers
   - Domain-driven design with entities representing the core domain models

2. **Asynchronous Processing**:
   - Transaction processing using Bull queues and Redis
   - Event-driven architecture for handling transaction events
   - Background workers for transaction processing

3. **Concurrency Control**:
   - Optimistic locking for wallet balance updates
   - Database transactions to ensure data consistency

4. **Error Handling & Rollback**:
   - Comprehensive error handling throughout the application
   - Automatic rollback mechanism for failed transactions
   - Structured logging for tracing and debugging

## Key Components

- **Users**: User management and authentication
- **Wallets**: Wallet creation, funding, and balance management
- **Transactions**: Transaction processing and tracking
- **Bill Payments**: Electricity bill payment functionality
- **Queues**: Asynchronous processing of transactions

## ERD (Entity Relationship Diagram)

```
User
  ↓
  ↓ 1:1
  ↓
Wallet
  ↓
  ↓ 1:N
  ↓
Transaction ← → BillPayment (1:1)
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - User login

### Wallet Management
- `GET /wallets` - Get wallet balance
- `POST /wallets/fund` - Fund wallet

### Bill Payments
- `POST /bill-payments` - Create bill payment
- `GET /bill-payments` - Get user bill payments
- `GET /bill-payments/:id` - Get bill payment by ID

### Transactions
- `GET /transactions` - Get user transactions
- `GET /transactions/:id` - Get transaction by ID

## Technical Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with TypeORM
- **Queue**: Bull with Redis
- **Authentication**: JWT
- **Documentation**: Swagger (OpenAPI)
- **Testing**: Jest
- **Containerization**: Docker

## Getting Started

### Prerequisites

- Node.js 16+
- Docker and Docker Compose
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/bill-vending-api.git
   cd bill-vending-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Start the development environment:
   ```bash
   docker-compose up -d
   ```

5. Run migrations:
   ```bash
   npm run migration:run
   ```

6. Start the application:
   ```bash
   npm run start:dev
   ```

7. Access the Swagger documentation:
   ```
   http://localhost:3000/api/docs
   ```

## Running Tests

Run unit tests:
```bash
npm run test
```

Run e2e tests:
```bash
npm run test:e2e
```

## Logging and Monitoring

The application uses NestJS's built-in logger for logging. In production, you might want to configure a more robust logging solution like Winston or ELK stack.

## Concurrency Handling

The application handles concurrency issues with:

1. **Optimistic Locking**: The Wallet entity includes a version field for optimistic locking
2. **Database Transactions**: Used for critical operations
3. **Idempotent Operations**: Transaction IDs are used to prevent duplicate processing

## Security

- **Helmet**: HTTP security headers
- **CORS**: Cross-Origin Resource Sharing configuration
- **JWT**: Token-based authentication
- **Input Validation**: Request validation using class-validator
- **Environment Variables**: Sensitive data managed through environment variables