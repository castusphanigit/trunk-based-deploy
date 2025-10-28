# Customer Portal Backend API

A comprehensive Node.js backend API for a customer portal system built with Express.js, TypeScript, and Prisma ORM. This API provides secure authentication, user management, billing, invoicing, and fleet management capabilities.

## Features

### Core Functionality

- **Authentication & Authorization**: Auth0 integration with JWT tokens and role-based access control
- **User Management**: Complete user CRUD operations with customer-specific user management
- **Account Management**: Multi-tenant account system with hierarchical relationships
- **Fleet Management**: Equipment and vehicle management with telematics integration
- **File Management**: Secure file upload and download with AWS S3 integration
- **Reporting**: Excel and PDF export capabilities for various data types

### Security Features

- **Rate Limiting**: Configurable rate limiting for different endpoint types
- **Input Validation**: Comprehensive input validation using express-validator
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **CORS Configuration**: Configurable CORS settings for cross-origin requests
- **Environment-based Configuration**: Secure environment variable management
- **File Upload Security**: Secure file upload with memory limits and content validation
- **Memory Protection**: Safe content length limits to prevent memory exhaustion attacks

## 🛠️ Tech Stack

### Backend Framework

- **Node.js**: Runtime environment
- **Express.js**: Web application framework
- **TypeScript**: Type-safe JavaScript development
- **Prisma**: Modern database ORM

### Database

- **PostgreSQL**: Primary database
- **Prisma Client**: Type-safe database access

### Authentication & Security

- **Auth0**: Identity and access management
- **JWT**: JSON Web Tokens for authentication
- **bcrypt**: Password hashing
- **express-rate-limit**: API rate limiting

### File Processing

- **AWS S3**: Cloud storage for file uploads
- **ExcelJS**: Excel file generation and processing
- **PDFKit**: PDF generation
- **Multer**: Secure file upload handling with memory storage protection

### Email & Notifications

- **SendGrid**: Email service integration
- **Nodemailer**: Email sending capabilities

### Development Tools

- **ESLint**: Code linting and formatting
- **Nodemon**: Development server with hot reload
- **Swagger**: API documentation generation

## 📁 Project Structure

```
src/
├── api/
│   ├── controllers/          # Request handlers
│   │   ├── account.controller.ts
│   │   ├── auth.controller.ts
│   │   ├── roles.controller.ts
│   │   ├── users.controller.ts
│   │   └── ...
│   ├── middleware/           # Custom middleware
│   │   ├── auth.middleware.ts
│   │   ├── auth0.middleware.ts
│   │   ├── rateLimit.middleware.ts
│   │   └── validation.middleware.ts
│   ├── routes/              # API route definitions
│   │   ├── account.routes.ts
│   │   ├── auth.routes.ts
│   │   ├── roles.routes.ts
│   │   ├── users.routes.ts
│   │   └── ...
│   └── validators/          # Input validation schemas
│       ├── account.validator.ts
│       ├── auth.validator.ts
│       ├── payment.validator.ts
│       ├── user.validator.ts
│       └── ...
├── config/                  # Configuration files
│   ├── database.config.ts   # Database configuration
│   ├── env.config.ts        # Environment variable management
│   ├── route-screens.config.ts
│   └── secondarydb.config.ts
├── services/                # Business logic layer
│   ├── account.service.ts
│   ├── auth.service.ts
│   └── ...
├── types/                   # TypeScript type definitions
│   ├── common/              # Common types
│   │   ├── pagination.types.ts
│   │   ├── request.types.ts
│   │   └── response.types.ts
│   ├── dtos/                # Data Transfer Objects
│   │   ├── account.dto.ts
│   │   ├── auth.dto.ts
│   │   ├── user.dto.ts
│   │   └── ...
│   ├── invoice.types.ts
│   ├── payment.types.ts
│   └── sorts/               # Sorting configurations
│       └── sortTypes.ts
├── utils/                   # Utility functions
│   ├── asyncHandler.ts
│   └── sort.ts
└── views/                   # Email templates
    └── emails/
        └── auth0welcome.ejs
```

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **PostgreSQL** database
- **Auth0** account (for authentication)
- **AWS S3** bucket (for file storage)
- **SendGrid** account (for email services)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd CustomerPortal_BE
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:

   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/customer_portal"

   # Auth0 Configuration
   AUTH0_DOMAIN="your-domain.auth0.com"
   AUTH0_AUDIENCE="your-api-identifier"
   AUTH0_ISSUER="https://your-domain.auth0.com/"

   # JWT
   JWT_SECRET="your-jwt-secret"

   # AWS S3
   AWS_ACCESS_KEY_ID="your-access-key"
   AWS_SECRET_ACCESS_KEY="your-secret-key"
   AWS_REGION="us-east-1"
   AWS_S3_BUCKET="your-bucket-name"

   # SendGrid
   SENDGRID_API_KEY="your-sendgrid-api-key"
   SENDGRID_FROM_EMAIL="noreply@yourdomain.com"

   # CORS
   ALLOWED_ORIGINS="http://localhost:3000,https://yourdomain.com"

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS="900000"
   RATE_LIMIT_MAX_REQUESTS="100"

   # File Upload Security
   MAX_FILE_SIZE_MB="8"
   MAX_FILES_PER_REQUEST="10"
   MAX_TOTAL_REQUEST_SIZE_MB="100"

   # Server
   PORT="3000"
   NODE_ENV="development"
   ```

4. **Database Setup**

   ```bash
   # Generate Prisma client
   npm run prisma:generate

   # Run database migrations
   npm run prisma:migrate

   # Seed the database (optional)
   npm run prisma:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Rate Limiting

