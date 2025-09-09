# SecureGov: Secure Document Management System

## Description

This project is a secure web application designed for government entities to manage documents efficiently. It features a user authentication system (registration and login), a central dashboard for users, and robust document handling capabilities. The backend is powered by Node.js and utilizes MongoDB with GridFS for storing large files securely, while the frontend is structured with modular components for easy maintenance.

## Features

- **User Authentication:** Secure user registration and login functionality.
- **Document Management:** Upload, store, and manage documents securely.
- **Dashboard:** A central dashboard for users to access and manage their files.
- **Secure File Storage:** Utilizes MongoDB's GridFS to handle large and sensitive files efficiently.

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** MongoDB, Mongoose, GridFS

### Key Dependencies

- `mongoose`: Object Data Modeling (ODM) library for MongoDB.
- `gridfs-stream`: A streaming API for MongoDB GridFS.
- `multer` & `multer-gridfs-storage`: Middleware for handling `multipart/form-data`, used for uploading files.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) installed
- [MongoDB](https://www.mongodb.com/try/download/community) installed and running

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sreesaivhan/SecureGov.git
   cd securegov-project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add your MongoDB connection string:
   ```
   MONGO_URI=your_mongodb_connection_string
   ```

### Running the Application

- **Start the server:**
  ```bash
  node server/server.js
  ```

## Folder Structure

```
securegov-project/
├── assets/             # Static assets like images, icons, docs
├── components/         # Reusable HTML components (header, footer)
├── config/             # Configuration files
├── css/                # CSS stylesheets
├── js/                 # Frontend JavaScript files
├── pages/              # HTML pages (login, register, dashboard)
├── server/             # Backend server files
│   ├── routes/         # API routes
│   └── server.js       # Main server entry point
├── .gitignore          # Files to be ignored by Git
├── index.html          # Main landing page
├── package.json        # Project dependencies and scripts
└── README.md           # Project documentation