# Customer Portal Backend - Database Table Specification

## Overview

This document provides a high-level specification of the database tables for the Customer Portal Backend system. The system manages equipment/fleet operations, customer relationships, service requests, maintenance, billing, and telematics data for a comprehensive fleet management platform.

## Database Technology

- **Database**: PostgreSQL
- **ORM**: Prisma
- **Total Tables**: 75 tables
- **Architecture**: Multi-tenuser with customer-based data isolation

---

## Core Business Domains

### 1. Customer & Account Management

#### **customer**

- **Purpose**: Central customer entity for multi-tenant architecture
- **Key Fields**: customer_id, customer_name, customer_class, reference_number, status
- **Relationships**: One-to-many with accounts, users, geofences, alerts
- **Business Logic**: Root entity for data isolation and access control

#### **account**

- **Purpose**: Customer accounts/sub-accounts for organizational structure
- **Key Fields**: account_id, customer_id, account_name, account_number, account_type (NATIONAL/REGIONAL)
- **Relationships**: Belongs to customer, has equipment assignments, service requests
- **Business Logic**: Supports hierarchical account structure with parent-child relationships

#### **user**

- **Purpose**: System users with role-based access control
- **Key Fields**: user_id, customer_id, user_role_id, email, auth_0_reference_id, assigned_account_ids
- **Relationships**: Belongs to customer, has role, manages multiple accounts
- **Business Logic**: Auth0 integration, column preferences, approval workflow

#### **user_role**

- **Purpose**: Role definitions with permissions and Auth0 integration
- **Key Fields**: user_role_id, customer_id, name, auth0_role_id, role_permission (JSON)
- **Relationships**: One-to-many with users
- **Business Logic**: Customer-specific roles with Auth0 synchronization

---

### 2. Equipment & Fleet Management

#### **equipment**

- **Purpose**: Core equipment/fleet assets with comprehensive specifications
- **Key Fields**: equipment_id, unit_number (unique), description, vin, status, specifications
- **Relationships**: Has assignments, permits, attachments, telematics, maintenance records
- **Business Logic**: Central asset registry with detailed specifications and tracking

#### **equipment_assignment**

- **Purpose**: Links equipment to accounts through contractual agreements
- **Key Fields**: equipment_assignment_id, equipment_id, equipment_type_allocation_id, activation_date
- **Relationships**: Links equipment to account allocations
- **Business Logic**: Manages equipment deployment and contractual relationships

#### **equipment_type_allocation**

- **Purpose**: Contractual equipment allocations to accounts
- **Key Fields**: allocation_id, schedule_agreement_line_item_id, account_id, units_allowed, units_assigned
- **Relationships**: Links to schedule agreements and accounts
- **Business Logic**: Manages contractual equipment quotas and assignments

#### **equipment_permit**

- **Purpose**: Equipment permits and licensing information
- **Key Fields**: equipment_permit_id, equipment_id, license_plate_number, license_plate_state
- **Relationships**: One-to-one with equipment
- **Business Logic**: Regulatory compliance and permit tracking

---

### 3. Contract & Agreement Management

#### **master_agreement**

- **Purpose**: Master contracts between company and customers
- **Key Fields**: master_agreement_id, contract_effective_date, contract_term, contract_billing_method
- **Relationships**: One-to-many with schedule agreements
- **Business Logic**: Top-level contractual framework

#### **schedule_agreement**

- **Purpose**: Specific equipment rental/lease schedules under master agreements
- **Key Fields**: schedule_agreement_id, master_agreement_id, effective_date, termination_date
- **Relationships**: Belongs to master agreement, has line items and allocations
- **Business Logic**: Detailed equipment rental schedules and terms

#### **schedule_agreement_line_item**

- **Purpose**: Individual equipment types and rates within schedule agreements
- **Key Fields**: line_item_id, schedule_agreement_id, equipment_type_lookup_id, rate, number_of_units
- **Relationships**: Belongs to schedule agreement, defines equipment types and pricing
- **Business Logic**: Equipment type specifications and pricing within contracts

---

### 4. Service Request & Work Order Management

#### **service_request**

- **Purpose**: Customer service requests for equipment issues
- **Key Fields**: service_request_id, account_id, equipment_id, service_urgency_lookup_id, issue_description
- **Relationships**: Links to accounts, equipment, workorders, ERS records
- **Business Logic**: Service request lifecycle from creation to resolution

