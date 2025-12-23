# Startease Backend API

A comprehensive business management platform backend built with Express.js, TypeScript, and MongoDB. This system manages business registrations, product catalogs, and document tracking with a three-layer architecture.

## 🏗️ Architecture Overview

The system uses a **three-layer architecture** to separate product catalog management from business-specific instances:

```
┌─────────────────────┐
│  Product Catalog    │  ← Master templates (shared across all users)
│  (Product Model)    │
└──────────┬──────────┘
           │ Add to Business
           ↓
┌─────────────────────┐
│  BusinessProduct    │  ← Instance per business (status, progress, pricing)
│  (Instance)         │
└──────────┬──────────┘
           │ Track Documents
           ↓
┌─────────────────────┐
│  UserDocument       │  ← Document tracking (upload status, verification)
│  (Document Status)  │
└─────────────────────┘
```

### Core Models

#### 1. **User** - Authentication and user management
- Email-based authentication with OTP
- JWT token-based sessions

#### 2. **Business** - Business entity management
- Business information (name, type, location)
- Founder structure and information
- Registered agent information
- Links to products and documents

#### 3. **Product** - Product catalog (master templates)
- Product name, description, pricing
- Price breakdown (starteaseFee, stdFee)
- Required documents and acknowledgements
- Recommended products
- What's included features
- Process type (expedite/standard)
- Department type (federal/state/startease)

#### 4. **BusinessProduct** - Product instances per business
- Links business to product
- Instance-specific status (active/completed/cancelled/pending)
- Progress tracking (0-100%)
- Completed steps
- Custom purchase price
- Start/end dates

#### 5. **UserDocument** - Document tracking
- Document uploads per business-product
- Status tracking (pending/uploaded/verified/rejected)
- Verification workflow
- File metadata

## 📊 Data Flow Example

### Product Catalog
```
Product: "LLC Formation" ($500)
├─ Price Breakdown: { starteaseFee: 100, stdFee: 400 }
├─ Required Docs: [Articles of Org, Operating Agreement, EIN]
├─ Time to Complete: 7 days
└─ What's Included: [Filing, EIN Application, Operating Agreement Template]
```

### Business A adds LLC Formation
```
BusinessProduct (Instance #1)
├─ Status: active
├─ Progress: 50%
├─ Purchase Price: $450 (discounted)
└─ Documents:
    ├─ Document 1: Articles of Org (status: verified)
    ├─ Document 2: Operating Agreement (status: uploaded)
    └─ Document 3: EIN Confirmation (status: pending)
```

### Business B adds LLC Formation
```
BusinessProduct (Instance #2)
├─ Status: completed
├─ Progress: 100%
├─ Purchase Price: $500
└─ Documents:
    ├─ Document 1: Articles of Org (status: verified)
    ├─ Document 2: Operating Agreement (status: verified)
    └─ Document 3: EIN Confirmation (status: verified)
```

## 🔐 Authentication Flow

### 1. Login (Request OTP)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to your email"
}
```

### 2. Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "isVerified": true
  }
}
```

### 3. Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 4. Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

## 🏢 Business Management Flow

### 1. Create Business
```http
POST /api/businesses
Authorization: Bearer <token>
Content-Type: application/json

{
  "businessName": "Acme LLC",
  "businessDescription": "Technology consulting services",
  "entityType": "LLC",
  "compLocation": "Delaware",
  "founderStructure": "multi",
  "founderInfo": [
    {
      "name": "John Doe",
      "phone": "+1234567890",
      "email": "john@example.com",
      "country": "USA",
      "ownershipPercentage": 60,
      "role": "CEO"
    }
  ],
  "regAgentInfo": [
    {
      "name": "Delaware Registered Agent Inc",
      "address": "123 Main St, Dover, DE 19901",
      "isActive": true
    }
  ],
  "businessAddress": "456 Tech Blvd, San Francisco, CA",
  "businessEmail": "contact@acme.com"
}
```

### 2. Get All User Businesses
```http
GET /api/businesses?page=1&limit=10&isActive=true
Authorization: Bearer <token>
```

### 3. Get Business by ID
```http
GET /api/businesses/:id
Authorization: Bearer <token>
```

