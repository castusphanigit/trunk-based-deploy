# Customer Portal Backend - Comprehensive API Documentation

## Overview

This document provides comprehensive API documentation for the Customer Portal Backend system. The API is built with Express.js and TypeScript, using Prisma as the ORM and Auth0 for authentication.

## Base URL

```
http://localhost:3000/api
```

## Authentication

The API uses Auth0 for authentication with JWT tokens. Most endpoints require specific permissions.

### Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## Rate Limiting

- **General routes**: Standard rate limiting
- **Auth routes**: Stricter limits for security
- **File upload routes**: Specific limits for file operations
- **Download routes**: Limited to prevent abuse

---

## Response Format Standards

### Success Response Format

```json
{
  "statusCode": 200,
  "data": {},
  "message": "Success message"
}
```

### Paginated Response Format

```json
{
  "statusCode": 200,
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 10,
    "totalPages": 10
  }
}
```

### Error Response Format

```json
{
  "error": "Error message",
  "statusCode": 400
}
```

### Validation Error Response Format

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Validation error message",
      "param": "field_name",
      "location": "body"
    }
  ]
}
```

---

## API Endpoints

### 1. Authentication (`/api/auth`)

#### POST `/api/auth/login`

Authenticate user with Auth0 reference ID.

**Request Payload:**

```json
{
  "auth_0_reference_id": "string"
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "auth0|123456789",
      "email": "user@example.com",
      "name": "John Doe"
    }
  },
  "message": "Success"
}
```

**Error Response (400):**

```json
{
  "error": "Failed to login: Invalid auth_0_reference_id",
  "statusCode": 400
}
```

**Error Response (500):**

```json
{
  "error": "Internal server error",
  "statusCode": 500
}
```

#### POST `/api/auth/exchangeToken`

Exchange authorization code for access token.

**Request Payload:**

```json
{
  "code": "string"
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600
  },
  "message": "Success"
}
```

**Error Response (400):**

```json
{
  "error": "Authorization code is required",
  "statusCode": 400
}
```

**Error Response (500):**

```json
{
  "error": "Failed to exchange token: Invalid code",
  "statusCode": 500
}
```

---

### 2. User Management (`/api/user`)

#### GET `/api/user/customers`

Get all customers (requires `read:ten-customers` permission).

**Query Parameters:**

- `page`: Page number (default: 1)
- `perPage`: Items per page (default: 10)
- `customer_name`: Filter by customer name
- `customer_class`: Filter by customer class
- `status`: Filter by status
- `reference_number`: Filter by reference number
- `sort`: Sort field

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "customer_name": "ABC Company",
      "customer_class": "Premium",
      "status": "ACTIVE",
      "reference_number": "REF001",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "perPage": 10,
    "totalPages": 5
  }
}
```

**Error Response (401):**

```json
{
  "error": "Unauthorized",
  "statusCode": 401
}
```

#### GET `/api/user/tenUsers`

Get all TEN users (requires `read:user-management-ten-user-list` permission).

**Query Parameters:**

- `page`: Page number (default: 1)
- `perPage`: Items per page (default: 10)
- `name`: Filter by name
- `email`: Filter by email
- `status`: Filter by status
- `designation`: Filter by designation
- `sort`: Sort field

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "status": "ACTIVE",
      "designation": "Manager",
      "is_customer_user": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "perPage": 10,
    "totalPages": 3
  }
}
```

#### GET `/api/user/userDetails/:userId`

Get current user details.

**Path Parameters:**

- `userId`: User ID (number)

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone_number": "+1234567890",
    "designation": "Manager",
    "avatar": "https://example.com/avatar.jpg",
    "status": "ACTIVE",
    "is_customer_user": true,
    "user_role_id": 2,
    "customer_id": 1,
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Success"
}
```

**Error Response (400):**

```json
{
  "error": "User ID missing or invalid",
  "statusCode": 400
}
```

**Error Response (404):**

```json
{
  "error": "User not found",
  "statusCode": 404
}
```

#### POST `/api/user/createUser`

Create new user (requires `write:role` permission).

**Request Payload:**

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone_number": "+1234567890",
  "designation": "Manager",
  "avatar": "https://example.com/avatar.jpg",
  "status": "ACTIVE",
  "is_customer_user": true,
  "user_role_id": 2,
  "customer_id": 1,
  "password": "securePassword123",
  "assigned_account_ids": [1, 2, 3]
}
```

**Success Response (201):**

```json
{
  "statusCode": 201,
  "data": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "status": "ACTIVE",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "201"
}
```

**Validation Error Response (400):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "First name is required",
      "param": "first_name",
      "location": "body"
    },
    {
      "msg": "Valid email is required",
      "param": "email",
      "location": "body"
    }
  ]
}
```

