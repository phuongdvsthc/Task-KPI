require('dotenv').config();
console.log("URL:", process.env.DATABASE_URL || "No DATABASE_URL");