#### **workorder**

- **Purpose**: Work orders generated from service requests
- **Key Fields**: workorder_id, service_request_id, workorder_description, technician_name, workorder_status
- **Relationships**: Belongs to service request, has VMRS codes, attachments
- **Business Logic**: Work order management with VMRS integration for standardized repairs

#### **ers** (Emergency Roadside Service)

- **Purpose**: Emergency roadside service records
- **Key Fields**: ers_id, service_request_id, workorder_id, technician_name, ers_status
- **Relationships**: Links service requests to work orders
- **Business Logic**: Emergency service coordination and tracking

---

### 5. Maintenance & Compliance

#### **preventive_maintenance_schedule**

- **Purpose**: Scheduled maintenance plans for equipment
- **Key Fields**: pm_schedule_id, equipment_id, account_id, frequency_interval, frequency_type
- **Relationships**: Links to equipment, accounts, and maintenance events
- **Business Logic**: Preventive maintenance planning and scheduling

#### **preventive_maintenance_event**

- **Purpose**: Actual maintenance events performed
- **Key Fields**: pm_event_id, equipment_id, pm_schedule_id, performed_date, work_performed
- **Relationships**: Belongs to schedule and equipment
- **Business Logic**: Maintenance execution tracking and history

#### **dot_inspection**

- **Purpose**: DOT compliance inspections
- **Key Fields**: dot_inspection_id, equipment_id, inspection_date, inspection_result
- **Relationships**: Links to equipment and schedule agreements
- **Business Logic**: Regulatory compliance tracking

---

### 6. Telematics & IoT Management

#### **telematics**

- **Purpose**: Real-time equipment telemetry data
- **Key Fields**: telematics_id, unit_number, latitude, longitude, speed, temperature, motion_status
- **Relationships**: Links to equipment via unit_number
- **Business Logic**: Real-time equipment monitoring and tracking

#### **iot_device**

- **Purpose**: IoT device registry and management
- **Key Fields**: iot_device_id, device_type, device_installation_date, status, battery_health
- **Relationships**: Links to equipment through equipment_has_iot_device
- **Business Logic**: IoT device lifecycle management

#### **equipment_gps_location**

- **Purpose**: GPS location history for equipment
- **Key Fields**: gps_location_id, equipment_has_iot_device_id, latitude, longitude, motion_status
- **Relationships**: Links to equipment through IoT device relationship
- **Business Logic**: Location tracking and geofencing support

---

### 7. Alert & Notification System

#### **telematic_alert**

- **Purpose**: Configurable alerts for equipment events
- **Key Fields**: telematic_alert_id, alert_name, operator, operator_value, status
- **Relationships**: Links to customers, accounts, equipment, alert types
- **Business Logic**: Configurable alert rules and notification management

#### **alert_type_lookup**

- **Purpose**: Standardized alert types and categories
- **Key Fields**: alert_type_lookup_id, event_name, event_type, operation_type
- **Relationships**: Links to customers and alert categories
- **Business Logic**: Standardized alert classification system

#### **activity_feed**

- **Purpose**: System activity log for audit and monitoring
- **Key Fields**: activity_feed_id, equipment_id, account_id, event_time, latitude, longitude
- **Relationships**: Links to multiple entities (equipment, accounts, customers, geofences)
- **Business Logic**: Comprehensive activity tracking and audit trail

---

### 8. Geofencing & Location Management

#### **geofence**

- **Purpose**: Geographic boundaries for equipment monitoring
- **Key Fields**: geofence_id, geofence_name, shape_type, polygon, center_lat, center_lng
- **Relationships**: Links to customers, accounts, and activity feeds
- **Business Logic**: Geographic boundary management for equipment tracking

---

### 9. Billing & Financial Management

#### **Invoice**

- **Purpose**: Customer billing and invoicing
- **Key Fields**: id, invoiceNumber, date, dueDate, totalAmount, status, account_id
- **Relationships**: Links to accounts, payments, equipment
- **Business Logic**: Comprehensive billing system with multiple invoice types

#### **Payment**

- **Purpose**: Payment processing and tracking
- **Key Fields**: id, paymentId, paymentDate, paymentMethod, paymentAmount, status
- **Relationships**: Links to accounts and invoices through PaymentInvoice
- **Business Logic**: Payment processing with multiple methods and currencies

