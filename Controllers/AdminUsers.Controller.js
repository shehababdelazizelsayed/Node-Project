/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin user management
 */

/**
 * @swagger
 * /api/Admin/Users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 *
 * /api/Admin/Users/{id}:
 *   get:
 *     summary: Get a single user by ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 *
 *   delete:
 *     summary: Delete a user (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *
 * /api/Admin/Users/role/{id}:
 *   patch:
 *     summary: Change a user's role (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Role:
 *                 type: string
 *                 enum: [User, Owner, Admin]
 *     responses:
 *       200:
 *         description: User role updated
 *       400:
 *         description: Invalid role
 *       404:
 *         description: User not found
 */

const User = require('../models/User');


const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, '_id Name Email Role IsVerified').sort({ createdAt: -1 });
    return res.status(200).json(users);
  } catch (error) {
    console.error('getAllUsers error:', error);
    return res.status(500).json({ message: error.message });
  }
};


const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id, '_id Name Email Role IsVerified');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    console.error('getUserById error:', error);
    res.status(500).json({ message: error.message });
  }
};


const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @swagger
 * /api/Admin/Users/{id}:
 *   put:
 *     summary: Update a user (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Name:
 *                 type: string
 *               Email:
 *                 type: string
 *               Role:
 *                 type: string
 *                 enum: [User, Owner, Admin]
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { Role } = req.body;
    const validRoles = ['User', 'Owner', 'Admin'];

    if (!validRoles.includes(Role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.Role = Role;
    await user.save();

    res.status(200).json({
      message: 'User role updated successfully',
      user: { Name: user.Name, Email: user.Email, Role: user.Role },
    });
  } catch (error) {
    console.error('changeUserRole error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  deleteUser,
  changeUserRole,
};

