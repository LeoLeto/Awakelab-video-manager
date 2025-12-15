# Authentication Setup Guide

## Quick Setup

1. **Copy the environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Generate hashed passwords for your users:**

   Run this command in your terminal (from the server directory):
   ```bash
   node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourPasswordHere', 10, (err, hash) => { if (err) console.error(err); else console.log(hash); });"
   ```

   Replace `YourPasswordHere` with the actual password you want to use.

3. **Update your .env file with the hashed passwords:**

   ```env
   USER_1=admin:$2b$10$YourHashedPasswordHere
   USER_2=manager:$2b$10$AnotherHashedPasswordHere
   USER_3=viewer:$2b$10$ThirdHashedPasswordHere
   ```

   Format: `USER_N=username:hashed_password`

4. **Set a strong JWT secret:**
   ```env
   JWT_SECRET=your-super-secret-random-string-here
   ```

   Generate a random string for production using:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'));"
   ```

## Adding New Users

1. Generate a hashed password using the command above
2. Add a new line to your `.env` file: `USER_N=username:hashed_password`
3. Restart the server

## Security Notes

- ✅ Never commit your `.env` file to Git
- ✅ Use strong, unique passwords for each user
- ✅ Change the default JWT_SECRET
- ✅ The JWT token expires after 24 hours (configurable via JWT_EXPIRY)
- ✅ Passwords are hashed with bcrypt (10 rounds)

## Default Demo Credentials (CHANGE THESE!)

Username: `admin`  
Password: `password123`

Username: `manager`  
Password: `password123`
