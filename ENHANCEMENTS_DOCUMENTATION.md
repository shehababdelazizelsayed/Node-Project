# Book Management System Enhancements Documentation

## Overview
This document outlines the enhancements made to the book management system, including enhanced validation, owner status workflow, admin notifications, and removal of Swagger documentation.

## Changes Made

### 1. Enhanced Book Validation
- **Uniqueness Checks**: Books cannot be repeated based on Title, Image, and Pdf fields
- **Case-Insensitive Matching**: Validation ignores case differences (e.g., "Five Love Language" matches "FIVE LOVE LANGUAGE")
- **Normalization**: Removes spaces, special characters, and converts to lowercase for comparison
- **Selective Checking**: Only checks fields that have actual values (empty Image/Pdf don't trigger false positives)

### 2. Owner Status Workflow
- **New Status Field**: Added to Book model with enum: ["Pending", "Approved", "Rejected"]
- **Default Status**: New books are created with "Pending" status
- **Admin Approval Required**: Books need admin approval before being available

### 3. Admin Notifications
- **Email Notifications**: Admins receive email when a new book is added for approval
- **Book Owner Notifications**: Book owners receive email when their book is approved/rejected
- **Email Content**: Includes book details and relevant information

### 4. Swagger Removal
- **Complete Removal**: Deleted swagger.js file and all Swagger setup
- **Clean Code**: Removed all @swagger comments from controllers
- **API Documentation**: Now relies on Postman for testing and documentation

### 5. Admin Approval System
- **New Endpoint**: `PATCH /api/Books/:id/status` for admin approval/rejection
- **Access Control**: Only users with "Admin" role can approve/reject books
- **Status Validation**: Only "Pending" books can be approved/rejected
- **Cache Invalidation**: Automatically clears book list cache after status changes

## API Endpoints

### Book Management
- `POST /api/Books` - Add new book (sets status to "Pending", notifies admins)
- `GET /api/Books` - Get all books (with filtering and pagination)
- `PUT /api/Books/:id` - Update book (Owner/Admin only)
- `DELETE /api/Books/:id` - Delete book (Owner/Admin only)
- `PATCH /api/Books/:id/status` - Approve/Reject book (Admin only)

### User Management
- `POST /api/Users/Register` - Register new user
- `POST /api/Users/Login` - User login
- `PATCH /api/Users/Profile` - Update user profile
- `POST /api/Users/forgot-password` - Request password reset
- `POST /api/Users/reset-password/:token` - Reset password

## Postman Testing Guide

### Prerequisites
1. Start the server: `node index.js`
2. Server runs on `http://localhost:5000`
3. Have at least one Admin user and one regular user in the database
4. Configure email settings in `.env` file for notifications

### Test Scenarios

#### 1. User Registration and Login
**Register a new user:**
```
POST http://localhost:5000/api/Users/Register
Content-Type: application/json

{
  "Name": "Test User",
  "Email": "test@example.com",
  "Password": "password123"
}
```

**Login to get token:**
```
POST http://localhost:5000/api/Users/Login
Content-Type: application/json

{
  "Email": "test@example.com",
  "Password": "password123"
}
```
*Save the token from response for authenticated requests*

#### 2. Add Book with Validation Testing
**Add a new book (should set status to "Pending" and notify admins):**
```
POST http://localhost:5000/api/Books
Authorization: Bearer YOUR_USER_TOKEN
Content-Type: multipart/form-data

Form Data:
- Title: Five Love Languages
- Author: Gary Chapman
- Price: 29.99
- Description: A book about love languages
- Category: Self-Help
- Stock: 10
- Image: [upload image file]
- Pdf: [upload pdf file]
```

**Test uniqueness validation - try adding same book again:**
```
POST http://localhost:5000/api/Books
Authorization: Bearer YOUR_USER_TOKEN
Content-Type: multipart/form-data

Form Data:
- Title: FIVE    $$ LOVE LANGUAGES
- Author: Gary Chapman
- Price: 29.99
- Description: A book about love languages
- Category: Self-Help
- Stock: 10
```
*Should return error: "Book with similar Title, Image, or Pdf already exists"*

#### 3. Admin Approval Process
**Login as Admin to get admin token:**
```
POST http://localhost:5000/api/Users/Login
Content-Type: application/json

{
  "Email": "admin@example.com",
  "Password": "adminpassword"
}
```

**Get pending books (as admin):**
```
GET http://localhost:5000/api/Books?status=Pending
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Approve a book:**
```
PATCH http://localhost:5000/api/Books/{book_id}/status
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "status": "Approved"
}
```

**Reject a book:**
```
PATCH http://localhost:5000/api/Books/{book_id}/status
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "status": "Rejected"
}
```

#### 4. Verify Notifications
- **Admin Notification**: Check admin email inbox for "New Book Added for Approval"
- **Owner Notification**: After approval/rejection, check book owner's email for status update

#### 5. Error Testing
**Try to approve already approved book:**
```
PATCH http://localhost:5000/api/Books/{book_id}/status
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "status": "Approved"
}
```
*Should return: "Book is not pending approval"*

**Try to approve without admin token:**
```
PATCH http://localhost:5000/api/Books/{book_id}/status
Content-Type: application/json

{
  "status": "Approved"
}
```
*Should return: 401 Unauthorized*

## Expected Responses

### Successful Book Addition
```json
{
  "message": "Book added successfully",
  "book": {
    "_id": "book_id",
    "Title": "Five Love Languages",
    "Status": "Pending",
    "Owner": "user_id"
  }
}
```

### Successful Approval
```json
{
  "message": "Book approved successfully",
  "book": {
    "_id": "book_id",
    "Title": "Five Love Languages",
    "Status": "Approved"
  }
}
```

### Validation Error
```json
{
  "message": "Book with similar Title, Image, or Pdf already exists"
}
```

## Database Changes
- **Book Model**: Added `Status` field with default "Pending"
- **User Model**: Existing roles ("User", "Admin", "Owner")

## Email Templates
- **Admin Notification**: Subject: "New Book Added for Approval"
- **Approval Notification**: Subject: "Book approved"
- **Rejection Notification**: Subject: "Book rejected"

## Security Notes
- All book operations require authentication
- Admin-only endpoints use `authorizeRoles("Admin")` middleware
- Owner/Admin can update/delete their own books
- Email notifications include relevant user information
