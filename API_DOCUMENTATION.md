# Customer Portal Backend API Documentation

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

## API Endpoints

### 1. Authentication (`/api/auth`)

#### POST `/api/auth/login`

Authenticate user with Auth0 reference ID.

**Request Body:**

```json
{
  "auth_0_reference_id": "string"
}
```

**Response:**

```json
{
  "token": "string",
  "user": {
    "id": "string",
    "email": "string",
    "name": "string"
  }
}
```

#### POST `/api/auth/exchangeToken`

Exchange authorization code for access token.

**Request Body:**

```json
{
  "code": "string"
}
```

---

### 2. User Management (`/api/user`)

#### GET `/api/user/customers`

Get all customers (requires `read:ten-customers` permission).

#### GET `/api/user/tenUsers`

Get all TEN users (requires `read:user-management-ten-user-list` permission).

#### GET `/api/user/userDetails/:userId`

Get current user details.

#### GET `/api/user/customerDetails/:customerId`

Get customer details by ID.

#### GET `/api/user/customerUsers`

Get users by customer ID (requires `read:ten-admin-all-users` permission).

#### GET `/api/user/userCustomerDetailsAndAccounts/:userId`

Get customer details and accounts by user ID (requires `read:user-management` permission).

#### GET `/api/user/customerUsersByAssignedAccounts/:userId`

Get customer users by account assignment (requires `read:user-management` permission).

#### GET `/api/user/mastercolumnPreferenceTable`

Get master column preference table (requires `read:user-management` permission).

#### GET `/api/user/getUserColumnPreference/:user_id/:tableNameId`

Get user column preferences (requires `read:user-management` permission).

#### GET `/api/user/metrics`

Get user metrics.

#### GET `/api/user/:customerId/superAdmin`

Get super admin by customer (requires `read:ten-admin-all-users` permission).

#### POST `/api/user/createUser`

Create new user (requires `write:role` permission).

**Request Body:**

```json
{
  "first_name": "string",
  "last_name": "string",
  "email": "string",
  "phone_number": "+1234567890",
  "designation": "string",
  "avatar": "string (URL)",
  "status": "ACTIVE | INACTIVE",
  "is_customer_user": "boolean",
  "user_role_id": "number",
  "customer_id": "number",
  "password": "string (min 8 chars)",
  "assigned_account_ids": ["number"]
}
```

#### PATCH `/api/user/update/:user_id`

Update user (requires `patch:user-management` permission).

#### PATCH `/api/user/updatecustomer/:customer_id`

Update customer (requires `patch:user-management` permission).

#### PATCH `/api/user/userVerify/:user_id`

Verify user (requires `patch:user-management` permission).

#### PATCH `/api/user/updateUserStatus/:user_id`

Toggle user status (requires `update:user-management` permission).

#### POST `/api/user/downloadAllTenUsers`

Download all TEN users (requires `download:ten-admin-all-accounts` permission).

#### POST `/api/user/downloadCustomerUsersByAccountAssignment/:userId`

Download customer users by account assignment (requires `download:user-management` permission).

#### POST `/api/user/downloadCustomerUsers`

Download users by customer ID (requires `download:user-management` permission).

#### POST `/api/user/downloadCustomers`

Download customers (requires `download:ten-admin-all-accounts` permission).

#### POST `/api/user/userColumnPreferences`

Create user column preferences (requires `read:user-management` permission).

---

### 3. Dashboard (`/api/dashboard`)

#### GET `/api/dashboard/metrics`

Get main dashboard metrics and cards.

#### GET `/api/dashboard/vmrslist`

Get VMRS list.

#### POST `/api/dashboard/vmrs-metrics`

Get VMRS repair metrics and monthly maintenance costs.

#### GET `/api/dashboard/tenQuickLinksList`

Get TEN quick links list.

---

### 4. Fleet Management (`/api/fleet`)

#### GET `/api/fleet/getListView`

Get fleet list view (requires `read:fleet-list-view` permission).

#### GET `/api/fleet/getEquipmentDetails`

Get equipment details (requires `read:fleet-list-view-details` permission).

#### POST `/api/fleet/downloadListView`

Download fleet list view (requires `download:fleet-list-view` permission).

#### GET `/api/fleet/:unitNumber`

Get telematics data for specific unit.

---

### 5. Invoices (`/api/invoices`)

#### GET `/api/invoices/stats`

Get invoice statistics (total due, past due, etc.).

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

#### GET `/api/invoices/account/:accountId`

Get invoices for specific account.

#### GET `/api/invoices/:id`

Get single invoice details by ID.

#### GET `/api/invoices/:id/pdf`

Download single invoice as PDF.

#### POST `/api/invoices/`

Create new invoice.

**Request Body:**

