import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  followUser,
  getUserProfile,
  updateProfile,
  getSuggestions,
  getFollowing,
  getFollowers,
  searchUsers,
  uploadAvatar
} from '../controllers/userController.js';
import multer from 'multer';
const upload = multer();
const router = express.Router();

router.post('/follow/:id', protect, followUser);
router.get('/profile/:id', protect, getUserProfile);
router.put('/profile', protect, updateProfile);
router.get('/suggestions', protect, getSuggestions);
router.get('/following', protect, getFollowing);
router.get('/followers', protect, getFollowers);
router.get('/search', protect, searchUsers);
router.put('/avatar', protect, upload.single('avatar'), uploadAvatar);


export default router;