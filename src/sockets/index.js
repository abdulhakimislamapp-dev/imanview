import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';

export const configureSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*', // In production, restrict to your frontend domain
    },
  });

  // Authentication middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.userId = decoded.id;
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.userId);

    // Join a room with the user's ID to receive private messages
    socket.join(socket.userId);

    // Handle sending a message
    socket.on('sendMessage', async (data) => {
      try {
        const { receiverId, text } = data;
        const message = await Message.create({
          sender: socket.userId,
          receiver: receiverId,
          text,
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'username avatar')
          .populate('receiver', 'username avatar');

        // Emit to receiver's room
        io.to(receiverId).emit('newMessage', populatedMessage);
        // Also emit back to sender
        socket.emit('newMessage', populatedMessage);

        // Create notification for receiver
        await Notification.create({
          user: receiverId,
          type: 'message',
          from: socket.userId,
        });
        io.to(receiverId).emit('newNotification', { type: 'message', from: socket.userId });
      } catch (err) {
        console.error(err);
      }
    });

    // Handle typing indicator (optional)
    socket.on('typing', ({ receiverId, isTyping }) => {
      socket.to(receiverId).emit('typing', { userId: socket.userId, isTyping });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.userId);
    });
  });

  return io;
};
