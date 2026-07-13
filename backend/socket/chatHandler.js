import { getDb } from '../database.js';
import { verifyToken } from '../services/auth.js';

/**
 * Validate that the current user is allowed to access the given room.
 * Public rooms (general, announcements) are allowed for everyone.
 * Division rooms require user.division to match the division name, or admin role.
 */
function checkRoomAccess(user, room) {
  // Public rooms — everyone can join
  if (room === 'general' || room === 'announcements') {
    return { allowed: true };
  }

  // Division rooms — must belong to the division or be admin
  if (room.startsWith('division-')) {
    const divisionId = parseInt(room.replace('division-', ''), 10);
    if (isNaN(divisionId)) {
      return { allowed: false, error: 'Room tidak valid' };
    }

    if (user.role === 'admin') {
      return { allowed: true };
    }

    const db = getDb();
    const division = db.prepare(
      'SELECT * FROM divisions WHERE id = ? AND is_active = 1'
    ).get(divisionId);

    if (!division) {
      return { allowed: false, error: 'Room tidak ditemukan' };
    }

    if (user.division !== division.name) {
      return { allowed: false, error: 'Anda tidak memiliki akses ke room ini' };
    }

    return { allowed: true };
  }

  return { allowed: false, error: 'Room tidak valid' };
}

/**
 * Initialize chat socket event handlers on the given Socket.IO Server.
 */
export function initChatSocket(io) {
  // --- Authentication middleware ---
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token tidak ditemukan'));

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('Token expired, silakan login ulang'));
      }
      return next(new Error('Token invalid'));
    }

    const db = getDb();
    const user = db.prepare(
      'SELECT id, name, username, email, division, role, is_active, token_version FROM users WHERE id = ?'
    ).get(payload.id);

    if (!user) return next(new Error('User tidak ditemukan'));
    if (!user.is_active) return next(new Error('Akun dinonaktifkan'));

    // Token version check (force logout)
    if (payload.token_version !== undefined && user.token_version !== payload.token_version) {
      return next(new Error('Sesi Anda telah diakhiri oleh admin'));
    }

    socket.user = user;
    next();
  });

  // --- Connection handler ---
  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[Socket.IO] ${user.name} (${user.email}) connected — ${socket.id}`);

    // Auto-join general room on connect
    socket.join('general');
    socket.currentRoom = 'general';

    // --- chat:join — join a specific room ---
    socket.on('chat:join', (room, ack) => {
      const result = checkRoomAccess(user, room);
      if (!result.allowed) {
        if (typeof ack === 'function') ack({ error: result.error });
        return;
      }

      // Leave previous room
      if (socket.currentRoom && socket.currentRoom !== room) {
        socket.leave(socket.currentRoom);
        socket.to(socket.currentRoom).emit('chat:user-leave', {
          userId: user.id,
          userName: user.name,
          room: socket.currentRoom,
        });
      }

      // Leave 'general' when joining a non-general room
      if (room !== 'general') {
        socket.leave('general');
      }

      socket.join(room);
      socket.currentRoom = room;

      // Notify the room about the new participant
      socket.to(room).emit('chat:user-join', {
        userId: user.id,
        userName: user.name,
        room,
      });

      if (typeof ack === 'function') ack({ success: true, room });
    });

    // --- chat:leave — leave a room (falls back to general) ---
    socket.on('chat:leave', (room, ack) => {
      if (!room) return;

      // Leave the room
      socket.leave(room);

      // Notify others in the room
      socket.to(room).emit('chat:user-leave', {
        userId: user.id,
        userName: user.name,
        room,
      });

      // Reset to general
      if (socket.currentRoom === room) {
        socket.join('general');
        socket.currentRoom = 'general';
      }

      if (typeof ack === 'function') ack({ success: true });
    });

    // --- chat:message — send a message to the current room ---
    socket.on('chat:message', ({ room, content, replyTo, file_url, file_name }, ack) => {
      if (!room || (!content && !file_url)) {
        socket.emit('chat:error', { message: 'Pesan tidak boleh kosong' });
        if (typeof ack === 'function') ack({ error: 'Pesan tidak boleh kosong' });
        return;
      }

      if (content && content.length > 5000) {
        socket.emit('chat:error', { message: 'Pesan terlalu panjang (maksimal 5000 karakter)' });
        if (typeof ack === 'function') ack({ error: 'Pesan terlalu panjang' });
        return;
      }

      const result = checkRoomAccess(user, room);
      if (!result.allowed) {
        socket.emit('chat:error', { message: result.error });
        if (typeof ack === 'function') ack({ error: result.error });
        return;
      }

      const db = getDb();
      try {
        // Persist message
        const insertResult = db.prepare(`
          INSERT INTO chat_messages (sender_id, content, room, reply_to, attachment_url, attachment_name, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(user.id, content ? content.trim() : '', room, replyTo || null, file_url || null, file_name || null);

        // Fetch the full message with sender info
        const message = db.prepare(`
          SELECT m.*, u.name as sender_name, u.email as sender_email
          FROM chat_messages m
          LEFT JOIN users u ON m.sender_id = u.id
          WHERE m.id = ?
        `).get(insertResult.lastInsertRowid);

        // If replying, include reply context
        if (message.reply_to) {
          const reply = db.prepare(`
            SELECT m.*, u.name as sender_name
            FROM chat_messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.id = ? AND m.is_deleted = 0
          `).get(message.reply_to);
          message.reply = reply || null;
        }

        // Broadcast to everyone in the room (including sender)
        io.to(room).emit('chat:new-message', message);

        if (typeof ack === 'function') ack({ success: true, message });
      } catch (err) {
        console.error('Chat save error:', err);
        socket.emit('chat:error', { message: 'Gagal mengirim pesan' });
        if (typeof ack === 'function') ack({ error: 'Gagal mengirim pesan' });
      }
    });

    // --- chat:typing — user is typing ---
    socket.on('chat:typing', ({ room }) => {
      if (!room) return;
      const access = checkRoomAccess(user, room);
      if (!access.allowed) return;
      socket.to(room).emit('chat:user-typing', {
        userId: user.id,
        userName: user.name,
        room,
      });
    });

    // --- chat:stop-typing — user stopped typing ---
    socket.on('chat:stop-typing', ({ room }) => {
      if (!room) return;
      const access = checkRoomAccess(user, room);
      if (!access.allowed) return;
      socket.to(room).emit('chat:user-stop-typing', {
        userId: user.id,
        userName: user.name,
        room,
      });
    });

    // --- disconnect ---
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] ${user.name} disconnected — ${socket.id}`);
      // Notify current room that user left
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit('chat:user-leave', {
          userId: user.id,
          userName: user.name,
          room: socket.currentRoom,
        });
      }
    });
  });
}
