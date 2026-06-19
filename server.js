const express = require('express');
const { ObjectId } = require('mongodb');
const connectDB = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json()); // lets us read JSON from request bodies

const PORT = process.env.PORT || 3000;

// ===================== ROOMS ROUTES =====================

// GET all rooms
app.get('/rooms', async (req, res) => {
  const db = await connectDB();
  const rooms = await db.collection('rooms').find().toArray();
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
  const result = await db.collection('rooms').insertOne(req.body);
  res.status(201).json({ insertedId: result.insertedId });
});

// PUT update a room by id
app.put('/rooms/:id', async (req, res) => {
  const db = await connectDB();
  const result = await db.collection('rooms').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: req.body }
  );
  res.json({ modifiedCount: result.modifiedCount });
});

// DELETE a room by id
app.delete('/rooms/:id', async (req, res) => {
  const db = await connectDB();
  const result = await db.collection('rooms').deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ deletedCount: result.deletedCount });
});

// ===================== BOOKINGS ROUTES =====================

// GET all bookings
app.get('/bookings', async (req, res) => {
  const db = await connectDB();
  const bookings = await db.collection('bookings').find().toArray();
  res.json(bookings);
});

// POST create a new booking
app.post('/bookings', async (req, res) => {
  const db = await connectDB();

  // check the room exists and is available
  const room = await db.collection('rooms').findOne({ _id: new ObjectId(req.body.roomId) });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.isAvailable) return res.status(400).json({ error: 'Room is not available' });

  const booking = {
    roomId: new ObjectId(req.body.roomId),
    bookedBy: req.body.bookedBy,
    date: req.body.date,
    startTime: req.body.startTime,
    endTime: req.body.endTime
  };

  const result = await db.collection('bookings').insertOne(booking);

  // mark the room as unavailable
  await db.collection('rooms').updateOne(
    { _id: new ObjectId(req.body.roomId) },
    { $set: { isAvailable: false } }
  );

  res.status(201).json({ insertedId: result.insertedId });
});

// DELETE a booking (cancel it, and free up the room again)
app.delete('/bookings/:id', async (req, res) => {
  const db = await connectDB();

  const booking = await db.collection('bookings').findOne({ _id: new ObjectId(req.params.id) });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  await db.collection('bookings').deleteOne({ _id: new ObjectId(req.params.id) });

  // free the room back up
  await db.collection('rooms').updateOne(
    { _id: booking.roomId },
    { $set: { isAvailable: true } }
  );

  res.json({ message: 'Booking cancelled, room is now available' });
});

// ===================== START SERVER =====================

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});