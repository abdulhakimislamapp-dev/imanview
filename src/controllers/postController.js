import Post from '../models/Post.js';
import Notification from '../models/Notification.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

// @desc    Create a new post
// @route   POST /api/posts
export const createPost = async (req, res) => {
  try {
    const { caption } = req.body;
    const file = req.file; // from multer

    if (!file) {
      return res.status(400).json({ message: 'Video file is required' });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(file.buffer);
    const videoUrl = result.secure_url;
    // Generate thumbnail (Cloudinary can transform URL)
    const thumbnail = result.secure_url.replace('/upload/', '/upload/w_500/'); // simple thumbnail from video

    const post = await Post.create({
      user: req.user._id,
      videoUrl,
      thumbnail,
      caption,
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Like/unlike a post
// @route   POST /api/posts/:id/like
export const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.user._id;
    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {
      // Unlike
      post.likes = post.likes.filter((id) => id.toString() !== userId.toString());
    } else {
      // Like
      post.likes.push(userId);
      // Create notification for post owner (if not self)
      if (post.user.toString() !== userId.toString()) {
        await Notification.create({
          user: post.user,
          type: 'like',
          from: userId,
          post: post._id,
        });
      }
    }

    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Add comment to post
// @route   POST /api/posts/:id/comment
export const commentOnPost = async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = {
      user: req.user._id,
      text,
    };

    post.comments.push(comment);
    await post.save();

    // Populate user info for the comment
    const populatedPost = await Post.findById(post._id).populate('comments.user', 'username avatar');

    // Create notification for post owner
    if (post.user.toString() !== req.user._id.toString()) {
      await Notification.create({
        user: post.user,
        type: 'comment',
        from: req.user._id,
        post: post._id,
      });
    }

    res.json(populatedPost.comments[populatedPost.comments.length - 1]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get feed (paginated)
// @route   GET /api/posts/feed?page=1&limit=10
export const getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // For simplicity, get all posts sorted by newest. Later you can implement following-based feed.
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username avatar')
      .populate('comments.user', 'username avatar');

    const total = await Post.countDocuments();

    res.json({
      posts,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Search posts by caption or user
// @route   GET /api/posts/search?q=query
export const searchPosts = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    // Search in captions (case-insensitive) and also join with users to search by username
    const posts = await Post.find({
      $or: [
        { caption: { $regex: q, $options: 'i' } },
      ],
    })
      .populate('user', 'username avatar')
      .populate('comments.user', 'username avatar')
      .limit(20);

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
