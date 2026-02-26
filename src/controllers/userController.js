import User from '../models/User.js';
import Post from '../models/Post.js';
import Notification from '../models/Notification.js';

// @desc    Follow/Unfollow a user
// @route   POST /api/users/follow/:id
export const followUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = await User.findById(req.user._id);
    if (targetUser._id.toString() === currentUser._id.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const isFollowing = currentUser.following.includes(targetUser._id);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(
        (id) => id.toString() !== targetUser._id.toString()
      );
      targetUser.followers = targetUser.followers.filter(
        (id) => id.toString() !== currentUser._id.toString()
      );
    } else {
      // Follow
      currentUser.following.push(targetUser._id);
      targetUser.followers.push(currentUser._id);
      // Create notification
      await Notification.create({
        user: targetUser._id,
        type: 'follow',
        from: currentUser._id,
      });
    }

    await currentUser.save();
    await targetUser.save();

    res.json({ following: !isFollowing });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get user profile by ID
// @route   GET /api/users/profile/:id
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('followers', 'username avatar')
      .populate('following', 'username avatar');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's posts
    const posts = await Post.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate('comments.user', 'username avatar');

    res.json({ user, posts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update current user profile
// @route   PUT /api/users/profile
export const updateProfile = async (req, res) => {
  try {
    const { username, bio, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (username && username !== user.username) {
      // Check if username taken
      const existing = await User.findOne({ username });
      if (existing) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      user.username = username;
    }

    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    res.json({ user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar, bio: user.bio } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get user suggestions
// @route   GET /api/users/suggestions
export const getSuggestions = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    
    // Get users that current user is not following and not themselves
    const suggestions = await User.find({
      _id: { 
        $ne: req.user._id,
        $nin: currentUser.following 
      }
    })
    .select('username avatar bio')
    .limit(20);

    // Add mutual followers count
    const suggestionsWithMeta = await Promise.all(
      suggestions.map(async (user) => {
        const mutualFollowers = await User.countDocuments({
          _id: { $in: currentUser.following },
          following: user._id
        });
        return {
          ...user.toObject(),
          mutualFollowers,
          isFollowing: false
        };
      })
    );

    res.json(suggestionsWithMeta);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get users current user is following
// @route   GET /api/users/following
export const getFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('following', 'username avatar bio');
    
    res.json(user.following);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get users following current user
// @route   GET /api/users/followers
export const getFollowers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('followers', 'username avatar bio');
    
    res.json(user.followers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Upload avatar
// @route   PUT /api/users/avatar
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const result = await uploadToCloudinary(req.file.buffer, 'avatars');
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: result.secure_url },
      { new: true }
    ).select('-password');

    res.json({ avatar: user.avatar });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Search users
// @route   GET /api/users/search?q=query
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { username: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } }
          ]
        }
      ]
    })
    .select('username avatar bio followers')
    .limit(20);

    // Add post count and following status
    const usersWithMeta = await Promise.all(
      users.map(async (user) => {
        const postsCount = await Post.countDocuments({ user: user._id });
        const isFollowing = user.followers.includes(req.user._id);
        return {
          ...user.toObject(),
          postsCount,
          isFollowing,
          followersCount: user.followers.length
        };
      })
    );

    res.json(usersWithMeta);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};