import Message from '../models/Message.js';

// @desc    Get conversations for current user
// @route   GET /api/messages/conversations
export const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all messages where user is sender or receiver, group by other party
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    })
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ createdAt: -1 });

    // Build conversation list (unique other user with last message)
    const conversationsMap = new Map();
    messages.forEach((msg) => {
      const otherUser = msg.sender._id.toString() === userId.toString() ? msg.receiver : msg.sender;
      const otherUserId = otherUser._id.toString();
      if (!conversationsMap.has(otherUserId)) {
        conversationsMap.set(otherUserId, {
          user: otherUser,
          lastMessage: msg,
          unreadCount: !msg.read && msg.receiver._id.toString() === userId.toString() ? 1 : 0,
        });
      } else {
        const conv = conversationsMap.get(otherUserId);
        if (!msg.read && msg.receiver._id.toString() === userId.toString()) {
          conv.unreadCount += 1;
        }
      }
    });

    const conversations = Array.from(conversationsMap.values());
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get messages with a specific user
// @route   GET /api/messages/:userId
export const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    })
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      { sender: userId, receiver: currentUserId, read: false },
      { $set: { read: true } }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Send a message (will also be emitted via socket)
// @route   POST /api/messages
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      text,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar');

    res.status(201).json(populatedMessage);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
