# Lendsqr Wallet Service Backend

A comprehensive wallet service backend built with Node.js, TypeScript, and Express that supports wallet creation, wallet-to-wallet transfers, deposits, withdrawals, and transaction management.

## Table of Contents
- [Project Overview](#project-overview)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [Design Decisions and Architecture](#design-decisions-and-architecture)
- [E-R Diagram](#er-diagram)
- [Technology Stack](#technology-stack)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)

## Project Overview

This is a backend wallet service designed to provide secure and scalable financial transaction capabilities. The service includes:

- User authentication and management
- Wallet creation and balance tracking
- Deposit initialization and confirmation
- Withdrawal processing
- Wallet-to-wallet transfers
- Transaction history and filtering
- Idempotency protection for financial operations
- Rate limiting for security
- Comprehensive logging and error handling

The system is built with TypeScript for type safety and follows RESTful API principles. It uses a relational database (MySQL) for data persistence and Redis for caching and idempotency key storage.

## Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- MySQL database
- Redis server
- npm package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd lendsqr-be-test
```

2. Install dependencies:
```bash
npm install
```

3. Environment Setup:
   - Copy `.env.example` to `.env`
   - Update the environment variables with your configuration:
     ```env
     DB_HOST="localhost"
     DB_USER="root"
     DB_PASSWORD="your_password"
     DB_NAME="lendsqr_test_db"
     DB_PORT=3306
     
     PORT=4000
     
     JWT_SECRET="your_jwt_secret_here"
     
     REDIS_URL="redis://localhost:6379"
     REDIS_HOST="localhost"
     REDIS_PORT="6379"
     REDIS_PASSWORD=""
     
     ADJUTOR_BASE_URL="https://adjutor.lendsqr.com/v2/"
     ADJUTOR_API_KEY="your_adjutor_api_key"
     ADJUTOR_APP_ID="your_adjutor_app_id"
     ```

4. Database Setup:
   - Create the database specified in your `.env` file
   - Run migrations:
     ```bash
     npm run migrate:latest
     ```
   - Run seeds (optional, for initial data):
     ```bash
     npm run seed
     ```

5. Start the development server:
   ```bash
   npm run dev
   ```
   
   For production:
   ```bash
   npm run build
   npm start
   ```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DB_HOST | Database host | Yes |
| DB_USER | Database username | Yes |
| DB_PASSWORD | Database password | Yes |
| DB_NAME | Database name | Yes |
| DB_PORT | Database port | Yes |
| PORT | Server port | No (defaults to 4000) |
| JWT_SECRET | Secret for JWT token signing | Yes |
| ADJUTOR_BASE_URL | Base URL for Adjutor API | Yes |
| ADJUTOR_API_KEY | API key for Adjutor service | Yes |
| ADJUTOR_APP_ID | Application ID for Adjutor service | Yes |

## API Documentation

### Base URL
```
dev: http://localhost:4000/api/v1
```

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Auth Endpoints

#### Register User
- **URL**: `/auth/register`
- **Method**: `POST`
- **Access**: Public (rate limited)
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "User created successfully",
    "data": {
      "user": {
        "id": 1,
        "email": "user@example.com",
        "name": "John Doe",
        "phone": "+1234567890",
        "created_at": "2026-04-01T16:53:24.000Z",
        "updated_at": "2026-04-01T16:53:24.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

#### Login
- **URL**: `/auth/login`
- **Method**: `POST`
- **Access**: Public (rate limited)
- **Request Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Login successful",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

### User Endpoints

#### Get Profile
- **URL**: `/users/me`
- **Method**: `GET`
- **Access**: Private (requires authentication)
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Profile retrieved",
    "data": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "phone": "+1234567890",
      "wallet": {
        "id": 1,
        "user_id": 1,
        "wallet_type": "MAIN",
        "balance": 0,
        "currency": "NGN",
        "created_at": "2026-04-01T16:53:24.000Z",
        "updated_at": "2026-04-01T16:53:24.000Z"
      }
    }
  }
  ```

### Wallet Endpoints

#### Get Wallet Balance
- **URL**: `/wallet/balance`
- **Method**: `GET`
- **Access**: Private (requires authentication)
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Wallet balance retrieved successfully",
    "data": {
      "balance": 0,
      "currency": "NGN"
    }
  }
  ```

### Transaction Endpoints

#### Get Transactions (with filtering and pagination)
- **URL**: `/transactions`
- **Method**: `GET`
- **Access**: Private (requires authentication)
- **Query Parameters**:
  - `transaction_type`: FUNDING, TRANSFER, WITHDRAWAL, REFUND
  - `status`: PENDING, SUCCESSFUL, FAILED
  - `amount_min`: Minimum amount (in NGN)
  - `amount_max`: Maximum amount (in NGN)
  - `date_from`: Start date (ISO format)
  - `date_to`: End date (ISO format)
  - `limit`: Number of records to return (1-100, default 10)
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Transactions retrieved successfully",
    "data": {
      "transactions": [
        {
          "id": 1,
          "type": "FUNDING",
          "status": "SUCCESSFUL",
          "amount": 100000,
          "reference": "txn_123456789",
          "description": "Initial deposit",
          "created_at": "2026-04-01T16:53:24.000Z",
          "updated_at": "2026-04-01T16:53:24.000Z"
        }
      ],
      "pagination": {
        "total": 1,
        "limit": 10,
        "offset": 0
      }
    }
  }
  ```

#### Get Transaction by ID
- **URL**: `/transactions/:id`
- **Method**: `GET`
- **Access**: Private (requires authentication)
- **URL Parameters**:
  - `id`: Transaction ID
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Transaction details retrieved successfully",
    "data": {
      "id": 1,
      "type": "FUNDING",
      "status": "SUCCESSFUL",
      "amount": 100000,
      "reference": "txn_123456789",
      "description": "Initial deposit",
      "created_at": "2026-04-01T16:53:24.000Z",
      "updated_at": "2026-04-01T16:53:24.000Z"
    }
  }
  ```

### Deposit Endpoints

#### Initialize Deposit
- **URL**: `/transactions/deposits/initiate`
- **Method**: `POST`
- **Access**: Private (requires authentication, rate limited)
- **Request Body**:
  ```json
  {
    "amount": 1000.00,
    "currency": "NGN",
    "metadata": {
      "bank_name": "Test Bank",
      "account_number": "1234567890"
    }
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Deposit initialized successfully",
    "data": {
      "reference": "dep_123456789",
      "amount": 1000.00,
      "currency": "NGN",
      "status": "PENDING",
      "created_at": "2026-04-01T16:53:24.000Z"
    }
  }
  ```

#### Confirm Deposit
- **URL**: `/transactions/deposits/confirm`
- **Method**: `POST`
- **Access**: Private (requires authentication)
- **Request Body**:
  ```json
  {
    "reference": "dep_123456789",
    "status": "SUCCESSFUL"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Deposit confirmed successfully",
    "data": {
      "reference": "dep_123456789",
      "amount": 1000.00,
      "currency": "NGN",
      "status": "SUCCESSFUL",
      "created_at": "2026-04-01T16:53:24.000Z",
      "updated_at": "2026-04-01T16:53:24.000Z"
    }
  }
  ```

### Transfer Endpoints

#### Initiate Transfer
- **URL**: `/transactions/transfers`
- **Method**: `POST`
- **Access**: Private (requires authentication, rate limited)
- **Request Body**:
  ```json
  {
    "amount": 500.00,
    "currency": "NGN",
    "reference": "unique_idempotency_key",
    "metadata": {
      "description": "Transfer to friend"
    }
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Transfer initiated successfully",
    "data": {
      "reference": "txn_987654321",
      "amount": 500.00,
      "currency": "NGN",
      "status": "PENDING",
      "created_at": "2026-04-01T16:53:24.000Z"
    }
  }
  ```

### Withdrawal Endpoints

#### Initiate Withdrawal
- **URL**: `/transactions/withdrawals/initiate`
- **Method**: `POST`
- **Access**: Private (requires authentication, rate limited)
- **Request Body**:
  ```json
  {
    "amount": 500.00,
    "currency": "NGN",
    "reference": "unique_idempotency_key",
    "metadata": {
      "bank_name": "Test Bank",
      "account_number": "1234567890"
    }
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Withdrawal initiated successfully",
    "data": {
      "reference": "txn_111222333",
      "amount": 500.00,
      "currency": "NGN",
      "status": "PENDING",
      "created_at": "2026-04-01T16:53:24.000Z"
    }
  }
  ```

#### Confirm Withdrawal
- **URL**: `/transactions/withdrawals/confirm`
- **Method**: `POST`
- **Access**: Private (requires authentication)
- **Request Body**:
  ```json
  {
    "reference": "txn_111222333",
    "status": "SUCCESSFUL"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Withdrawal confirmed successfully",
    "data": {
      "reference": "txn_111222333",
      "amount": 500.00,
      "currency": "NGN",
      "status": "SUCCESSFUL",
      "created_at": "2026-04-01T16:53:24.000Z",
      "updated_at": "2026-04-01T16:53:24.000Z"
    }
  }
  ```

### Response Format

All API responses follow a standardized format:

#### Success Response
```json
{
  "status": "success",
  "message": "Description of what happened",
  "data": {}
}
```

#### Error Response
```json
{
  "status": "error",
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 429: Too Many Requests
- 500: Internal Server Error

## Design Decisions and Architecture

### Architectural Overview

The application follows a modular, layered architecture:

```
src/
├── configs/          # Configuration files (database, environment, routes)
├── database/         # Database migrations and seeds
├── middlewares/      # Custom Express middlewares
├── modules/          # Feature-based modules
│   ├── Auth/         # Authentication module
│   ├── User/         # User management
│   ├── Wallet/       # Wallet management
│   ├── Transactions/ # Transaction processing
│   │   ├── Deposit/  # Deposit-specific logic
│   │   ├── Transfer/ # Transfer-specific logic
│   │   └── Withdrawal/ # Withdrawal-specific logic
│   ├── Idempotency/  # Idempotency protection
│   ├── Ledger/       # Ledger entries for accounting
│   └── Karma/        # Additional service (if applicable)
├── types/            # TypeScript type definitions
└── utils/            # Utility functions and helpers
```

### Key Design Decisions

1. **Modular Structure**: Organized by feature rather than by technical layer, making it easier to locate and manage related code.

2. **Database Design**:
   - Balance stored in smallest currency unit (kobo for NGN) to avoid floating-point precision issues
   - Separate tables for users, wallets, transactions, ledger entries, and idempotency keys
   - Proper indexing on frequently queried columns
   - Foreign key constraints with appropriate cascade behaviors

3. **Idempotency Protection**:
   - Implemented for all financial operations (deposits, withdrawals, transfers)
   - Prevents duplicate processing of the same request
   - request hash prevents different request body using the same key

4. **Security Measures**:
   - JWT-based authentication
   - Rate limiting on sensitive endpoints
   - Input validation using Zod schema
   - Password hashing (though not implemented in this version as it's a faux login)
   - Environment-based configuration

5. **Error Handling**:
   - Centralized error handling middleware
   - Custom APIError class for consistent error responses
   - Detailed error logging

6. **Transaction Management**:
   - Atomic operations using database transactions where appropriate
   - Ledger entries for audit trail
   - Support for transaction reversals and refunds

7. **External Service Integration**:
   - Designed to integrate with Adjutor service for payment processing
   - Abstracted service layer for easy replacement/mocking

### Data Flow

1. **User Registration/Login**:
   - Request → Auth Controller → Auth Service → User Service → Database
   - On successful login, JWT token is generated and returned

2. **Financial Operations (Deposit/Withdrawal/Transfer)**:
   - Request → Transaction Controller → Transaction Service → Validation → Idempotency Check → Database Operations → Ledger Entry Creation → Response

3. **Balance Inquiry**:
   - Request → Wallet Controller → Wallet Service → Database Query → Response

## E-R Diagram

![Entity Relationship Diagram](https://via.placeholder.com/800x600.png?text=E-R+Diagram+Placeholder)


### Entities and Relationships

- **Users**: One-to-One with Wallets (each user has one main wallet)
- **Wallets**: One-to-Many with Ledger Entries (each wallet can have multiple ledger entries)
- **Transactions**: One-to-Many with Ledger Entries (each transaction affects multiple wallets via ledger entries)
- **Ledger Entries**: Many-to-One with Wallets and Transactions (each entry belongs to one wallet and one transaction)
- **Idempotency Keys**: Many-to-One with Users (each user can have multiple idempotency keys)
- **Transaction Details**: One-to-One with Transactions (additional details for specific transaction types)

## Technology Stack

### Runtime & Framework
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework for Node.js
- **TypeScript**: Typed superset of JavaScript

### Database & ORM
- **MySQL**: Relational database management system
- **Knex.js**: SQL query builder for Node.js

### Authentication & Security
- **JSON Web Tokens (JWT)**: For authentication
- **bcryptjs**: Password hashing (available but not used in faux login)
- **express-rate-limit**: Rate limiting middleware
- **cors**: Cross-Origin Resource Sharing middleware

### Validation & Type Safety
- **Zod**: TypeScript-first schema validation
- **TypeScript**: Static type checking

### Testing
- **Jest**: JavaScript testing framework
- **ts-jest**: TypeScript preprocessor for Jest

### Logging
- **Winston**: Logging library

### Utilities
- **UUID**: Unique identifier generation
- **axios**: HTTP client for external service requests
- **dotenv**: Environment variable loading
- **tsconfig-paths**: TypeScript path resolution
- **tsc-alias**: Path alias support for compiled JavaScript

### Development Tools
- **ts-node-dev**: Development server with auto-reload
- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting (configuration implied)

## Running Tests

### Test Setup
Ensure you have a test database configured (can be same as development but recommended to use separate).

### Running All Tests
```bash
npm run test
```

### Running Tests with Coverage
```bash
npm run test:coverage
```

### Test File Structure
Tests are located in the `src/tests/` directory:
- `helpers.test.ts`: Utility function tests
- `Karma.service.test.ts`: Service-specific tests

### Writing Tests
Follow the existing test patterns:
- Use `describe` blocks to group related tests
- Use `it` blocks for individual test cases
- Mock external dependencies when necessary
- Clean up test data after each test when appropriate

## Project Structure

```
lendsqr-be-test/
├── src/                    # Source code
│   ├── app.ts              # Express app configuration
│   ├── server.ts           # Server entry point
│   ├── knexfile.ts         # Knex configuration
│   │
│   ├── configs/            # Configuration files
│   │   ├── db.ts           # Database configuration
│   │   ├── env.ts          # Environment variable validation
│   │   └── routes.ts       # API route definitions
│   │
│   ├── database/           # Database files
│   │   ├── migrations/     # Database migration files
│   │   └── seeds/          # Database seed files
│   │
│   ├── middlewares/        # Custom Express middlewares
│   │   ├── errorHandler.ts # Centralized error handling
│   │   ├── rateLimiter.ts  # Rate limiting middleware
│   │   ├── responseTimer.ts # Response timing middleware
│   │   └── validation.middleware.ts # Request validation
│   │
│   ├── modules/            # Feature modules
│   │   ├── Auth/           # Authentication module
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.type.ts
│   │   │
│   │   ├── User/           # User management
│   │   │   ├── user.controller.ts
│   │   │   ├── user.routes.ts
│   │   │   ├── user.service.ts
│   │   │   └── user.type.ts
│   │   │
│   │   ├── Wallet/         # Wallet management
│   │   │   ├── wallet.controller.ts
│   │   │   ├── wallet.routes.ts
│   │   │   ├── wallet.service.ts
│   │   │   └── wallet.type.ts
│   │   │
│   │   ├── Transactions/   # Transaction processing
│   │   │   ├── transaction.controller.ts
│   │   │   ├── transaction.routes.ts
│   │   │   ├── transaction.service.ts
│   │   │   └── transaction.type.ts
│   │   │   │
│   │   │   ├── Deposit/    # Deposit-specific
│   │   │   │   ├── deposit.controller.ts
│   │   │   │   ├── deposit.routes.ts
│   │   │   │   ├── deposit.service.ts
│   │   │   │   └── deposit.type.ts
│   │   │   │
│   │   │   ├── Transfer/   # Transfer-specific
│   │   │   │   ├── transfer.controller.ts
│   │   │   │   ├── transfer.routes.ts
│   │   │   │   ├── transfer.service.ts
│   │   │   │   └── transfer.type.ts
│   │   │   │
│   │   │   └── Withdrawal/ # Withdrawal-specific
│   │   │       ├── withdrawal.controller.ts
│   │   │       ├── withdrawal.routes.ts
│   │   │       ├── withdrawal.service.ts
│   │   │       └── withdrawal.type.ts
│   │   │
│   │   ├── Idempotency/    # Idempotency protection
│   │   │   ├── idempotency.middleware.ts
│   │   │   ├── idempotency.service.ts
│   │   │   └── idempotency.type.ts
│   │   │
│   │   ├── Ledger/         # Ledger entries
│   │   │   ├── ledger.repo.ts
│   │   │   ├── ledger.service.ts
│   │   │   └── ledger.type.ts
│   │   │
│   │   └── Karma/          # Additional service
│   │       ├── karma.service.ts
│   │       └── karma.type.ts
│   │
│   ├── types/              # TypeScript type definitions
│   │   └── express.d.ts    # Express type extensions
│   │
│   └── utils/              # Utility functions
│       ├── APIError.ts     # Custom error class
│       ├── APIResponse.ts  # Standardized response helper
│       ├── helpers.ts      # Utility functions
│       └── logger.ts       # Logging configuration
│
├── tests/                  # Test files
│   ├── helpers.test.ts
│   └── Karma.service.test.ts
|   |__ 
│
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
├── package.json            # Project dependencies and scripts
├── package-lock.json       # Dependency lock file
├── README.md               # This file
└── tsconfig.json           # TypeScript configuration
```

### Key Directories Explained

- **src/modules**: Contains feature-based modules, each with its own controller, routes, service, and type files
- **src/database/migrations**: Contains SQL migration files for database schema evolution
- **src/database/seeds**: Contains seed data for initial database population
- **src/middlewares**: Contains custom Express middleware functions
- **src/utils**: Contains utility classes and helper functions used across the application
- **src/types**: Contains TypeScript type definitions and extensions

### Naming Conventions
- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic
- **Routes**: Define API endpoints and connect them to controllers
- **Types**: Define TypeScript interfaces and types
- **Middleware**: Functions that execute during the request-response cycle
- **Repositories**: Handle data access patterns (used in some modules)

## License

This project is licensed under the ISC License 

## Author

Chimdike Anagboso

## Acknowledgments

- Built as part of the Lendsqr backend engineering assessment
- Uses various open-source libraries and frameworks