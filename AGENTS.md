# Project Overview

This is a full-stack time tracking application designed to aggregate time entries from different sources like Toggl and Tempo. It consists of a React-based frontend and a Node.js (Fastify) backend.

## Architecture

*   **Frontend**: A single-page application built with React, Vite, and TypeScript. It uses Tailwind CSS for styling and Recharts for creating interactive charts.
*   **Backend**: A RESTful API built with Node.js, Fastify, and TypeScript. It handles data aggregation, CSV imports, and synchronization with external services.
*   **Database**: An SQLite database managed with Prisma ORM. The schema is defined in `backend/prisma/schema.prisma`.

## Key Features

*   **Unified Dashboard**: Displays aggregated time entries from all sources in a single view.
*   **Data Visualization**: An interactive chart shows daily work hours.
*   **CSV Import**: Supports importing time entries from Toggl and Tempo CSV files.
*   **API Synchronization**: Can directly sync with Toggl and Tempo APIs.
*   **CRUD Operations**: Allows creating, reading, updating, and deleting time entries.
*   **Filtering and Sorting**: Provides options to filter entries by source, project, and date range, and to sort the data.

# Building and Running

## Backend (Port 3000)

1.  **Install Dependencies**:
    ```bash
    cd backend
    npm install
    ```
2.  **Initialize Database**:
    *   The database is an SQLite file (`dev.db`). The schema is managed by Prisma.
    *   To apply migrations, run:
        ```bash
        npx prisma migrate dev
        ```
    *   To view the database with Prisma Studio:
        ```bash
        npx prisma studio
        ```
3.  **Run in Development Mode**:
    ```bash
    npm run dev
    ```
    The server will be available at `http://localhost:3000`.

## Frontend (Port 5173 by default)

1.  **Install Dependencies**:
    ```bash
    cd frontend
    npm install
    ```
2.  **Run in Development Mode**:
    ```bash
    npm run dev
    ```
    The frontend will be available at `http://localhost:5173`. API requests to `/api` are automatically proxied to the backend on port 3000.

# Development Conventions

*   **Code Style**: The project uses Prettier for code formatting (inferred from `eslint-config-prettier`).
*   **Linting**: ESLint is used for static code analysis. Run `npm run lint` in the `frontend` directory to check for issues.
*   **Type Safety**: Both frontend and backend are written in TypeScript with strict mode enabled.
*   **API Communication**: The frontend communicates with the backend via RESTful API calls. The endpoints are defined in `backend/src/server.ts`.
*   **Database Migrations**: Database schema changes should be managed using Prisma Migrate.
