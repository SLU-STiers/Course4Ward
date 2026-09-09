# Course4Ward

# Table of Contents
- Introduction
- Prerequisites
- Installation
- Quick Start
- Usage
- Technology Stack

# **Introduction**
The preparation of the Course in the Ward section of Philhealth's Claim Form 4 (CF4) at SLU Sacred Heart Medical Center involves summarizing the physician's orders given to a patient throughout their entire stay in the hospital. The existing process in SLU Sacred Heart heavily relies on manual documentation on these orders done by the physician. The hospital's Claims Processor may need to summarize multiple days of the physician's orders after a patient has been discharged by the hospital.

Course4Ward is an AI-assisted web application that is designed to streamline the manual process by reducing the workload of manually summarizing the physician's orders. The web application uses a fine-tuned Qwen3.5-4B Large Language Model (LLM) along with Retrieval-Augmented Generation (RAG) to generate a structured Course in the Ward summaries. These AI-generated summaries are then reviewed and validated by the physicians before being prepared for PhilHealth's CF4.

# **Prerequisites**
Before all initialization activities, make sure that you have the following prerequisites to get the program running smoothly:
- Ensure that the latest Node.js version is installed within the terminal
- PostgreSQL is installed in the terminal
- Ollama is installed in the terminal
- Project files are installed or cloned in the terminal
- There is C++ support in Visual Studio
- Docker is installed in the terminal
- (Add More, if meron)

# **Installation**
1. After installing or cloning the project files, head to the frontend folder using the following command in the terminal within VS Code:
- cd frontend 
2. Find the "backend" folder in the files menu on the left portion of VS Code (or the software application you are using)
3. Create a file and name it ".env".
4. Paste the following inside the file:
- DATABASE_URL="postgresql://postgres:root@localhost:5432/course4ward"
JWT_ACCESS_SECRET=change_me_access_secret
JWT_REFRESH_SECRET=change_me_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:8000
PORT=3000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=SuperKey123!
5. Install all the npm dependencies using the command:
- npm install
6. Do the same from the backend folder. You may use the following commands in order:
- cd .. (Goes back to the previous directory)
- cd backend
- npm install
7. On your machine, go to the search bar and type:
- X64 Native Tools Command Prompt for VS 2022 (Run as administrator)
8. Type the following command (line-by-line):
- set "PGROOT=C:\Program Files\PostgreSQL\18"
- cd %TEMP%
- git clone --branch v0.8.6 https://github.com/pgvector/pgvector.git
- cd pgvector
- nmake /F Makefile.win
- nmake /F Makefile.win install
9. Open postgreSQL, click the “Server” tab, and enter the account credentials you have set during the installation phase.
10. Go back to VS Code and change your directory to the backend (if you’re not in the backend directory). Type the following command:
- npx prisma generate
- npx prisma db seed
11. The database schema “course4ward” should be created in postgreSQL.
9. Go back to VS Code and on the terminal, go to the backend directory and type the following:
- npm run start:dev
12. Go to the frontend directory and type the following:
- npm run dev
13. Click on the “local” link.
14. (TO BE CONTINUED/REVISED)

# **Quick Start**
Once the prerequisites are followed and the installation steps are done, you may start the Course4Ward web application using the command:
    npm run dev

You will see a local development address provided in the terminal. Click it and you will then be redirected to the web application's login page.

# **Usage**
The Course4Ward Web Application provides multiple functionalities depending on the user's assigned role based on the credentials they used in the login page.


# Physician
Users under the "Physician" module can do the following functionalities:
- View Patients
- Enter Physician's Orders on a selected patient
- View AI-summarized physician's orders
- Edit AI-summarized orders
- Validate and approve finalized summaries

# Nurse
Users under the "Nurse" module can do the following functionalities:
- Register and manage patients
- Search a specific's patient information
- Encode the Physician's orders on behalf of the physician he/she are attending to
- View the Physician's orders
- View the AI-summarized summaries

# Claims Processor
Users under the "Claims Processor" module can do the following functionalities:
- Review AI-summarized Physician's orders summaries
- Request an AI-summary verification from the physicians
- Check AI-summaries before CF4 preparation
- Prepare the PhilHealth CF4

# Administrator
Users under the "Administrator" module can do the following:
- Create user accounts
- View user accounts
- Update user information
- Delete user accounts
- View transaction logs

# **Technology Stack**
The following technologies are used in the development of the Course4Ward Web Application:

# FrontEnd
- React.js
- HTML5
- CSS
- JavaScript

# Backend
- Node.js
- PostgreSQL
- Prisma ORM

# Artificial Intelligence (AI)
- Qwen3.5-4B
- Retrieval-Augmented Generation (RAG)
- Ollama

# Development and Deployment
- GitHub
- Docker
