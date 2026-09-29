const express = require('express');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const serializeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber || '',
  phone: user.phoneNumber || '',
  role: user.role,
  profileImage: user.profileImage || '',
  joinedAt: user.createdAt,
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phoneNumber, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account already exists with this email.',
      });
    }

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      phoneNumber: phoneNumber || phone || '',
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors)[0]?.message || 'Invalid user data.';
      return res.status(400).json({ success: false, message });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to register user at this time.',
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to log in at this time.',
    });
  }
});

router.get('/me', protect, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: serializeUser(req.user),
  });
});

module.exports = router;