#### **Invoice_Items**

- **Purpose**: Line items within invoices
- **Key Fields**: id, invoice_id, item_description, quantity, rate, amount
- **Relationships**: Belongs to invoice
- **Business Logic**: Detailed invoice line item management

---

### 10. Lookup & Reference Tables

#### **simple_field_lookup**

- **Purpose**: Centralized lookup values for status fields across the system
- **Key Fields**: field_name, field_code, short_description, long_description
- **Relationships**: Referenced by multiple tables for status values
- **Business Logic**: Standardized lookup values for consistency

#### **equipment_type_lookup**

- **Purpose**: Equipment type definitions
- **Key Fields**: equipment_type_lookup_id, equipment_type, equipment_name, equipment_description
- **Relationships**: Referenced by equipment and schedule agreements
- **Business Logic**: Standardized equipment classification

#### **oem_lookup** & **oem_make_model_lookup**

- **Purpose**: Original Equipment Manufacturer data
- **Key Fields**: Manufacturer information, make, model, year specifications
- **Relationships**: Referenced by equipment for OEM specifications
- **Business Logic**: Equipment manufacturer and model standardization

---

## Key Business Relationships

### Data Flow Architecture

1. **Customer** → **Account** → **Equipment Assignment** → **Equipment**
2. **Service Request** → **Work Order** → **ERS** (Emergency Roadside Service)
3. **Master Agreement** → **Schedule Agreement** → **Line Items** → **Equipment Allocations**
4. **Equipment** → **Telematics** → **Alerts** → **Activity Feed**
5. **Account** → **Invoice** → **Payment** (Financial Flow)

### Multi-Tenuser Architecture

- All data is isolated by **customer_id** at the root level
- **Account** level provides additional organizational structure
- **User** access is controlled through **assigned_account_ids**
- **Role-based permissions** through **user_role** with Auth0 integration

### Integration Points

- **Auth0**: User authentication and role management
- **IoT Devices**: Real-time telemetry and GPS tracking
- **VMRS Codes**: Standardized maintenance reporting
- **File Attachments**: Document management across multiple entities
- **Excel Export**: Data export functionality for reporting

---

## Technical Considerations

### Performance Optimizations

- Comprehensive indexing strategy on frequently queried fields
- Pagination support across all major entities
- Optimized queries with selective field loading
- Database connection pooling and monitoring

### Security Features

- Parameterized queries through Prisma ORM
- Input validation and sanitization
- Role-based access control
- Audit trails through activity feeds
- Rate limiting on API endpoints

### Scalability Features

- Multi-tenuser architecture with customer isolation
- Flexible equipment assignment system
- Configurable alert and notification system
- Comprehensive search and filtering capabilities
- Export functionality for large datasets

---

## Summary

This Customer Portal Backend system provides a comprehensive fleet management platform with 60+ interconnected tables supporting:

- **Multi-tenuser and customer management** with hierarchical account structure
- **Complete equipment lifecycle** from assignment to maintenance to retirement
- **Service request management** with work order and emergency service coordination
- **Real-time telematics** with GPS tracking and configurable alerts
- **Contractual management** with master agreements and detailed schedules
- **Financial management** with invoicing and payment processing
- **Compliance tracking** with DOT inspections and maintenance records
- **Geofencing capabilities** for location-based monitoring
- **Comprehensive reporting** with export and analytics capabilities

The system is designed for scalability, security, and maintainability with proper separation of concerns and standardized data relationships.

---

## Complete Table Inventory (75 Tables)

### 1. Equipment Management (15 tables)

#### **equipment**

- **Purpose**: Core equipment/fleet assets registry
- **Key Fields**: equipment_id (PK), unit_number (unique), description, vin, status, specifications
- **Relationships**: Central hub connecting to assignments, permits, telematics, maintenance
- **Business Logic**: Master equipment registry with comprehensive specifications

#### **equipment_reading**

- **Purpose**: Equipment meter readings and odometer data
- **Key Fields**: equipment_reading_id (PK), equipment_reading, reading_type, equipment_id (FK)
- **Relationships**: Belongs to equipment
- **Business Logic**: Tracks equipment usage and mileage readings

#### **equipment_load_detail**