#### PATCH `/api/user/update/:user_id`

Update user (requires `patch:user-management` permission).

**Path Parameters:**

- `user_id`: User ID (number)

**Request Payload:**

```json
{
  "first_name": "John",
  "last_name": "Smith",
  "email": "john.smith@example.com",
  "phone_number": "+1234567890",
  "designation": "Senior Manager",
  "status": "ACTIVE"
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "first_name": "John",
    "last_name": "Smith",
    "email": "john.smith@example.com",
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Success"
}
```

**Error Response (400):**

```json
{
  "error": "Invalid user_id",
  "statusCode": 400
}
```

#### PATCH `/api/user/updateUserStatus/:user_id`

Toggle user status (requires `update:user-management` permission).

**Path Parameters:**

- `user_id`: User ID (number)

**Request Payload:**

```json
{
  "action": "activate"
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "status": "ACTIVE",
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Success"
}
```

#### POST `/api/user/downloadAllTenUsers`

Download all TEN users (requires `download:ten-admin-all-accounts` permission).

**Request Payload:**

```json
{
  "query": {
    "name": "John",
    "status": "ACTIVE",
    "page": 1,
    "perPage": 100
  },
  "columns": [
    {
      "key": "first_name",
      "label": "First Name",
      "type": "string"
    },
    {
      "key": "email",
      "label": "Email",
      "type": "string"
    }
  ]
}
```

**Success Response (200):**

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="ten_users_export.xlsx"
Content-Length: 12345

[Excel file binary data]
```

**Error Response (400):**

```json
{
  "error": "Columns are required",
  "statusCode": 400
}
```

---

### 3. Dashboard (`/api/dashboard`)

#### GET `/api/dashboard/metrics`

Get main dashboard metrics and cards.

**Query Parameters:**

- `account_ids`: Required. Comma-separated string of account IDs (e.g., "1,2,3")

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "totalUnits": 150,
    "activeUnits": 145,
    "inactiveUnits": 5,
    "totalWorkOrders": 25,
    "pendingWorkOrders": 8,
    "completedWorkOrders": 17,
    "totalInvoices": 45,
    "paidInvoices": 30,
    "pendingInvoices": 15,
    "totalPayments": 125000.5,
    "monthlyPayments": 15000.25
  },
  "message": "200"
}
```

**Error Response (400):**

```json
{
  "error": "account_ids query parameter is required (e.g., ?account_ids=1,2,3)",
  "statusCode": 400
}
```

#### GET `/api/dashboard/vmrslist`

Get VMRS list.

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "vmrs_code": "100",
      "description": "Engine",
      "category": "Power Train"
    },
    {
      "id": 2,
      "vmrs_code": "200",
      "description": "Transmission",
      "category": "Power Train"
    }
  ],
  "message": "200"
}
```

#### POST `/api/dashboard/vmrs-metrics`

Get VMRS repair metrics and monthly maintenance costs.

**Request Payload:**

```json
{
  "account_ids": [1, 2, 3],
  "year": 2024,
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "vmrs_codes": [100, 200]
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "repairCounts": {
      "100": 15,
      "200": 8
    },
    "totalCosts": {
      "100": 15000.5,
      "200": 8500.25
    },
    "monthlyBreakdown": [
      {
        "month": "2024-01",
        "count": 5,
        "cost": 5000.0
      }
    ],
    "complianceData": {
      "totalInspections": 25,
      "passedInspections": 23,
      "failedInspections": 2
    }
  },
  "message": "200"
}
```

**Error Response (400):**

```json
{
  "error": "account_ids array is required in request body",
  "statusCode": 400
}
```

---

### 4. Fleet Management (`/api/fleet`)

#### GET `/api/fleet/getListView`

Get fleet list view (requires `read:fleet-list-view` permission).

**Query Parameters:**

- `page`: Page number (default: 1)
- `perPage`: Items per page (default: 10)
- `unit_number`: Filter by unit number
- `status`: Filter by status
- `account_id`: Filter by account ID
- `sort`: Sort field

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "unit_number": "UNIT001",
      "make": "Caterpillar",
      "model": "CAT320",
      "year": 2020,
      "status": "ACTIVE",
      "account_id": 1,
      "last_service_date": "2024-01-15T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 10,
    "totalPages": 10
  }
}
```

#### GET `/api/fleet/getEquipmentDetails`

