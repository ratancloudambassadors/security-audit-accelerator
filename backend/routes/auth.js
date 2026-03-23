const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-local-key-for-jwt';

// Helper for Real Email Sending
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOtpEmail = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: `"AuditScope Security" <${process.env.SMTP_USER}>`,
      to: email,
      subject: '🛡️ AuditScope Security - Verify Your Email',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #0f172a;">AuditScope Security</h2>
          <p>Thank you for registering. Please use the following 6-digit code to verify your email address:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #ef4444; margin: 20px 0;">${otp}</div>
          <p>This code will expire in 15 minutes.</p>
          <hr style="border-top: 1px solid #eee; margin-top: 30px;" />
          <p style="font-size: 12px; color: #94a3b8;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `
    });
    console.log(`Real OTP Email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error("Nodemailer failed to send email. Check your SMTP credentials in .env! Error:", error);
    // We throw to notify the frontend
    throw new Error('Failed to send OTP email. Contact support.');
  }
};

// Register User
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || email.split('@')[0],
        isVerified: false,
        otp,
        otpExpiry,
      }
    });

    await sendOtpEmail(email, otp);

    res.status(201).json({
      success: true,
      message: 'OTP sent to email',
      email: newUser.email
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    if (user.otp !== otp || new Date() > new Date(user.otpExpiry)) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Mark as verified
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, otp: null, otpExpiry: null }
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        displayPicture: user.displayPicture
      }
    });

  } catch (error) {
    console.error('OTP Verification Error:', error);
    res.status(500).json({ error: 'Server error during verification' });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email first. Contact support if you did not receive a code.', requiresOtp: true, email: user.email });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        displayPicture: user.displayPicture
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// GET Current User (Verify Token)
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, displayPicture: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// Update Current User Profile
router.put('/profile', upload.single('displayPicture'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if the user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {};
    if (req.body.name) {
      updateData.name = req.body.name;
    }

    if (req.file) {
      // Create the URL path relative to the server host
      updateData.displayPicture = `/uploads/avatars/${req.file.filename}`;
    }

    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: updateData,
      select: { id: true, email: true, name: true, displayPicture: true }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Profile Update Error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Invalid or expired token' });
    } else {
      res.status(500).json({ error: 'Server error during profile update' });
    }
  }
});

module.exports = router;