- **Purpose**: Equipment load status and cargo information
- **Key Fields**: equipment_load_detail_id (PK), equipment_id (FK), equipment_load_date, equipment_load_status
- **Relationships**: Belongs to equipment, links to load status lookup
- **Business Logic**: Cargo and load tracking for equipment

#### **equipment_addon**

- **Purpose**: Equipment add-ons and accessories registry
- **Key Fields**: equipment_addon_id (PK), addon_type, effective_date, status
- **Relationships**: Links to equipment through equipment_has_addon
- **Business Logic**: Manages equipment accessories and add-ons

#### **equipment_permit**

- **Purpose**: Equipment permits and licensing
- **Key Fields**: equipment_permit_id (PK), equipment_id (FK, unique), license_plate_number, license_plate_state
- **Relationships**: One-to-one with equipment
- **Business Logic**: Regulatory compliance and permit management

#### **equipment_has_addon**

- **Purpose**: Junction table linking equipment to add-ons
- **Key Fields**: equipment_has_addon_id (PK), equipment_id (FK, unique), equipment_addon_id (FK, unique)
- **Relationships**: Links equipment to add-ons
- **Business Logic**: Many-to-many relationship between equipment and add-ons

#### **equipment_has_attachment**

- **Purpose**: Equipment document attachments
- **Key Fields**: equipment_has_attachment_id (PK), equipment_id (FK), attachment_id (FK, unique)
- **Relationships**: Links equipment to attachments
- **Business Logic**: Document management for equipment

#### **equipment_assignment**

- **Purpose**: Equipment assignments to accounts
- **Key Fields**: equipment_assignment_id (PK), equipment_id (FK), equipment_type_allocation_id (FK)
- **Relationships**: Links equipment to account allocations
- **Business Logic**: Equipment deployment and contractual assignments

#### **equipment_type_allocation**

- **Purpose**: Contractual equipment allocations
- **Key Fields**: equipment_type_allocation_id (PK), account_id (FK), units_allowed, units_assigned
- **Relationships**: Links to schedule agreements and accounts
- **Business Logic**: Manages contractual equipment quotas

#### **equipment_type_lookup**

- **Purpose**: Equipment type definitions
- **Key Fields**: equipment_type_lookup_id (PK), equipment_type (unique), equipment_name, equipment_description
- **Relationships**: Referenced by equipment and schedule agreements
- **Business Logic**: Standardized equipment classification

#### **equipment_gps_location**

- **Purpose**: GPS location history for equipment
- **Key Fields**: equipment_gps_location_id (PK), equipment_has_iot_device_id (FK), latitude, longitude
- **Relationships**: Links to equipment through IoT device relationship
- **Business Logic**: Location tracking and geofencing support

#### **iot_device**

- **Purpose**: IoT device registry
- **Key Fields**: iot_device_id (PK), device_type, device_installation_date, status, battery_health
- **Relationships**: Links to equipment through equipment_has_iot_device
- **Business Logic**: IoT device lifecycle management

#### **equipment_has_iot_device**

- **Purpose**: Junction table linking equipment to IoT devices
- **Key Fields**: equipment_has_iot_device_id (PK), equipment_id (FK, unique), iot_device_id (FK, unique)
- **Relationships**: Links equipment to IoT devices
- **Business Logic**: Equipment-IoT device associations

#### **iot_device_metric**

- **Purpose**: IoT device metric readings
- **Key Fields**: iot_device_metric_id (PK), equipment_has_iot_device_id (FK, unique), metric_value
- **Relationships**: Links to equipment through IoT device relationship
- **Business Logic**: IoT sensor data collection

#### **iot_device_vendor_lookup**

- **Purpose**: IoT device vendor information
- **Key Fields**: iot_device_vendor_lookup_id (PK), vendor_name, vendor_description, status
- **Relationships**: Referenced by IoT devices and telematics
- **Business Logic**: Vendor management for IoT devices

### 2. Customer & Account Management (6 tables)

#### **customer**

- **Purpose**: Central customer entity for multi-tenuser architecture
- **Key Fields**: customer_id (PK), customer_name, customer_class, reference_number, status
- **Relationships**: One-to-many with accounts, users, geofences, alerts
- **Business Logic**: Root entity for data isolation and access control

#### **account**

- **Purpose**: Customer accounts/sub-accounts
- **Key Fields**: account_id (PK), customer_id (FK), account_name, account_number, account_type
- **Relationships**: Belongs to customer, has equipment assignments, service requests
- **Business Logic**: Hierarchical account structure with parent-child relationships