Get equipment details (requires `read:fleet-list-view-details` permission).

**Query Parameters:**

- `equipment_id`: Equipment ID (required)

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "unit_number": "UNIT001",
    "make": "Caterpillar",
    "model": "CAT320",
    "year": 2020,
    "serial_number": "SN123456789",
    "engine_hours": 2500,
    "status": "ACTIVE",
    "account_id": 1,
    "specifications": {
      "engine_type": "Diesel",
      "horsepower": 200,
      "weight": 25000
    },
    "maintenance_history": [
      {
        "date": "2024-01-15T00:00:00.000Z",
        "service_type": "Regular Maintenance",
        "cost": 1500.0
      }
    ]
  },
  "message": "Success"
}
```

#### POST `/api/fleet/downloadListView`

Download fleet list view (requires `download:fleet-list-view` permission).

**Request Payload:**

```json
{
  "query": {
    "status": "ACTIVE",
    "account_id": 1
  },
  "columns": [
    {
      "key": "unit_number",
      "label": "Unit Number",
      "type": "string"
    },
    {
      "key": "make",
      "label": "Make",
      "type": "string"
    }
  ]
}
```

**Success Response (200):**

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="fleet_list_export.xlsx"
Content-Length: 12345

[Excel file binary data]
```

---

### 5. Invoices (`/api/invoices`)

#### GET `/api/invoices/stats`

Get invoice statistics (total due, past due, etc.).

**Success Response (200):**

```json
{
  "success": true,
  "message": "Invoice statistics retrieved successfully",
  "data": {
    "totalInvoices": 150,
    "totalDue": 125000.5,
    "pastDue": 25000.25,
    "paidThisMonth": 45000.0,
    "overdueCount": 12,
    "averageInvoiceAmount": 2500.0
  }
}
```

#### GET `/api/invoices/`

Get all invoices with pagination, filtering, and sorting.

**Query Parameters:**

- `page`: Page number (default: 1)
- `perPage`: Items per page (1-100, default: 10)
- `invoiceNumber`: Filter by invoice number
- `invoiceDate`: Filter by invoice date (ISO 8601)
- `dueDate`: Filter by due date (ISO 8601)
- `accountId`: Filter by account ID
- `invoiceType`: Filter by type (Lease, Rent, PM, ERS, Misc)
- `sort`: Sort field

**Success Response (200):**

```json
{
  "success": true,
  "message": "Invoices retrieved successfully",
  "data": {
    "invoices": [
      {
        "id": 1,
        "invoiceNumber": "INV-001",
        "date": "2024-01-01T00:00:00.000Z",
        "dueDate": "2024-01-31T00:00:00.000Z",
        "totalAmount": 2500.0,
        "balanceDue": 2500.0,
        "status": "PENDING",
        "account_id": 1,
        "invoiceType": "Lease"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "perPage": 10,
      "totalPages": 5
    }
  }
}
```

**Validation Error Response (400):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Page must be a positive integer",
      "param": "page",
      "location": "query"
    }
  ]
}
```

#### GET `/api/invoices/:id`

Get single invoice details by ID.

**Path Parameters:**

- `id`: Invoice ID (number)

**Success Response (200):**

```json
{
  "success": true,
  "message": "Invoice retrieved successfully",
  "data": {
    "id": 1,
    "invoiceNumber": "INV-001",
    "date": "2024-01-01T00:00:00.000Z",
    "dueDate": "2024-01-31T00:00:00.000Z",
    "billingAddress": "123 Main St, City, State 12345",
    "contactInfo": "contact@example.com",
    "taxId": "TAX123456",
    "invoiceType": "Lease",
    "description": "Monthly lease payment",
    "quantity": 1,
    "rate": 2500.0,
    "subTotal": 2500.0,
    "taxes": 200.0,
    "totalAmount": 2700.0,
    "amountPaid": 0.0,
    "balanceDue": 2700.0,
    "account_id": 1,
    "invoiceItems": [
      {
        "id": 1,
        "item_description": "Equipment lease",
        "quantity": 1,
        "rate": 2500.0,
        "amount": 2500.0
      }
    ]
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "message": "Invoice not found"
}
```

#### POST `/api/invoices/`

Create new invoice.

**Request Payload:**

```json
{
  "invoiceNumber": "INV-002",
  "date": "2024-01-01T00:00:00.000Z",
  "dueDate": "2024-01-31T00:00:00.000Z",
  "billingPeriod_start": "2024-01-01T00:00:00.000Z",
  "billingPeriod_end": "2024-01-31T00:00:00.000Z",
  "billingAddress": "123 Main St, City, State 12345",
  "contactInfo": "contact@example.com",
  "taxId": "TAX123456",
  "invoiceType": "Lease",
  "equipmentIds": [1, 2],
  "description": "Monthly lease payment",
  "quantity": 1,
  "rate": 2500.0,
  "subTotal": 2500.0,
  "taxes": 200.0,
  "discounts": 0.0,
  "credits": 0.0,
  "totalAmount": 2700.0,
  "amountPaid": 0.0,
  "balanceDue": 2700.0,
  "account_id": 1,
  "invoiceItems": [
    {
      "item_description": "Equipment lease",
      "quantity": 1,
      "rate": 2500.0,
      "amount": 2500.0
    }
  ]
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "id": 2,
    "invoiceNumber": "INV-002",
    "totalAmount": 2700.0,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Validation Error Response (400):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Invoice number is required",
      "param": "invoiceNumber",
      "location": "body"
    },
    {
      "msg": "Date must be a valid ISO 8601 date",
      "param": "date",
      "location": "body"
    }
  ]
}
```

#### GET `/api/invoices/:id/pdf`

Download single invoice as PDF.

**Path Parameters:**

- `id`: Invoice ID (number)

**Success Response (200):**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="invoice_INV-001.pdf"
Content-Length: 12345

[PDF file binary data]
```

