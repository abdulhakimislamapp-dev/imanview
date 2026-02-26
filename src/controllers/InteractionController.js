import Post from '../models/Post.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// @desc    Like/Unlike a post
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
      
      // Create notification (if not self-like)
      if (post.user.toString() !== userId.toString()) {
        await Notification.create({
          user: post.user,
          type: 'like',
          from: userId,
          post: post._id,
        });
        
        // Emit socket event for real-time notification
        req.io?.to(post.user.toString()).emit('newNotification', {
          type: 'like',
          from: req.user,
          post: post._id
        });
      }
    }

    await post.save();
    
    // Get updated like count
    const likeCount = post.likes.length;
    
    res.json({ 
      liked: !alreadyLiked, 
      likeCount,
      postId: post._id 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Add comment to post
// @route   POST /api/posts/:id/comment
export const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (!post.allowComments) {
      return res.status(403).json({ message: 'Comments are disabled on this post' });
    }

    const comment = {
      user: req.user._id,
      text: text.trim(),
      likes: [],
      replies: []
    };

    post.comments.push(comment);
    await post.save();

    // Populate user info for the new comment
    const populatedPost = await Post.findById(post._id)
      .populate('comments.user', 'username avatar');
    
    const newComment = populatedPost.comments[populatedPost.comments.length - 1];

    // Create notification for post owner
    if (post.user.toString() !== req.user._id.toString()) {
      await Notification.create({
        user: post.user,
        type: 'comment',
        from: req.user._id,
        post: post._id,
      });
      
      // Emit socket event
      req.io?.to(post.user.toString()).emit('newNotification', {
        type: 'comment',
        from: req.user,
        post: post._id,
        comment: newComment
      });
    }

    res.status(201).json(newComment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete comment
// @route   DELETE /api/posts/:postId/comments/:commentId
export const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user owns the comment or post
    if (comment.user.toString() !== req.user._id.toString() && 
        post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    comment.deleteOne();
    await post.save();

    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Like/unlike a comment
// @route   POST /api/posts/:postId/comments/:commentId/like
export const likeComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userId = req.user._id;
    const alreadyLiked = comment.likes.includes(userId);

    if (alreadyLiked) {
      comment.likes = comment.likes.filter(id => id.toString() !== userId.toString());
    } else {
      comment.likes.push(userId);
    }

    await post.save();

    res.json({ 
      liked: !alreadyLiked, 
      likeCount: comment.likes.length 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Reply to comment
// @route   POST /api/posts/:postId/comments/:commentId/reply
export const replyToComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Reply text is required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const reply = {
      user: req.user._id,
      text: text.trim(),
    };

    comment.replies.push(reply);
    await post.save();

    // Populate user info
    const populatedPost = await Post.findById(postId)
      .populate('comments.replies.user', 'username avatar');

    const updatedComment = populatedPost.comments.id(commentId);
    const newReply = updatedComment.replies[updatedComment.replies.length - 1];

    res.status(201).json(newReply);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Share post
// @route   POST /api/posts/:id/share
export const sharePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    post.shares += 1;
    await post.save();

    // Create notification for share (if shared by someone else)
    if (req.body.sharedWith) {
      // This could be a user ID or 'external' for external shares
      await Notification.create({
        user: post.user,
        type: 'share',
        from: req.user._id,
        post: post._id,
      });
    }

    res.json({ shares: post.shares });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Save/Unsave post
// @route   POST /api/posts/:id/save
export const savePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.user._id;
    const alreadySaved = post.saves.includes(userId);

    if (alreadySaved) {
      post.saves = post.saves.filter(id => id.toString() !== userId.toString());
    } else {
      post.saves.push(userId);
    }

    await post.save();

    res.json({ 
      saved: !alreadySaved, 
      savesCount: post.saves.length 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get comments for a post (with pagination)
// @route   GET /api/posts/:id/comments
export const getComments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const post = await Post.findById(req.params.id)
      .populate({
        path: 'comments',
        populate: [
          { path: 'user', select: 'username avatar' },
          { path: 'replies.user', select: 'username avatar' }
        ],
        options: {
          sort: { createdAt: -1 },
          skip,
          limit
        }
      });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const totalComments = await Post.findById(req.params.id)
      .then(p => p.comments.length);

    res.json({
      comments: post.comments,
      currentPage: page,
      totalPages: Math.ceil(totalComments / limit),
      totalComments
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Increment view count
// @route   POST /api/posts/:id/view
export const incrementView = async (req, res) => {
  try {
    await Post.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};