#### **user**

- **Purpose**: System users with role-based access
- **Key Fields**: user_id (PK), customer_id (FK), user_role_id (FK), email (unique), auth_0_reference_id (unique)
- **Relationships**: Belongs to customer and role, manages multiple accounts
- **Business Logic**: Auth0 integration, column preferences, approval workflow

#### **user_role**

- **Purpose**: Role definitions with permissions
- **Key Fields**: user_role_id (PK), customer_id (FK), name, auth0_role_id, role_permission (JSON)
- **Relationships**: One-to-many with users
- **Business Logic**: Customer-specific roles with Auth0 synchronization

#### **column_preferences**

- **Purpose**: User column display preferences
- **Key Fields**: column_preferences_id (PK), user_id (FK), column_preference_table_name_id (FK), selected_columns (JSON)
- **Relationships**: Belongs to user and table name
- **Business Logic**: Customizable UI column preferences

#### **column_preference_table_name**

- **Purpose**: Available tables for column preferences
- **Key Fields**: column_preference_table_name_id (PK), table_name
- **Relationships**: One-to-many with column preferences
- **Business Logic**: Defines which tables support column customization

### 3. Contract & Agreement Management (6 tables)

#### **master_agreement**

- **Purpose**: Master contracts between company and customers
- **Key Fields**: master_agreement_id (PK), contract_effective_date, contract_term, contract_billing_method, status
- **Relationships**: One-to-many with schedule agreements
- **Business Logic**: Top-level contractual framework

#### **schedule_agreement**

- **Purpose**: Equipment rental/lease schedules
- **Key Fields**: schedule_agreement_id (PK), master_agreement_id (FK), effective_date, termination_date, status
- **Relationships**: Belongs to master agreement, has line items and allocations
- **Business Logic**: Detailed equipment rental schedules and terms

#### **schedule_agreement_line_item**

- **Purpose**: Equipment types and rates within agreements
- **Key Fields**: schedule_agreement_line_item_id (PK), schedule_agreement_id (FK), equipment_type_lookup_id (FK), rate
- **Relationships**: Belongs to schedule agreement, defines equipment types
- **Business Logic**: Equipment type specifications and pricing

#### **schedule_agreement_has_attachment**

- **Purpose**: Agreement document attachments
- **Key Fields**: schedule_agreement_has_attachment_id (PK), schedule_agreement_id (FK), attachment_id (FK)
- **Relationships**: Links schedule agreements to attachments
- **Business Logic**: Document management for agreements

#### **master_agreement_has_attachment**

- **Purpose**: Master agreement document attachments
- **Key Fields**: master_agreement_has_attachment_id (PK), master_agreement_id (FK), attachment_id (FK)
- **Relationships**: Links master agreements to attachments
- **Business Logic**: Document management for master agreements

#### **contract_type_lookup**

- **Purpose**: Contract type definitions
- **Key Fields**: contract_type_lookup_id (PK), contract_type, description, frequency, billing_method
- **Relationships**: Referenced by schedule agreements
- **Business Logic**: Standardized contract classification

### 4. Service Request & Work Order Management (8 tables)

#### **service_request**

- **Purpose**: Customer service requests for equipment issues
- **Key Fields**: service_request_id (PK), account_id (FK), equipment_id (FK), service_urgency_lookup_id (FK)
- **Relationships**: Links to accounts, equipment, workorders, ERS records
- **Business Logic**: Service request lifecycle management

#### **service_urgency_lookup**

- **Purpose**: Service urgency level definitions
- **Key Fields**: service_urgency_lookup_id (PK), urgency_code (unique), description, status
- **Relationships**: Referenced by service requests
- **Business Logic**: Standardized urgency classification

#### **service_urgency_type_lookup**

- **Purpose**: Service type definitions
- **Key Fields**: service_urgency_type_lookup_id (PK), selection_code (unique), selection_name
- **Relationships**: Referenced by service requests
- **Business Logic**: Service type classification

#### **service_request_location**

- **Purpose**: Saved service request locations
- **Key Fields**: service_request_location_id (PK), user_id (FK), location_nick_name, unit_street
- **Relationships**: Belongs to user, referenced by service requests
- **Business Logic**: Location management for service requests

#### **service_issues_lookup**