#### POST `/api/invoices/export`

Export invoices to Excel with custom columns.

**Request Payload:**

```json
{
  "query": {
    "invoiceType": "Lease",
    "status": "PENDING"
  },
  "columns": [
    {
      "key": "invoiceNumber",
      "label": "Invoice Number",
      "type": "string"
    },
    {
      "key": "totalAmount",
      "label": "Total Amount",
      "type": "number"
    }
  ]
}
```

**Success Response (200):**

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="invoices_export.xlsx"
Content-Length: 12345

[Excel file binary data]
```

#### PUT `/api/invoices/:id`

Update invoice.

**Path Parameters:**

- `id`: Invoice ID (number)

**Request Payload:**

```json
{
  "totalAmount": 2800.0,
  "balanceDue": 2800.0,
  "description": "Updated monthly lease payment"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Invoice updated successfully",
  "data": {
    "id": 1,
    "totalAmount": 2800.0,
    "balanceDue": 2800.0,
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### DELETE `/api/invoices/:id`

Delete invoice.

**Path Parameters:**

- `id`: Invoice ID (number)

**Success Response (200):**

```json
{
  "success": true,
  "message": "Invoice deleted successfully"
}
```

**Error Response (404):**

```json
{
  "success": false,
  "message": "Invoice not found"
}
```

---

### 6. Payments (`/api/payments`)

#### GET `/api/payments/`

Get all payments with pagination and filtering.

**Query Parameters:**

- `page`: Page number
- `perPage`: Items per page (1-100)
- `paymentId`: Filter by payment ID
- `paymentDate`: Filter by payment date
- `paymentMethod`: Filter by payment method
- `invoices`: Filter by invoice ID
- `sort`: Sort field

**Success Response (200):**

```json
{
  "success": true,
  "message": "Payments retrieved successfully",
  "data": {
    "payments": [
      {
        "id": 1,
        "paymentId": "PAY-001",
        "paymentDate": "2024-01-15T00:00:00.000Z",
        "paymentMethod": "Credit Card",
        "payerName": "John Doe",
        "payerEntity": "ABC Company",
        "paymentAmount": 2500.0,
        "account_id": 1,
        "invoicePayments": 1,
        "invoiceCredits": 0
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "perPage": 10,
      "totalPages": 3
    }
  }
}
```

#### POST `/api/payments/`

Create new payment.

**Request Payload:**

```json
{
  "paymentId": "PAY-002",
  "paymentDate": "2024-01-15T00:00:00.000Z",
  "paymentMethod": "Bank Transfer",
  "payerName": "Jane Smith",
  "payerEntity": "XYZ Corp",
  "invoicePayments": 1,
  "invoiceCredits": 0,
  "paymentAmount": 1500.0,
  "account_id": 1,
  "invoiceIds": [1, 2]
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Payment created successfully",
  "data": {
    "id": 2,
    "paymentId": "PAY-002",
    "paymentAmount": 1500.0,
    "created_at": "2024-01-15T00:00:00.000Z"
  }
}
```

**Validation Error Response (400):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Payment ID is required",
      "param": "paymentId",
      "location": "body"
    },
    {
      "msg": "Payment method must be one of: Credit Card, Bank Transfer, Check, Cash, ACH, Wire Transfer",
      "param": "paymentMethod",
      "location": "body"
    }
  ]
}
```

#### GET `/api/payments/:id`

Get single payment details by ID.

**Path Parameters:**

- `id`: Payment ID (number)

**Success Response (200):**

```json
{
  "success": true,
  "message": "Payment retrieved successfully",
  "data": {
    "id": 1,
    "paymentId": "PAY-001",
    "paymentDate": "2024-01-15T00:00:00.000Z",
    "paymentMethod": "Credit Card",
    "payerName": "John Doe",
    "payerEntity": "ABC Company",
    "paymentAmount": 2500.0,
    "account_id": 1,
    "invoicePayments": 1,
    "invoiceCredits": 0,
    "invoiceIds": [1],
    "created_at": "2024-01-15T00:00:00.000Z"
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "message": "Payment not found"
}
```

#### GET `/api/payments/:id/receipt-pdf`

Download payment receipt as PDF.

**Path Parameters:**

- `id`: Payment ID (number)

**Success Response (200):**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="payment_receipt_PAY-001.pdf"
Content-Length: 12345

[PDF file binary data]
```

#### PUT `/api/payments/:id`

Update payment.

**Path Parameters:**

- `id`: Payment ID (number)

**Request Payload:**

```json
{
  "paymentMethod": "ACH",
  "payerName": "John Smith"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Payment updated successfully",
  "data": {
    "id": 1,
    "paymentMethod": "ACH",
    "payerName": "John Smith",
    "updated_at": "2024-01-15T00:00:00.000Z"
  }
}
```

#### DELETE `/api/payments/:id`

Delete payment.

**Path Parameters:**

- `id`: Payment ID (number)

**Success Response (200):**

```json
{
  "success": true,
  "message": "Payment deleted successfully"
}
```

---

### 7. Service Requests (`/api/serviceRequest`)

#### POST `/api/serviceRequest/`

Create service request (requires `write:service-request` permission).

**Request Payload:**

```json
{
  "equipment_id": 1,
  "service_category_id": 2,
  "urgency_type_id": 1,
  "description": "Engine maintenance required",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.006,
    "address": "123 Main St, New York, NY"
  },
  "attachments": [
    {
      "filename": "engine_issue.jpg",
      "url": "https://example.com/attachments/engine_issue.jpg"
    }
  ]
}
```

**Success Response (201):**

```json
{
  "statusCode": 201,
  "data": {
    "id": 1,
    "service_request_number": "SR-001",
    "equipment_id": 1,
    "status": "PENDING",
    "created_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

#### GET `/api/serviceRequest/serviceCategories`

Get service categories from service_issues_lookup table.

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "category_name": "Engine",
      "description": "Engine related issues"
    },
    {
      "id": 2,
      "category_name": "Transmission",
      "description": "Transmission related issues"
    }
  ],
  "message": "Success"
}
```

#### GET `/api/serviceRequest/tireSizes`

Get tire sizes from tire_size_lookup table.

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "size": "295/75R22.5",
      "description": "Standard truck tire size"
    },
    {
      "id": 2,
      "size": "315/80R22.5",
      "description": "Wide truck tire size"
    }
  ],
  "message": "Success"
}
```

#### GET `/api/serviceRequest/tenFacilities`

Get TEN facilities from facility_lookup table.

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "facility_name": "Main Service Center",
      "address": "123 Service St, City, State",
      "phone": "+1234567890"
    }
  ],
  "message": "Success"
}
```