The API implements rate limiting with different limits for different endpoint types:

- **General API**: 100 requests per 15 minutes
- **Authentication**: 100 requests per 15 minutes
- **File Uploads**: 10 uploads per 15 minutes
- **Downloads**: 20 downloads per 15 minutes
- **Sensitive Operations**: 10 operations per 15 minutes

### File Upload Security

The API implements comprehensive file upload security measures to prevent memory exhaustion attacks:

- **Individual File Size Limit**: 8MB per file
- **Files Per Request Limit**: Maximum 10 files per request
- **Total Request Size Limit**: 100MB total size for all files combined
- **Memory Storage Protection**: Safe content length validation before processing
- **Field Size Limits**: 1MB limit for form field values
- **Field Name Size Limit**: 100 characters maximum for field names
- **Multipart Parts Limit**: Maximum 20 parts per multipart form

### Main API Endpoints

#### Authentication (`/api/auth`)

- `POST /login` - User login
- `POST /exchange-token` - Token exchange
- `POST /logout` - User logout

#### Users (`/api/user`)

- `GET /tenant` - Get all tenant users
- `GET /customerUserAccounts/:userId` - Get user accounts
- `POST /` - Create new user
- `PUT /:userId` - Update user
- `DELETE /:userId` - Delete user
- `POST /download` - Export users to Excel

#### Accounts (`/api/account`)

- `GET /customer/:customerId` - Get customer accounts
- `GET /customerUserAccounts/:userId` - Get user accounts
- `POST /secondaryContact` - Add secondary contact
- `POST /download` - Export accounts to Excel

#### Roles (`/api/roles`)

- `GET /customer/:customerId` - Get customer roles
- `POST /` - Create new role
- `PUT /` - Update role
- `GET /:roleId` - Get role by ID

#### Invoices (`/api/invoices`)

- `GET /` - Get all invoices
- `GET /stats` - Get invoice statistics
- `POST /download` - Export invoices to Excel

#### Payments (`/api/payments`)

- `GET /` - Get all payments
- `GET /stats` - Get payment statistics
- `POST /download` - Export payments to Excel

#### Billing (`/api/billing`)

- `GET /` - Get billing information
- `POST /download` - Export billing data

#### File Upload (`/api/fileupload`)

- `POST /` - Upload files to S3

## 🔧 Available Scripts

### Development

```bash
npm run dev          # Start development server
npm run dev:hot      # Start with hot reload
npm run build        # Build for production
npm run start        # Start production server
```

### Database

```bash
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run database migrations
npm run prisma:studio      # Open Prisma Studio
npm run prisma:push        # Push schema changes
npm run prisma:reset       # Reset database
npm run prisma:seed        # Seed database
```

### Code Quality

```bash
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

## Architecture

### Layered Architecture

The application follows a clean layered architecture:

1. **Controllers**: Handle HTTP requests and responses
2. **Services**: Contain business logic and data processing
3. **Repositories**: Database access through Prisma ORM
4. **Middleware**: Request processing and validation
5. **Utils**: Shared utility functions

### Security Implementation

- **Authentication**: Auth0 JWT-based authentication
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: Comprehensive validation using express-validator
- **Rate Limiting**: Configurable rate limiting per endpoint type
- **CORS**: Configurable cross-origin resource sharing
- **SQL Injection Prevention**: Prisma ORM with parameterized queries

### Error Handling

- Centralized error handling middleware
- Custom error types with appropriate HTTP status codes
- Detailed error logging for debugging
- User-friendly error messages

## Security Considerations

### File Upload Security Implementation

The application addresses the critical security concern of `multer.memoryStorage()` by implementing comprehensive content length validation and memory protection:

#### Memory Storage Protection
```typescript
// Safe file size limits to prevent memory exhaustion attacks
const MAX_FILE_SIZE_MB = 8;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10;
const MAX_TOTAL_REQUEST_SIZE_MB = 100;
const MAX_TOTAL_REQUEST_SIZE_BYTES = MAX_TOTAL_REQUEST_SIZE_MB * 1024 * 1024;