- **Purpose**: Service issue type definitions
- **Key Fields**: service_issues_lookup_id (PK), type_name, status
- **Relationships**: Referenced by service requests
- **Business Logic**: Standardized issue classification

#### **tire_size_lookup**

- **Purpose**: Tire size definitions
- **Key Fields**: tire_size_lookup_id (PK), size_code (unique), size_display, is_active
- **Relationships**: Referenced by service requests
- **Business Logic**: Tire size standardization

#### **workorder**

- **Purpose**: Work orders generated from service requests
- **Key Fields**: workorder_id (PK), service_request_id (FK), workorder_description, technician_name, workorder_status
- **Relationships**: Belongs to service request, has VMRS codes, attachments
- **Business Logic**: Work order management with VMRS integration

#### **workorder_vmrs**

- **Purpose**: VMRS codes associated with work orders
- **Key Fields**: workorder_id (FK), vmrs_id (FK), workorder_part_cost, workorder_labour_cost
- **Relationships**: Links workorders to VMRS codes
- **Business Logic**: Standardized maintenance reporting

### 5. Emergency Roadside Service (ERS) (4 tables)

#### **ers**

- **Purpose**: Emergency roadside service records
- **Key Fields**: ers_id (PK), service_request_id (FK), workorder_id (FK), technician_name, ers_status
- **Relationships**: Links service requests to work orders
- **Business Logic**: Emergency service coordination and tracking

#### **ers_parts_used**

- **Purpose**: Parts used in ERS repairs
- **Key Fields**: ers_parts_id (PK), ers_id (FK), part_name, part_quantity, part_cost
- **Relationships**: Belongs to ERS record
- **Business Logic**: Parts tracking for emergency repairs

#### **ers_has_attachment**

- **Purpose**: ERS document attachments
- **Key Fields**: ers_has_attachment_id (PK), ers_id (FK), attachment_id (FK, unique)
- **Relationships**: Links ERS records to attachments
- **Business Logic**: Document management for ERS

#### **communication_log**

- **Purpose**: ERS communication history
- **Key Fields**: communication_id (PK), ers_id (FK), vendor_name, driver_name, communication_type
- **Relationships**: Belongs to ERS record
- **Business Logic**: Communication tracking for emergency services

### 6. Maintenance & Compliance (4 tables)

#### **preventive_maintenance_schedule**

- **Purpose**: Scheduled maintenance plans
- **Key Fields**: pm_schedule_id (PK), equipment_id (FK), account_id (FK), frequency_interval, frequency_type
- **Relationships**: Links to equipment, accounts, and maintenance events
- **Business Logic**: Preventive maintenance planning

#### **preventive_maintenance_event**

- **Purpose**: Actual maintenance events performed
- **Key Fields**: pm_event_id (PK), equipment_id (FK), pm_schedule_id (FK), performed_date, work_performed
- **Relationships**: Belongs to schedule and equipment
- **Business Logic**: Maintenance execution tracking

#### **pm_parts_used**

- **Purpose**: Parts used in maintenance
- **Key Fields**: pm_parts_id (PK), pm_event_id (FK), part_name, part_quantity, part_cost
- **Relationships**: Belongs to maintenance event
- **Business Logic**: Parts tracking for maintenance

#### **dot_inspection**

- **Purpose**: DOT compliance inspections
- **Key Fields**: dot_inspection_id (PK), equipment_id (FK), account_id (FK), inspection_date, inspection_result
- **Relationships**: Links to equipment and schedule agreements
- **Business Logic**: Regulatory compliance tracking

### 7. DOT Compliance (1 table)

#### **dot_inspection_violation**

- **Purpose**: DOT inspection violations
- **Key Fields**: dot_inspection_violation_id (PK), dot_inspection_id (FK), violation_code, severity_level
- **Relationships**: Belongs to DOT inspection
- **Business Logic**: Violation tracking and corrective actions

### 8. Telematics & Tracking (1 table)

#### **telematics**

- **Purpose**: Real-time equipment telemetry data
- **Key Fields**: telematics_id (PK), unit_number (unique), latitude, longitude, speed, temperature, motion_status
- **Relationships**: Links to equipment via unit_number
- **Business Logic**: Real-time equipment monitoring and tracking

### 9. Alert & Notification System (5 tables)

#### **telematic_alert**