#### GET `/api/serviceRequest/savedLocations`

Get saved locations based on user ID.

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "location_name": "Main Office",
      "latitude": 40.7128,
      "longitude": -74.006,
      "address": "123 Main St, New York, NY",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "message": "Success"
}
```

#### GET `/api/serviceRequest/:id`

Get service request details by ID (requires `write:service-request` permission).

**Path Parameters:**

- `id`: Service Request ID (number)

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "service_request_number": "SR-001",
    "equipment_id": 1,
    "service_category_id": 2,
    "urgency_type_id": 1,
    "description": "Engine maintenance required",
    "status": "PENDING",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.006,
      "address": "123 Main St, New York, NY"
    },
    "attachments": [
      {
        "id": 1,
        "filename": "engine_issue.jpg",
        "url": "https://example.com/attachments/engine_issue.jpg"
      }
    ],
    "created_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

#### GET `/api/serviceRequest/:id/download-pdf`

Download service request details as PDF (requires `download:service-request` permission).

**Path Parameters:**

- `id`: Service Request ID (number)

**Success Response (200):**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="service_request_SR-001.pdf"
Content-Length: 12345

[PDF file binary data]
```

---

### 8. Telematics Alerts (`/api/telematicsAlerts`)

#### POST `/api/telematicsAlerts/`