```json
{
  "invoiceNumber": "string",
  "date": "2024-01-01T00:00:00.000Z",
  "dueDate": "2024-01-31T00:00:00.000Z",
  "billingPeriod_start": "2024-01-01T00:00:00.000Z",
  "billingPeriod_end": "2024-01-31T00:00:00.000Z",
  "billingAddress": "string",
  "contactInfo": "string",
  "taxId": "string",
  "invoiceType": "Lease | Rent | PM | ERS | Misc",
  "equipmentIds": ["number"],
  "description": "string",
  "quantity": "number",
  "rate": "number",
  "subTotal": "number",
  "taxes": "number",
  "discounts": "number",
  "credits": "number",
  "totalAmount": "number",
  "amountPaid": "number",
  "balanceDue": "number",
  "account_id": "number",
  "invoiceItems": [
    {
      "item_description": "string",
      "quantity": "number",
      "rate": "number",
      "amount": "number"
    }
  ]
}
```

#### POST `/api/invoices/export`

Export invoices to Excel with custom columns.

#### POST `/api/invoices/:id/pay-now`

Process payment for specific invoice.

#### PUT `/api/invoices/:id`

Update invoice.

#### DELETE `/api/invoices/:id`

Delete invoice.

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

#### GET `/api/payments/account/:accountId`

Get payments for specific account.

#### GET `/api/payments/:id`

Get single payment details by ID.

#### GET `/api/payments/:id/receipt-pdf`

Download payment receipt as PDF.

#### POST `/api/payments/`

Create new payment.

**Request Body:**

```json
{
  "paymentId": "string",
  "paymentDate": "2024-01-01T00:00:00.000Z",
  "paymentMethod": "Credit Card | Bank Transfer | Check | Cash | ACH | Wire Transfer",
  "payerName": "string",
  "payerEntity": "string",
  "invoicePayments": "number",
  "invoiceCredits": "number",
  "paymentAmount": "number",
  "account_id": "number",
  "invoiceIds": ["number"]
}
```

#### POST `/api/payments/export`

Export payments to Excel.

#### PUT `/api/payments/:id`

Update payment.

#### DELETE `/api/payments/:id`

Delete payment.

**Legacy Routes:**

- `POST /api/payments/create-payment`
- `GET /api/payments/get-payment/:id`
- `GET /api/payments/get-payments`
- `PUT /api/payments/update-payment/:id`
- `DELETE /api/payments/delete-payment/:id`

---

### 7. Service Requests (`/api/serviceRequest`)

#### POST `/api/serviceRequest/`

Create service request (requires `write:service-request` permission).

#### GET `/api/serviceRequest/serviceUrgencyTypes`

Get service urgency types list.

#### GET `/api/serviceRequest/serviceUrgency`

Get service urgency list.

#### GET `/api/serviceRequest/serviceCategories`

Get service categories from service_issues_lookup table.

#### GET `/api/serviceRequest/tireSizes`

Get tire sizes from tire_size_lookup table.

#### GET `/api/serviceRequest/tenFacilities`

Get TEN facilities from facility_lookup table.

#### GET `/api/serviceRequest/savedLocations`

Get saved locations based on user ID.

#### GET `/api/serviceRequest/savedLocations/:id`

Get saved location by ID.

#### PUT `/api/serviceRequest/savedLocations/:id`

Update saved location.

#### DELETE `/api/serviceRequest/savedLocations/:id`

Delete saved location.

#### GET `/api/serviceRequest/equipment/:equipmentId/account`

Get account by equipment ID.

#### GET `/api/serviceRequest/serviceRequestsList`

Get service requests list (requires `write:service-request` permission).

#### GET `/api/serviceRequest/:id`

Get service request details by ID (requires `write:service-request` permission).

#### GET `/api/serviceRequest/:id/download-pdf`

Download service request details as PDF (requires `download:service-request` permission).

#### POST `/api/serviceRequest/download-excel`

Download service requests history as Excel.

---

### 8. Telematics Alerts (`/api/telematicsAlerts`)

#### POST `/api/telematicsAlerts/`

Create telematics alert (requires `write:telematics-alerts` permission).

#### GET `/api/telematicsAlerts/:id`

Get telematics alert by ID (requires `read:telematics-activity-feed-details` permission).

#### GET `/api/telematicsAlerts/customer/:custId/user/:userId?`

Get telematics alerts by customer and user.

#### GET `/api/telematicsAlerts/customer/:custId/`

Get telematics alerts by customer (requires `read:telematics-activity-feed` permission).

#### POST `/api/telematicsAlerts/download/customer/:custId/user/:userId?`

Download telematics alerts by customer and user.

#### POST `/api/telematicsAlerts/download/customer/:custId/`