- **Purpose**: Configurable alerts for equipment events
- **Key Fields**: telematic_alert_id (PK), alert_name, operator, operator_value, status
- **Relationships**: Links to customers, accounts, equipment, alert types
- **Business Logic**: Configurable alert rules and notification management

#### **alert_type_lookup**

- **Purpose**: Standardized alert types
- **Key Fields**: alert_type_lookup_id (PK), event_name, event_type, operation_type
- **Relationships**: Links to customers and alert categories
- **Business Logic**: Standardized alert classification

#### **alert_category_lookup**

- **Purpose**: Alert category definitions
- **Key Fields**: alert_category_lookup_id (PK), category_name, status, event_vendor_id (array)
- **Relationships**: Links to alert types and telematic alerts
- **Business Logic**: Alert categorization system

#### **alert_templates**

- **Purpose**: Alert message templates
- **Key Fields**: template_id (PK), alert_id, subject_template, body_template, delivery_id
- **Relationships**: Links to alerts
- **Business Logic**: Standardized alert messaging

#### **alert_recipients**

- **Purpose**: Alert recipient management
- **Key Fields**: recipient_id (PK), account_id (FK), user_id (FK)
- **Relationships**: Links accounts to users for alerts
- **Business Logic**: Alert distribution management

### 10. Geofencing & Location (3 tables)

#### **geofence**

- **Purpose**: Geographic boundaries for equipment monitoring
- **Key Fields**: geofence_id (PK), geofence_name, shape_type, polygon, center_lat, center_lng
- **Relationships**: Links to customers, accounts, and activity feeds
- **Business Logic**: Geographic boundary management

#### **geofence_event_type_lookup**

- **Purpose**: Geofence event type definitions
- **Key Fields**: geofence_event_type_lookup_id (PK), event_name, event_category, description
- **Relationships**: Referenced by geofence events
- **Business Logic**: Geofence event classification

#### **geofence_alert_config**

- **Purpose**: Geofence alert configurations
- **Key Fields**: alert_config_id (PK), account_id (FK), recipient_id (FK), alert_enabled
- **Relationships**: Links accounts to alert configurations
- **Business Logic**: Geofence alert management

### 11. Activity & Audit (1 table)

#### **activity_feed**

- **Purpose**: System activity log for audit and monitoring
- **Key Fields**: activity_feed_id (PK), equipment_id (FK), account_id (FK), event_time, latitude, longitude
- **Relationships**: Links to multiple entities (equipment, accounts, customers, geofences)
- **Business Logic**: Comprehensive activity tracking and audit trail

### 12. Billing & Financial Management (5 tables)

#### **Invoice**

- **Purpose**: Customer billing and invoicing
- **Key Fields**: id (PK), invoiceNumber (unique), date, dueDate, totalAmount, status, account_id (FK)
- **Relationships**: Links to accounts, payments, equipment
- **Business Logic**: Comprehensive billing system

#### **Invoice_Items**

- **Purpose**: Line items within invoices
- **Key Fields**: id (PK), invoice_id (FK), item_description, quantity, rate, amount
- **Relationships**: Belongs to invoice
- **Business Logic**: Detailed invoice line item management

#### **Payment**

- **Purpose**: Payment processing and tracking
- **Key Fields**: id (PK), paymentId (unique), paymentDate, paymentMethod, paymentAmount, status
- **Relationships**: Links to accounts and invoices through PaymentInvoice
- **Business Logic**: Payment processing with multiple methods

#### **PaymentInvoice**

- **Purpose**: Many-to-many relationship between payments and invoices
- **Key Fields**: id (PK), paymentId (FK), invoiceId (FK), account_id (FK)
- **Relationships**: Links payments to invoices
- **Business Logic**: Payment-invoice associations

#### **InvoiceEquipment**

- **Purpose**: Many-to-many relationship between invoices and equipment
- **Key Fields**: id (PK), invoice_id (FK), equipment_id (FK)
- **Relationships**: Links invoices to equipment
- **Business Logic**: Equipment billing associations

### 13. Lookup & Reference Tables (8 tables)

#### **simple_field_lookup**

- **Purpose**: Centralized lookup values for status fields
- **Key Fields**: simple_field_lookup_id (PK), field_name, field_code (unique), short_description
- **Relationships**: Referenced by multiple tables for status values
- **Business Logic**: Standardized lookup values for consistency