Create telematics alert (requires `write:telematics-alerts` permission).

**Request Payload:**

```json
{
  "equipment_id": 1,
  "alert_type_id": 2,
  "alert_category_id": 1,
  "message": "Engine temperature high",
  "severity": "HIGH",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.006
  },
  "metadata": {
    "temperature": 220,
    "threshold": 200
  }
}
```

**Success Response (201):**

```json
{
  "statusCode": 201,
  "data": {
    "id": 1,
    "alert_number": "ALT-001",
    "equipment_id": 1,
    "status": "ACTIVE",
    "created_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

#### GET `/api/telematicsAlerts/:id`

Get telematics alert by ID (requires `read:telematics-activity-feed-details` permission).

**Path Parameters:**

- `id`: Alert ID (number)

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "alert_number": "ALT-001",
    "equipment_id": 1,
    "alert_type_id": 2,
    "alert_category_id": 1,
    "message": "Engine temperature high",
    "severity": "HIGH",
    "status": "ACTIVE",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.006
    },
    "metadata": {
      "temperature": 220,
      "threshold": 200
    },
    "created_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

#### GET `/api/telematicsAlerts/customer/:custId/user/:userId?`

Get telematics alerts by customer and user.

**Path Parameters:**

- `custId`: Customer ID (number)
- `userId`: User ID (number, optional)

**Query Parameters:**

- `page`: Page number (default: 1)
- `perPage`: Items per page (default: 10)
- `status`: Filter by status
- `severity`: Filter by severity
- `date_from`: Filter from date
- `date_to`: Filter to date

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "alert_number": "ALT-001",
      "equipment_id": 1,
      "message": "Engine temperature high",
      "severity": "HIGH",
      "status": "ACTIVE",
      "created_at": "2024-01-15T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "perPage": 10,
    "totalPages": 3
  }
}
```

#### PATCH `/api/telematicsAlerts/:id`

Update telematics alert (requires `patch:telematics-alerts` permission).

**Path Parameters:**

- `id`: Alert ID (number)

**Request Payload:**

```json
{
  "status": "RESOLVED",
  "resolution_notes": "Issue resolved by maintenance team"
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "status": "RESOLVED",
    "resolution_notes": "Issue resolved by maintenance team",
    "updated_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

#### PATCH `/api/telematicsAlerts/toggle-status/:id`

Toggle telematics alert status (requires `patch:telematics-alerts` permission).

**Path Parameters:**

- `id`: Alert ID (number)

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "status": "INACTIVE",
    "updated_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

#### POST `/api/telematicsAlerts/getUsersByAccountIds`

Get users by account IDs (requires `read:user-management` permission).

**Request Payload:**

```json
{
  "account_ids": [1, 2, 3]
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "account_id": 1
    }
  ],
  "message": "Success"
}
```

#### POST `/api/telematicsAlerts/getEquipmentsByAccountIds`

Get equipment by account IDs (requires `read:fleet-list-view` permission).

**Request Payload:**

```json
{
  "account_ids": [1, 2, 3]
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "unit_number": "UNIT001",
      "make": "Caterpillar",
      "model": "CAT320",
      "account_id": 1
    }
  ],
  "message": "Success"
}
```

---

### 9. Activity Feed (`/api/activity-feed`)

#### GET `/api/activity-feed/customer/:custId/user/:userId?`

Get activity feed by customer and user (requires `read:telematics-activity-feed` permission).

**Path Parameters:**

- `custId`: Customer ID (number)
- `userId`: User ID (number, optional)

**Query Parameters:**

- `page`: Page number (default: 1)
- `perPage`: Items per page (default: 10)
- `activity_type`: Filter by activity type
- `date_from`: Filter from date
- `date_to`: Filter to date

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "activity_type": "EQUIPMENT_MAINTENANCE",
      "description": "Regular maintenance completed",
      "equipment_id": 1,
      "user_id": 1,
      "timestamp": "2024-01-15T00:00:00.000Z",
      "metadata": {
        "service_type": "Regular Maintenance",
        "cost": 1500.0
      }
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "perPage": 10,
    "totalPages": 5
  }
}
```

#### POST `/api/activity-feed/`

Create activity feed entry.

**Request Payload:**

