const express = require('express');
const connectDB = require('./db');

const router = express.Router();

// ===================== REGISTER =====================
// Matches RegisterServlet.java logic
// Body: { userId, fullName, password, role }   role = "admin" or "student"

router.post('/register', async (req, res) => {
  const db = await connectDB();
  const { userId, fullName, email, password, role } = req.body;

  if (!userId || !password || !role) {
    return res.json({ status: 'error', message: 'userId, password, and role are required.' });
  }

  const collectionName = role === 'admin' ? 'admins' : 'students';
  // students are matched by "name" in the original SQL, admins by "username"
  const idField = role === 'admin' ? 'username' : 'name';

  console.log(`DEBUG: Register request -> UserID: ${userId} | Name: ${fullName} | Email: ${email} | Role: ${role}`);

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
    const newUser = { [idField]: userId, password: password, email: email || null };
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
        userId: userid,
        email: user.email || ''
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

// ===================== FORGOT PASSWORD =====================
// Matches ForgotPasswordServlet.java logic
// Body: { userid, role, newPassword }
// No login required — resets the password for a known userid + role.

router.post('/forgot-password', async (req, res) => {
  const db = await connectDB();
  const { userid, role, newPassword } = req.body;

  if (!userid || !role || !newPassword) {
    return res.json({ status: 'error', message: 'userid, role, and newPassword are required.' });
  }

  const collectionName = role === 'admin' ? 'admins' : 'students';
  const idField = role === 'admin' ? 'username' : 'name';

  try {
    const collection = db.collection(collectionName);
    const existing = await collection.findOne({ [idField]: userid });

    if (!existing) {
      return res.json({
        status: 'error',
        message: `User ID / Name tidak ditemui bagi peranan ${role}!`
      });
    }

    const result = await collection.updateOne(
      { [idField]: userid },
      { $set: { password: newPassword } }
    );

    if (result.modifiedCount > 0) {
      return res.json({
        status: 'success',
        message: 'Kata laluan akaun anda berjaya dikeset semula. Sila log masuk.'
      });
    } else {
      return res.json({ status: 'error', message: 'Gagal mengemas kini pangkalan data.' });
    }
  } catch (err) {
    console.log('DEBUG: Forgot Password Exception -> ' + err.message);
    return res.json({ status: 'fail', message: 'Ralat Database Servis: ' + err.message });
  }
});

// ===================== UPDATE PROFILE =====================
// Matches UpdateProfileServlet.java logic, adapted for a stateless API:
// since there's no server session, the frontend sends the CURRENT userId
// + role to identify who's updating (taken from localStorage, set at login).
// Body: { currentUserId, role, newUserId, email, oldPassword, newPassword }

router.put('/profile', async (req, res) => {
  const db = await connectDB();
  const { currentUserId, role, newUserId, email, oldPassword, newPassword } = req.body;

  if (!currentUserId || !role || !newUserId) {
    return res.json({ status: 'error', message: 'Your session has expired. Please log in again.' });
  }

  const collectionName = role === 'admin' ? 'admins' : 'students';
  const idField = role === 'admin' ? 'username' : 'name';

  try {
    const collection = db.collection(collectionName);
    const existing = await collection.findOne({ [idField]: currentUserId });

    if (!existing) {
      return res.json({ status: 'error', message: 'Your session has expired. Please log in again.' });
    }

    const changePassword = !!(newPassword && newPassword.trim());

    // Verify current password if the user is trying to change it
    if (changePassword) {
      if (!oldPassword || existing.password !== oldPassword) {
        return res.json({ status: 'error', message: 'The current password you entered is incorrect!' });
      }
    }

    // Guard against renaming into a userId that's already taken by someone else
    if (newUserId !== currentUserId) {
      const clash = await collection.findOne({ [idField]: newUserId });
      if (clash) {
        return res.json({ status: 'error', message: `User ID '${newUserId}' is already taken.` });
      }
    }

    const updateFields = { [idField]: newUserId, email: email || '' };
    if (changePassword) updateFields.password = newPassword;

    const result = await collection.updateOne({ _id: existing._id }, { $set: updateFields });

    if (result.matchedCount > 0) {
      // Keep existing bookings pointing at the right student if their userId changed
      if (role === 'student' && newUserId !== currentUserId) {
        await db.collection('bookings').updateMany(
          { studentId: currentUserId },
          { $set: { studentId: newUserId } }
        );
      }

      return res.json({
        status: 'success',
        message: 'Your profile and account information have been successfully updated.',
        userId: newUserId,
        email: email || ''
      });
    } else {
      return res.json({ status: 'error', message: 'Failed to update database records. No shifts detected.' });
    }
  } catch (err) {
    console.log('DEBUG: Update Profile Exception -> ' + err.message);
    return res.json({ status: 'fail', message: 'Profile Service Error: ' + err.message });
  }
});

// ===================== REGISTERED STUDENTS (admin only) =====================
// Matches UserServlet.java logic (GET = list, POST id = delete).
// Exposed here as proper REST verbs instead.

router.get('/students', async (req, res) => {
  const db = await connectDB();
  try {
    const students = await db.collection('students')
      .find({}, { projection: { _id: 1, name: 1 } })
      .toArray();
    return res.json({ status: 'success', users: students });
  } catch (err) {
    return res.json({ status: 'error', message: err.message });
  }
});

router.delete('/students/:id', async (req, res) => {
  const db = await connectDB();
  const { ObjectId } = require('mongodb');
  try {
    const result = await db.collection('students').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount > 0) {
      return res.json({ status: 'success', message: 'User deleted successfully' });
    } else {
      return res.json({ status: 'error', message: 'User not found' });
    }
  } catch (err) {
    return res.json({ status: 'error', message: err.message });
  }
});

module.exports = router;
