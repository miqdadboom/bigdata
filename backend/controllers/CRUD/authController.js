const User = require('../../models/CRUD/User');

// Simple login (no password hashing for simplicity)
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username, isActive: true });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Simple session token (just return user info)
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        sector: user.sector,
        role: user.role,
        companyId: user.companyId,
        companyName: user.companyName
      },
      token: Buffer.from(`${user.username}:${user.role}`).toString('base64') // Simple token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get current user (simple token validation)
exports.getCurrentUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username, role] = decoded.split(':');

    const user = await User.findOne({ username, role, isActive: true });

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        sector: user.sector,
        role: user.role,
        companyId: user.companyId,
        companyName: user.companyName
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