```json
{
  "activity_type": "EQUIPMENT_MAINTENANCE",
  "description": "Regular maintenance completed",
  "equipment_id": 1,
  "user_id": 1,
  "metadata": {
    "service_type": "Regular Maintenance",
    "cost": 1500.0
  }
}
```

**Success Response (201):**

```json
{
  "statusCode": 201,
  "data": {
    "id": 1,
    "activity_type": "EQUIPMENT_MAINTENANCE",
    "description": "Regular maintenance completed",
    "created_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

---

### 10. Geofence (`/api/geofence`)

#### POST `/api/geofence/`

Create geofence (requires `write:geofence` permission).

**Request Payload:**

```json
{
  "name": "Main Office Geofence",
  "description": "Geofence around main office",
  "geofence_type": "CIRCLE",
  "coordinates": {
    "center": {
      "latitude": 40.7128,
      "longitude": -74.006
    },
    "radius": 100
  },
  "account_id": 1,
  "is_active": true
}
```

**Success Response (201):**

```json
{
  "statusCode": 201,
  "data": {
    "id": 1,
    "name": "Main Office Geofence",
    "geofence_type": "CIRCLE",
    "is_active": true,
    "created_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

#### GET `/api/geofence/:id`

Get geofence by ID (requires `read:geofence-list-view-details` permission).

**Path Parameters:**

- `id`: Geofence ID (number)

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "name": "Main Office Geofence",
    "description": "Geofence around main office",
    "geofence_type": "CIRCLE",
    "coordinates": {
      "center": {
        "latitude": 40.7128,
        "longitude": -74.006
      },
      "radius": 100
    },
    "account_id": 1,
    "is_active": true,
    "created_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

#### GET `/api/geofence/customer/:custId/user/:userId?`

Get geofences by customer and user.

**Path Parameters:**

- `custId`: Customer ID (number)
- `userId`: User ID (number, optional)

**Query Parameters:**

- `page`: Page number (default: 1)
- `perPage`: Items per page (default: 10)
- `is_active`: Filter by active status
- `geofence_type`: Filter by geofence type

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "name": "Main Office Geofence",
      "geofence_type": "CIRCLE",
      "is_active": true,
      "account_id": 1,
      "created_at": "2024-01-15T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "perPage": 10,
    "totalPages": 1
  }
}
```

#### GET `/api/geofence/allPolygons/customer/:custId/user/:userId?`

Get all geofence polygons (requires `read:geofence-list-view` permission).

**Path Parameters:**

- `custId`: Customer ID (number)
- `userId`: User ID (number, optional)

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "name": "Main Office Geofence",
      "geofence_type": "CIRCLE",
      "coordinates": {
        "center": {
          "latitude": 40.7128,
          "longitude": -74.006
        },
        "radius": 100
      },
      "is_active": true
    }
  ],
  "message": "Success"
}
```

#### PATCH `/api/geofence/:id`

Update geofence (requires `patch:geofence` permission).

**Path Parameters:**

- `id`: Geofence ID (number)

**Request Payload:**

```json
{
  "name": "Updated Office Geofence",
  "description": "Updated geofence description",
  "is_active": false
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "name": "Updated Office Geofence",
    "description": "Updated geofence description",
    "is_active": false,
    "updated_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

#### PATCH `/api/geofence/toggle-status/:geofence_id`

Toggle geofence status (requires `patch:geofence` permission).

**Path Parameters:**

- `geofence_id`: Geofence ID (number)

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "is_active": false,
    "updated_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

---

### 11. Work Orders (`/api/workorder`)

#### GET `/api/workorder/getWorkorders`

Get work orders (requires `read:work-orders` permission).

**Query Parameters:**

- `page`: Page number (default: 1)
- `perPage`: Items per page (default: 10)
- `status`: Filter by status
- `priority`: Filter by priority
- `equipment_id`: Filter by equipment ID
- `date_from`: Filter from date
- `date_to`: Filter to date

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "work_order_number": "WO-001",
      "equipment_id": 1,
      "status": "PENDING",
      "priority": "HIGH",
      "description": "Engine repair required",
      "assigned_to": "John Doe",
      "estimated_cost": 2500.0,
      "created_at": "2024-01-15T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 20,
    "page": 1,
    "perPage": 10,
    "totalPages": 2
  }
}
```

#### GET `/api/workorder/getWorkorderDetails`

Get work order details (requires `read:work-order-details` permission).

**Query Parameters:**