Download telematics alerts by customer (requires `download:telematics-activity-feed` permission).

#### PATCH `/api/telematicsAlerts/:id`

Update telematics alert (requires `patch:telematics-alerts` permission).

#### PATCH `/api/telematicsAlerts/toggle-status/:id`

Toggle telematics alert status (requires `patch:telematics-alerts` permission).

#### POST `/api/telematicsAlerts/getUsersByAccountIds`

Get users by account IDs (requires `read:user-management` permission).

#### POST `/api/telematicsAlerts/getEquipmentsByAccountIds`

Get equipment by account IDs (requires `read:fleet-list-view` permission).

#### POST `/api/telematicsAlerts/fetchEquipmentByAccountsOrCustIdAndEvents`

Fetch equipment by accounts or customer ID and events (requires `read:fleet-list-view` permission).

---

### 9. Activity Feed (`/api/activity-feed`)

#### GET `/api/activity-feed/customer/:custId/user/:userId?`

Get activity feed by customer and user (requires `read:telematics-activity-feed` permission).

#### GET `/api/activity-feed/customer/:custId/`

Get activity feed by customer.

#### POST `/api/activity-feed/download/customer/:custId/user/:userId?`

Download activity feed by customer and user.

#### POST `/api/activity-feed/download/customer/:custId/`

Download activity feed by customer (requires `download:telematics-activity-feed` permission).

#### POST `/api/activity-feed/`

Create activity feed entry.

---

### 10. Geofence (`/api/geofence`)

#### POST `/api/geofence/`

Create geofence (requires `write:geofence` permission).

#### GET `/api/geofence/:id`

Get geofence by ID (requires `read:geofence-list-view-details` permission).

#### GET `/api/geofence/customer/:custId/user/:userId?`

Get geofences by customer and user.

#### GET `/api/geofence/customer/:custId`

Get geofences by customer (requires `read:geofence-list-view-details` permission).

#### GET `/api/geofence/allPolygons/customer/:custId/user/:userId?`

Get all geofence polygons (requires `read:geofence-list-view` permission).

#### GET `/api/geofence/allPolygons/customer/:custId`

Get all geofence polygons by customer (requires `read:geofence-list-view` permission).

#### GET `/api/geofence/count/customer/:custId/user/:userId?`

Get geofence counts.

#### GET `/api/geofence/count/customer/:custId`

Get geofence counts by customer (requires `read:geofence-list-view` permission).

#### POST `/api/geofence/download/customer/:custId/user/:userId?`

Download geofences by customer and user.

#### POST `/api/geofence/download/customer/:custId`

Download geofences by customer (requires `download:geofence` permission).

#### PATCH `/api/geofence/:id`

Update geofence (requires `patch:geofence` permission).

#### PATCH `/api/geofence/toggle-status/:geofence_id`

Toggle geofence status (requires `patch:geofence` permission).

---

### 11. Work Orders (`/api/workorder`)

#### GET `/api/workorder/getWorkorders`

Get work orders (requires `read:work-orders` permission).

#### GET `/api/workorder/getWorkorderDetails`

Get work order details (requires `read:work-order-details` permission).

#### POST `/api/workorder/downloadWorkorders`

Download work orders (requires `download:work-orders` permission).

#### GET `/api/workorder/getWorkordersHistory`

Get work orders history.

---

### 12. File Upload (`/api/fileupload`)

File upload endpoints with specific rate limiting.

---

### 13. Other Endpoints

#### Account Management (`/api/account`)

Account-related operations.

#### Roles (`/api/roles`)

Role management operations.

#### Tag Lookup (`/api/tagLookup`)

Tag lookup operations.

#### PM/DOT (`/api/pm`)

PM/DOT related operations.

#### Delivery Methods (`/api/delivery-methods`)

Delivery method management.

#### Agreements (`/api/agreement`)

Agreement management.

#### ERS (`/api/ers`)

ERS (Emergency Roadside Service) operations.

#### Alert Category Lookup (`/api/alert-category-lookup`)

Alert category lookup operations.

#### Alert Type Lookup (`/api/alert-type-lookup`)

Alert type lookup operations.

#### Global Search (`/api/globalsearch`)

Global search functionality.

#### Billing (`/api/billing`)

Billing operations with download rate limiting.

---

## Error Handling

### Standard Error Response

```json
{
  "message": "Error description",
  "error": "Detailed error (development only)"
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

---

## Version Information

- **API Version**: 1.0
- **Node.js**: Latest LTS
- **Express**: Latest
- **TypeScript**: Latest
- **Prisma**: Latest
- **Auth0**: Latest

---

_This documentation is generated based on the route files in the Customer Portal Backend project. For the most up-to-date information, refer to the source code._
