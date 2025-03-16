# 🚀 FlagConquest Backend  

The **FlagConquest Backend** is the core server-side application for the **FlagConquest** platform, a web-based **Capture The Flag (CTF)** challenge system. It is built using **Node.js with Hapi.js**, providing a structured and scalable API for managing users, challenges, flag submissions, and scoring.  

## 🌟 Key Features  

✅ **RESTful API** to manage users, challenges, and flag submissions  
✅ **Secure JWT-based authentication** for user sessions  
✅ **Support for multiple CTF categories**: General Skills, Cryptography, Network, and Forensics  
✅ **Database integration** with PostgreSQL (Sequelize ORM)  
✅ **Security measures** including input validation, rate limiting, and CORS  

## 🚀 Tech Stack  

| Component        | Technology        |
|-----------------|------------------|
| **Backend**     | Node.js with Hapi.js |
| **Database**    | PostgreSQL (Sequelize ORM) |
| **Authentication** | JSON Web Token (JWT) |
| **Development Tools** | Nodemon (for development), Docker (for deployment) |

## ⚙️ Installation  

Follow these steps to set up and run the **FlagConquest Backend**:  

1️⃣ **Clone the repository**  
   ```bash
   git clone https://github.com/Senior-Project49X/Flagcq-Backend.git
```
2️⃣ **Install dependencies**
 ```bash
  npm install
```
3️⃣ **Run the backend server**
```bash
  npm start
```

## 📜 API Endpoints (Example)
| Method |	Endpoint	|Description|
|--------|-------------------------|----------------------------------|
| GET    | ```/api/questions/user```| Retrieve all questions (for user role)  |
| POST    | ```/api/question```| Create a new question (admin only)  |
| PUT    | ```/api/questions/{id}```| Update a question (admin only)  |
| DELETE |  ```/api/question/{id}```| Delete a question (admin only)  |