- `work_order_id`: Work Order ID (required)

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "work_order_number": "WO-001",
    "equipment_id": 1,
    "status": "PENDING",
    "priority": "HIGH",
    "description": "Engine repair required",
    "assigned_to": "John Doe",
    "estimated_cost": 2500.0,
    "actual_cost": 0.0,
    "start_date": null,
    "completion_date": null,
    "parts_required": [
      {
        "part_name": "Engine Oil Filter",
        "quantity": 1,
        "cost": 25.0
      }
    ],
    "labor_hours": 8,
    "created_at": "2024-01-15T00:00:00.000Z"
  },
  "message": "Success"
}
```

#### POST `/api/workorder/downloadWorkorders`

Download work orders (requires `download:work-orders` permission).

**Request Payload:**

```json
{
  "query": {
    "status": "PENDING",
    "priority": "HIGH"
  },
  "columns": [
    {
      "key": "work_order_number",
      "label": "Work Order Number",
      "type": "string"
    },
    {
      "key": "status",
      "label": "Status",
      "type": "string"
    }
  ]
}
```

**Success Response (200):**

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="work_orders_export.xlsx"
Content-Length: 12345

[Excel file binary data]
```

#### GET `/api/workorder/getWorkordersHistory`

Get work orders history.

**Query Parameters:**

- `page`: Page number (default: 1)
- `perPage`: Items per page (default: 10)
- `equipment_id`: Filter by equipment ID
- `date_from`: Filter from date
- `date_to`: Filter to date

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "work_order_number": "WO-001",
      "equipment_id": 1,
      "status": "COMPLETED",
      "completion_date": "2024-01-10T00:00:00.000Z",
      "actual_cost": 2500.0,
      "created_at": "2024-01-05T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "perPage": 10,
    "totalPages": 5
  }
}
```

---

### 12. File Upload (`/api/fileupload`)

File upload endpoints with specific rate limiting.

**Note**: File upload endpoints require multipart/form-data content type and specific file handling middleware.

---

### 13. Other Endpoints

#### Account Management (`/api/account`)

Account-related operations with similar response patterns.

#### Roles (`/api/roles`)

Role management operations with similar response patterns.

#### Tag Lookup (`/api/tagLookup`)

Tag lookup operations with similar response patterns.

#### PM/DOT (`/api/pm`)

PM/DOT related operations with similar response patterns.

#### Delivery Methods (`/api/delivery-methods`)

Delivery method management with similar response patterns.

#### Agreements (`/api/agreement`)

Agreement management with similar response patterns.

#### ERS (`/api/ers`)

ERS (Emergency Roadside Service) operations with similar response patterns.

#### Alert Category Lookup (`/api/alert-category-lookup`)

Alert category lookup operations with similar response patterns.

#### Alert Type Lookup (`/api/alert-type-lookup`)

Alert type lookup operations with similar response patterns.

#### Global Search (`/api/globalsearch`)

Global search functionality with similar response patterns.

#### Billing (`/api/billing`)

Billing operations with download rate limiting and similar response patterns.

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Error description",
  "statusCode": 400
}
```

### HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

### Auth0 JWT Errors

- `InvalidRequestError`: No token provided
- `InvalidTokenError`: Invalid or expired token
- `InsufficientScopeError`: Insufficient permissions

### Validation Errors

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Field is required",
      "param": "field_name",
      "location": "body"
    }
  ]
}
```

---

## Common Query Parameters

### Pagination

- `page`: Page number (default: 1)
- `perPage`: Items per page (1-100, default: 10)

### Filtering

- Date fields: ISO 8601 format
- ID fields: Positive integers
- Status fields: Specific enum values

### Sorting

- `sort`: Field name for sorting

---

## Rate Limiting

The API implements different rate limits for different types of operations:

- **General routes**: Standard rate limiting
- **Auth routes**: Stricter limits (authLimiter)
- **File upload routes**: Specific limits (fileUploadLimiter)
- **Download routes**: Limited to prevent abuse (downloadLimiter)

---

## Development Notes

- All routes use `asyncHandler` for error handling
- Most routes require specific Auth0 permissions
- File uploads use S3 middleware
- Database operations use Prisma ORM
- CORS is configured for specific origins
- Environment variables are loaded via dotenv
- Response formats are standardized using utility functions
- Validation is handled by express-validator middleware

---

## Version Information

- **API Version**: 1.0
- **Node.js**: Latest LTS
- **Express**: Latest
- **TypeScript**: Latest
- **Prisma**: Latest
- **Auth0**: Latest

---

_This comprehensive documentation is generated based on the route files, controllers, and response utilities in the Customer Portal Backend project. For the most up-to-date information, refer to the source code._
