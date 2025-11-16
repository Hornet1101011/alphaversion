# Barangay Information System

A comprehensive information management system for barangay administration with role-based access control.

## Features

- Multi-role user system (Admin, Staff, Resident)
- Secure authentication and authorization
- Modern UI with Material-UI components
- Full-stack TypeScript implementation

## Project Structure

```
.
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/        # Role-based page components
│   │   │   ├── admin/    # Admin-specific pages
│   │   │   ├── staff/    # Staff-specific pages
│   │   │   └── resident/ # Resident-specific pages
│   │   ├── services/     # API services
│   │   ├── context/      # React Context providers
│   │   ├── utils/        # Utility functions
│   │   └── styles/       # CSS and styling
│   └── public/           # Static files
│
└── server/                # Express Backend
    ├── src/
    │   ├── controllers/  # Request handlers
    │   ├── models/       # Database models
    │   ├── routes/       # API routes
    │   ├── middleware/   # Custom middleware
    │   └── config/       # Configuration files
    └── .env              # Environment variables
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. Configure environment variables:
   - Create a `.env` file in the server directory
   - Add the following variables:
     ```
     PORT=5000
     MONGODB_URI=mongodb://localhost:27017/barangay_system
     JWT_SECRET=your_jwt_secret_key_here
     ```

4. Start the development servers:
   ```bash
   # Start backend server
   cd server
   npm run dev

   # Start frontend development server
   cd ../client
   npm start
   ```

## Available Scripts

### Server

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server

### Client

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## License

This project is licensed under the ISC License.
