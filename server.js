const express = require('express');
const path = require('path');
const cors = require('cors');
const { ObjectId } = require('mongodb');
const connectDB = require('./db');
const authRoutes = require('./auth');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend (public/) — this is what makes the UI show up at
// https://smartroom-api-1.onrender.com/ instead of "Cannot GET /"
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRoutes);

const PORT = process.env.PORT || 3000;

// ===================== ROOMS ROUTES =====================
// Matches Room.java fields: roomName, capacity, availability, speciality

// GET all rooms
app.get('/rooms', async (req, res) => {
  const db = await connectDB();
  const rooms = await db.collection('rooms').find().toArray();
  res.json(rooms);
});

// GET rooms with optional search filters: /rooms/search?speciality=Conference&minCapacity=10
app.get('/rooms/search', async (req, res) => {
  const db = await connectDB();
  const filter = {};

  if (req.query.speciality) {
    filter.speciality = req.query.speciality;
  }
  if (req.query.minCapacity) {
    filter.capacity = { $gte: parseInt(req.query.minCapacity) };
  }
  if (req.query.availability) {
    filter.availability = req.query.availability; // e.g. "Available"
  }

  const rooms = await db.collection('rooms').find(filter).toArray();
  res.json(rooms);
});

// GET one room by id
app.get('/rooms/:id', async (req, res) => {
  const db = await connectDB();
  const room = await db.collection('rooms').findOne({ _id: new ObjectId(req.params.id) });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

// POST create a new room
app.post('/rooms', async (req, res) => {
  const db = await connectDB();
  const room = {
    roomName: req.body.roomName,
    capacity: req.body.capacity,
    availability: req.body.availability || 'Available',
    speciality: req.body.speciality
  };
  const result = await db.collection('rooms').insertOne(room);
  res.status(201).json({ insertedId: result.insertedId });
});

// PUT update a room by id
app.put('/rooms/:id', async (req, res) => {
  const db = await connectDB();
  const result = await db.collection('rooms').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: req.body }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: 'Room not found' });
  res.json({ modifiedCount: result.modifiedCount });
});

// DELETE a room by id
app.delete('/rooms/:id', async (req, res) => {
  const db = await connectDB();
  const result = await db.collection('rooms').deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ deletedCount: result.deletedCount });
});

// ===================== BOOKINGS ROUTES =====================
// Matches Booking.java fields: roomId, studentId, bookingDate, timeSlot, status
// Matches BookingDAO.java logic: check slot conflict, insert as 'Confirmed',
// cancel = update status to 'Cancelled' (not deleted)

// GET all bookings
app.get('/bookings', async (req, res) => {
  const db = await connectDB();
  const bookings = await db.collection('bookings').find().toArray();
  res.json(bookings);
});

// GET bookings for a specific room
app.get('/bookings/room/:roomId', async (req, res) => {
  const db = await connectDB();
  const bookings = await db.collection('bookings')
    .find({ roomId: req.params.roomId })
    .toArray();
  res.json(bookings);
});

// POST create a new booking
// Body: { roomId, studentId, bookingDate, timeSlot }
app.post('/bookings', async (req, res) => {
  const db = await connectDB();
  const { roomId, studentId, bookingDate, timeSlot } = req.body;

  if (!roomId || !studentId || !bookingDate || !timeSlot) {
    return res.status(400).json({ error: 'roomId, studentId, bookingDate, and timeSlot are required' });
  }

  // confirm the room exists
  const room = await db.collection('rooms').findOne({ _id: new ObjectId(roomId) });
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // check slot conflict: same room + same date + same time slot + status not Cancelled
  const existing = await db.collection('bookings').findOne({
    roomId: roomId,
    bookingDate: bookingDate,
    timeSlot: timeSlot,
    status: { $ne: 'Cancelled' }
  });

  if (existing) {
    return res.status(409).json({ error: 'This room is already booked for that date and time slot' });
  }

  const booking = {
    roomId: roomId,
    studentId: studentId,
    bookingDate: bookingDate,
    timeSlot: timeSlot,
    status: 'Confirmed'
  };

  const result = await db.collection('bookings').insertOne(booking);
  res.status(201).json({ insertedId: result.insertedId, ...booking });
});

// PUT update booking status (e.g. cancel) — matches updateBookingStatus()
// Body: { status: "Cancelled" }
app.put('/bookings/:id/status', async (req, res) => {
  const db = await connectDB();
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: 'status is required' });

  const result = await db.collection('bookings').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status: status } }
  );

  if (result.matchedCount === 0) return res.status(404).json({ error: 'Booking not found' });
  res.json({ modifiedCount: result.modifiedCount, status: status });
});

// DELETE a booking permanently (hard delete, separate from cancelling)
app.delete('/bookings/:id', async (req, res) => {
  const db = await connectDB();
  const result = await db.collection('bookings').deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ deletedCount: result.deletedCount });
});

// ===================== START SERVER =====================

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