### 4. Update Business
```http
PUT /api/businesses/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "businessName": "Acme Technologies LLC",
  "regAgentInfo": [...]
}
```

### 5. Get Business Statistics
```http
GET /api/businesses/stats
Authorization: Bearer <token>
```

## 📦 Product Catalog Flow

### 1. Create Product (Admin)
```http
POST /api/products
Content-Type: application/json

{
  "productName": "LLC Formation",
  "description": "Complete LLC formation service",
  "price": 500,
  "processType": "standard",
  "departmentType": "state",
  "timeToComplete": 7,
  "productType": "onetime",
  "priceBreakup": {
    "starteaseFee": 100,
    "stdFee": 400
  },
  "recommendedProduct": [
    { "productId": "507f1f77bcf86cd799439012" }
  ],
  "whatsIncluded": [
    {
      "title": "Articles of Organization",
      "description": "Filing of official formation documents"
    },
    {
      "title": "EIN Application",
      "description": "Federal tax ID number application"
    }
  ],
  "requiredDocs": [
    {
      "docName": "Articles of Organization",
      "docType": "PDF",
      "category": "requiredDoc",
      "isRequired": true
    }
  ],
  "category": "Formation",
  "subCategory": "LLC"
}
```

### 2. Get All Products
```http
GET /api/products?page=1&limit=50&departmentType=state
```

### 3. Get Product by ID
```http
GET /api/products/:id
```

### 4. Filter Products
```http
GET /api/products/department/state
GET /api/products/process-type/expedite
GET /api/products/product-type/recurring
```

## 🔗 Business-Product Instance Flow

### 1. Add Product to Business
```http
POST /api/businesses/:businessId/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "507f1f77bcf86cd799439011",
  "purchasePrice": 450,
  "notes": "Expedited processing requested"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Product added to business successfully",
  "businessProduct": {
    "_id": "507f1f77bcf86cd799439013",
    "businessId": "507f1f77bcf86cd799439010",
    "productId": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439009",
    "status": "active",
    "progress": 0,
    "purchasePrice": 450,
    "startDate": "2025-11-29T00:00:00.000Z"
  }
}
```

### 2. Get All Business Products
```http
GET /api/business-products
Authorization: Bearer <token>
```

### 3. Get Business Product Details
```http
GET /api/business-products/:id
Authorization: Bearer <token>
```

### 4. Update Product Status/Progress
```http
PUT /api/business-products/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "completed",
  "progress": 100,
  "completedSteps": ["filing", "ein_application", "documents_verified"],
  "endDate": "2025-12-06T00:00:00.000Z"
}
```

### 5. Filter by Status
```http
GET /api/business-products/status/active
GET /api/business-products/status/completed
```

## 📄 Document Tracking Flow

### 1. Upload Document
```http
POST /api/documents
Authorization: Bearer <token>
Content-Type: application/json

{
  "businessId": "507f1f77bcf86cd799439010",
  "productId": "507f1f77bcf86cd799439011",
  "businessProductId": "507f1f77bcf86cd799439013",
  "docName": "Articles of Organization",
  "file": "https://storage.example.com/docs/articles.pdf",
  "docType": "PDF",
  "category": "requiredDoc",
  "fileSize": 245678,
  "isRequired": true
}
```

### 2. Get All User Documents
```http
GET /api/documents?page=1&limit=50
Authorization: Bearer <token>
```

### 3. Get Documents by Business
```http
GET /api/documents/business/:businessId
Authorization: Bearer <token>
```

### 4. Update Document Status
```http
PUT /api/documents/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "verified",
  "verifiedBy": "507f1f77bcf86cd799439020"
}
```

### 5. Get Document Statistics
```http
GET /api/documents/stats
Authorization: Bearer <token>
```

## 🗂️ Complete API Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/login` | No | Request OTP |
| POST | `/verify-otp` | No | Verify OTP and login |
| POST | `/logout` | Yes | Logout user |
| GET | `/me` | Yes | Get current user |

### Businesses (`/api/businesses`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | Yes | Create business |
| GET | `/` | Yes | Get all user businesses |
| GET | `/stats` | Yes | Get business statistics |
| GET | `/entity/:entityType` | Yes | Filter by entity type |
| GET | `/location/:location` | Yes | Filter by location |
| GET | `/:id` | Yes | Get business by ID |
| PUT | `/:id` | Yes | Update business |
| DELETE | `/:id` | Yes | Soft delete business |
| DELETE | `/:id/permanent` | Yes | Permanently delete |
| POST | `/:businessId/products` | Yes | Add product to business |