#### **oem_lookup**

- **Purpose**: Original Equipment Manufacturer data
- **Key Fields**: oem_lookup_id (PK), manufacturer_code (unique), manufacturer_name
- **Relationships**: Referenced by equipment and OEM make/model lookup
- **Business Logic**: Equipment manufacturer standardization

#### **oem_make_model_lookup**

- **Purpose**: OEM make, model, and year specifications
- **Key Fields**: oem_make_model_lookup_id (PK), oem_lookup_id (FK, unique), make, model, year
- **Relationships**: Belongs to OEM lookup, referenced by equipment
- **Business Logic**: Equipment model standardization

#### **uom_lookup**

- **Purpose**: Unit of measure definitions
- **Key Fields**: uom_lookup_id (PK), uom_type, description
- **Relationships**: Referenced by equipment and IoT device metrics
- **Business Logic**: Measurement unit standardization

#### **facility_lookup**

- **Purpose**: Facility definitions
- **Key Fields**: facility_lookup_id (PK), facility_code (unique), facility_name, facility_description
- **Relationships**: Referenced by schedule agreements and service requests
- **Business Logic**: Facility standardization

#### **country_lookup**

- **Purpose**: Country definitions
- **Key Fields**: country_lookup_id (PK), country_code (unique), country_name, status
- **Relationships**: Referenced by accounts and users
- **Business Logic**: Geographic standardization

#### **tag_lookup**

- **Purpose**: Tag definitions for categorization
- **Key Fields**: tag_lookup_id (PK), tag_name (unique), status
- **Relationships**: Referenced by geofences
- **Business Logic**: Tag-based categorization system

#### **currency_lookup**

- **Purpose**: Currency definitions
- **Key Fields**: currency_lookup_id (PK), currencytype (unique), description, currency_code (unique)
- **Relationships**: Referenced by accounts, invoices, and payments
- **Business Logic**: Multi-currency support

### 14. VMRS & Maintenance Standards (1 table)

#### **vmrs_Lookup**

- **Purpose**: Vehicle Maintenance Reporting Standards codes
- **Key Fields**: vmrs_id (PK), vmrs_code, labor_cost, part_cost, vmrs_description
- **Relationships**: Referenced by workorders through workorder_vmrs
- **Business Logic**: Standardized maintenance reporting codes

### 15. Delivery & Communication (1 table)

#### **delivery_method_lookup**

- **Purpose**: Alert delivery method definitions
- **Key Fields**: delivery_id (PK), method_type, status
- **Relationships**: Referenced by alert templates
- **Business Logic**: Alert delivery method standardization

### 16. User Preferences & Quick Links (2 tables)

#### **user_metric_lookup**

- **Purpose**: User metric preferences (date, temperature, distance units)
- **Key Fields**: user_metric_lookup_id (PK), user_metric_code, user_metric_description, user_metric_type
- **Relationships**: Referenced by users and telematic alerts
- **Business Logic**: User preference management

#### **ten_quick_link**

- **Purpose**: Quick links for users
- **Key Fields**: ten_quick_link_id (PK), name, link, description, customer_id (FK)
- **Relationships**: Belongs to customer
- **Business Logic**: Customizable quick access links

### 17. Document Management (1 table)

#### **attachment**

- **Purpose**: Document and file attachments
- **Key Fields**: attachment_id (PK), mime_type, document_category_type, name, url, expiration_date
- **Relationships**: Referenced by multiple entities (equipment, agreements, workorders, ERS)
- **Business Logic**: Centralized document management

### 18. System Tables (2 tables)

#### **spatial_ref_sys**

- **Purpose**: Spatial reference system definitions
- **Key Fields**: srid (PK), auth_name, auth_srid, srtext, proj4text
- **Relationships**: System table for spatial data
- **Business Logic**: Geographic coordinate system support

#### **global_search_view**

- **Purpose**: Global search view for unified search
- **Key Fields**: id, type, title, subtitle, description, route
- **Relationships**: System view for search functionality
- **Business Logic**: Unified search across multiple entities

---

## Summary

The Customer Portal Backend system consists of **75 tables** organized into **18 functional categories**, providing comprehensive fleet management capabilities with multi-tenuser architecture, real-time telematics, maintenance tracking, billing management, and extensive reporting features. Each table serves a specific business purpose while maintaining proper relationships and data integrity throughout the system.