export const FileUploadToS3 = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_REQUEST,
    fieldSize: 1024 * 1024, // 1MB limit for field values
    fieldNameSize: 100, // Limit field name length
    parts: 20, // Limit number of parts in multipart form
  }
});
```

#### Content Length Validation
```typescript
// Middleware to validate total request size before processing
export const validateRequestSize = (req: Request, res: Response, next: NextFunction): void => {
  const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
  
  if (contentLength > MAX_TOTAL_REQUEST_SIZE_BYTES) {
    res.status(413).json({
      error: 'Request too large',
      message: `Request size exceeds maximum allowed size of ${MAX_TOTAL_REQUEST_SIZE_MB}MB`,
      maxSize: MAX_TOTAL_REQUEST_SIZE_MB
    });
    return;
  }
  
  next();
};
```

#### Security Benefits
- **Memory Exhaustion Prevention**: Limits prevent attackers from uploading massive files that could exhaust server memory
- **Resource Protection**: Multiple layers of validation ensure server resources are protected
- **DoS Attack Mitigation**: Content length validation happens before file processing begins
- **Configurable Limits**: All limits are configurable through environment variables

### Authentication & Authorization

- JWT token validation on all protected routes
- Role-based permissions for different operations
- Secure token exchange with Auth0
- Password hashing using bcrypt

### Data Protection

- Input sanitization and validation
- SQL injection prevention through Prisma ORM
- XSS protection through proper data handling
- Secure file upload with type validation and memory limits
- Content length validation to prevent memory exhaustion attacks
- File size and count limits to prevent resource abuse

### API Security

- Rate limiting to prevent abuse
- CORS configuration for cross-origin requests
- Request size limits with content length validation
- Secure headers implementation
- Memory storage protection for file uploads
- Multipart form data validation and limits

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key entities include:

- **Users**: User accounts with role-based permissions
- **Customers**: Customer organizations
- **Accounts**: Customer account hierarchies
- **Invoices**: Billing and invoicing data
- **Payments**: Payment tracking and management
- **Equipment**: Fleet and equipment management
- **Roles**: User role definitions and permissions

## Deployment

### Production Build

```bash
npm run build
npm run start-prod
```

### Docker Deployment

The project includes a Dockerfile for containerized deployment:

```bash
docker build -t customer-portal-api .
docker run -p 3000:3000 customer-portal-api
```

### Environment Variables

Ensure all required environment variables are set in production:

- Database connection string
- Auth0 configuration
- AWS S3 credentials
- SendGrid API key
- CORS allowed origins

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Follow TypeScript best practices
- Use ESLint for code formatting
- Write comprehensive JSDoc comments
- Follow the existing project structure
- Ensure all tests pass

## Troubleshooting

### Multer Memory Storage Security Issue

If you encounter the SonarQube security warning about `multer.memoryStorage()` content length limits, ensure the following security measures are in place:

#### Required Security Configuration
1. **Set File Size Limits**: Configure `MAX_FILE_SIZE_BYTES` in your environment
2. **Set Request Size Limits**: Configure `MAX_TOTAL_REQUEST_SIZE_BYTES` 
3. **Use Content Length Validation**: Implement `validateRequestSize` middleware
4. **Configure Multer Limits**: Set all required limits in multer configuration

#### Environment Variables
```env
# File Upload Security
MAX_FILE_SIZE_MB="8"
MAX_FILES_PER_REQUEST="10"
MAX_TOTAL_REQUEST_SIZE_MB="100"
```

#### Implementation Checklist
- ✅ Individual file size limit (8MB)
- ✅ Maximum files per request (10)
- ✅ Total request size limit (100MB)
- ✅ Content length validation middleware
- ✅ Field size limits (1MB)
- ✅ Field name size limits (100 chars)
- ✅ Multipart parts limit (20)

#### Common Issues
- **Memory Exhaustion**: Ensure all size limits are properly configured
- **Request Timeout**: Check that content length validation is applied before multer processing
- **File Upload Failures**: Verify that limits are reasonable for your use case

**Built with ❤️ by the Customer Portal Development Team**