### Products (`/api/products`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | No* | Create product |
| GET | `/` | No* | Get all products |
| GET | `/department/:department` | No* | Filter by department |
| GET | `/process-type/:processType` | No* | Filter by process type |
| GET | `/product-type/:productType` | No* | Filter by product type |
| GET | `/:id` | No* | Get product by ID |
| PUT | `/:id` | No* | Update product |
| DELETE | `/:id` | No* | Soft delete product |
| DELETE | `/:id/permanent` | No* | Permanently delete |

*Note: Product routes currently don't require authentication (commented out in routes)

### Business Products (`/api/business-products`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Yes | Get all user products |
| GET | `/status/:status` | Yes | Filter by status |
| GET | `/:id` | Yes | Get product details |
| PUT | `/:id` | Yes | Update status/progress |
| DELETE | `/:id` | Yes | Soft delete |
| DELETE | `/:id/permanent` | Yes | Permanently delete |

### Documents (`/api/documents`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | Yes | Upload document |
| GET | `/` | Yes | Get all user documents |
| GET | `/stats` | Yes | Get document statistics |
| GET | `/business/:businessId` | Yes | Get by business |
| GET | `/:id` | Yes | Get document by ID |
| PUT | `/:id` | Yes | Update document |
| DELETE | `/:id` | Yes | Delete document |

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18+)
- MongoDB (v6+)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd startes-be
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create a `.env` file in the root directory:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/startease
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# Email configuration (for OTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@startease.com
```

4. **Run in development mode**
```bash
npm run dev
```

5. **Build for production**
```bash
npm run build
npm start
```

## 📁 Project Structure

```
startes-be/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── business.controller.ts
│   │   ├── product.controller.ts
│   │   ├── businessProduct.controller.ts
│   │   └── document.controller.ts
│   ├── models/          # Mongoose models
│   │   ├── user.model.ts
│   │   ├── business.model.ts
│   │   ├── product.model.ts
│   │   ├── businessProduct.model.ts
│   │   ├── userDocument.model.ts
│   │   ├── otp.model.ts
│   │   └── session.model.ts
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   ├── utils/           # Utility functions
│   └── server.ts        # Application entry point
├── package.json
├── tsconfig.json
└── .env
```

## 🔑 Key Features

✅ **Email OTP Authentication** - Secure passwordless login  
✅ **Business Management** - Multi-business support per user  
✅ **Product Catalog** - Centralized product templates  
✅ **Instance Tracking** - Per-business product instances  
✅ **Document Management** - Upload and verification workflow  
✅ **Progress Tracking** - Real-time status and completion  
✅ **Flexible Pricing** - Custom pricing per instance  
✅ **Registered Agent Tracking** - Multiple agents per business  
✅ **Advanced Filtering** - Query by status, type, location  
✅ **Statistics & Analytics** - Business and document insights  

## 📝 Data Models

### Entity Types
- `LLC` - Limited Liability Company
- `C-Corp` - C Corporation
- `S-Corp` - S Corporation
- `Partnership`
- `Sole Proprietorship`

### Process Types
- `standard` - Standard processing
- `expedite` - Expedited processing

### Department Types
- `federal` - Federal level
- `state` - State level
- `startease` - Platform services

### Product Types
- `onetime` - One-time purchase
- `recurring` - Recurring subscription

### Status Values
**BusinessProduct:**
- `pending` - Awaiting start
- `active` - In progress
- `completed` - Finished
- `cancelled` - Cancelled

**Document:**
- `pending` - Not uploaded
- `uploaded` - Uploaded, awaiting review
- `verified` - Verified and approved
- `rejected` - Rejected, needs resubmission

## 🛡️ Security

- JWT-based authentication
- Email OTP verification
- Session management
- Protected routes with middleware
- Input validation
- MongoDB injection prevention

## 📧 Contact

For questions or support, please contact the development team.

---

**Built with Rising Prince using Express.js, TypeScript, and MongoDB**
