require("dotenv").config();
console.log("ENV keys:", Object.keys(process.env).filter(k => !k.includes("KEY") && !k.includes("SECRET")));
console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);
