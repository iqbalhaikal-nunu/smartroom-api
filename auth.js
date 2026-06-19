const express = require('express');
const connectDB = require('./db');

const router = express.Router();

// ===================== REGISTER =====================
// Matches RegisterServlet.java logic
// Body: { userId, fullName, password, role }   role = "admin" or "student"

router.post('/register', async (req, res) => {
  const db = await connectDB();
  const { userId, fullName, password, role } = req.body;

  if (!userId || !password || !role) {
    return res.json({ status: 'error', message: 'userId, password, and role are required.' });
  }

  const collectionName = role === 'admin' ? 'admins' : 'students';
  // students are matched by "name" in the original SQL, admins by "username"
  const idField = role === 'admin' ? 'username' : 'name';

  console.log(`DEBUG: Register request -> UserID: ${userId} | Name: ${fullName} | Role: ${role}`);

  try {
    const collection = db.collection(collectionName);

    // check if user already exists
    const existing = await collection.findOne({ [idField]: userId });

    if (existing) {
      return res.json({
        status: 'error',
        message: `User ID / Name '${userId}' sudah wujud dalam sistem bagi role: ${role}`
      });
    }

    // insert new user
    const newUser = { [idField]: userId, password: password };
    if (role !== 'admin' && fullName) {
      newUser.fullName = fullName;
    }

    const result = await collection.insertOne(newUser);

    if (result.acknowledged) {
      console.log('DEBUG: Registration Success!');
      return res.json({
        status: 'success',
        message: 'Pendaftaran akaun berjaya! Anda boleh log masuk sekarang.'
      });
    } else {
      return res.json({ status: 'error', message: 'Gagal mendaftarkan akaun. Sila cuba lagi.' });
    }
  } catch (err) {
    console.log('DEBUG: Register Database Exception -> ' + err.message);
    return res.json({ status: 'fail', message: 'Database Service Error: ' + err.message });
  }
});

// ===================== LOGIN =====================
// Matches AuthServlet.java logic
// Body: { userid, password, role }

router.post('/login', async (req, res) => {
  const db = await connectDB();
  const { userid, password, role } = req.body;

  console.log(`DEBUG: Login request -> User: ${userid} | Role: ${role}`);

  if (!userid || !password || !role) {
    return res.json({ status: 'error', message: 'userid, password, and role are required.' });
  }

  const collectionName = role === 'admin' ? 'admins' : 'students';
  const idField = role === 'admin' ? 'username' : 'name';

  try {
    const collection = db.collection(collectionName);
    const user = await collection.findOne({ [idField]: userid, password: password });

    if (user) {
      console.log('DEBUG: Authentication Success!');
      return res.json({
        status: 'success',
        message: 'Authentication successful.',
        role: role,
        userId: userid
      });
    } else {
      console.log('DEBUG: Authentication Failed!');
      return res.json({
        status: 'error',
        message: `Invalid User ID or Password for role: ${role}`
      });
    }
  } catch (err) {
    console.log('DEBUG: Database Exception -> ' + err.message);
    return res.json({ status: 'fail', message: 'Database Service Error: ' + err.message });
  }
});

module.exports = router;
