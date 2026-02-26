import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import {
  createPost,
  getFeed,
  searchPosts,
  getSavedPosts,
  getLikedPosts,
  savePost as saveToUser,
} from '../controllers/postController.js';
import {
  likePost,
  addComment,
  deleteComment,
  likeComment,
  replyToComment,
  sharePost,
  savePost as saveToPost,
  getComments,
  incrementView,
} from '../controllers/interactionController.js';

const upload = multer();

const router = express.Router();

// Post CRUD
router.route('/')
  .post(protect, upload.single('video'), createPost);

router.get('/feed', protect, getFeed);
router.get('/search', protect, searchPosts);

// Interactions
router.post('/:id/like', protect, likePost);
router.post('/:id/save', protect, saveToPost);
router.post('/:id/share', protect, sharePost);
router.post('/:id/view', protect, incrementView);

// Comments
router.get('/:id/comments', protect, getComments);
router.post('/:id/comment', protect, addComment);
router.delete('/:postId/comments/:commentId', protect, deleteComment);
router.post('/:postId/comments/:commentId/like', protect, likeComment);
router.post('/:postId/comments/:commentId/reply', protect, replyToComment);
//profile
router.get('/saved', protect, getSavedPosts);
router.get('/liked', protect, getLikedPosts);
router.post('/:id/save', protect, saveToUser);

export default router;