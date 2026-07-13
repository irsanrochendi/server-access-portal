const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('portal_token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('Gagal memproses respons server');
  }

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  // Auth
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () =>
    request('/auth/logout', { method: 'POST' }),
  getMe: () =>
    request('/auth/me'),

  // Servers
  getServers: (params = {}) => {
    const q = new URLSearchParams();
    if (params.active) q.set('active', params.active);
    if (params.search) q.set('search', params.search);
    if (params.category) q.set('category', params.category);
    if (params.environment) q.set('environment', params.environment);
    if (params.status) q.set('status', params.status);
    const qs = q.toString();
    return request(`/servers${qs ? `?${qs}` : ''}`);
  },
  getServerStats: () => request('/servers/stats'),
  getServer: (id) => request(`/servers/${id}`),
  createServer: (data) => request('/servers', { method: 'POST', body: JSON.stringify(data) }),
  updateServer: (id, data) => request(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteServer: (id) => request(`/servers/${id}`, { method: 'DELETE' }),
  toggleServerActive: (id) => request(`/servers/${id}/toggle-active`, { method: 'POST' }),

  // Users
  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  getOnlineUsers: (minutes = 5) => request(`/users/online${minutes !== 5 ? `?minutes=${minutes}` : ''}`),
  forceLogout: (userId) => request(`/users/${userId}/force-logout`, { method: 'POST' }),

  // Roles
  getRoles: () => request('/roles'),
  createRole: (data) => request('/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id, data) => request(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id) => request(`/roles/${id}`, { method: 'DELETE' }),

  // Logs
  getLogs: (params = {}) => {
    const q = new URLSearchParams();
    if (params.action) q.set('action', params.action);
    if (params.search) q.set('search', params.search);
    if (params.limit) q.set('limit', params.limit);
    const qs = q.toString();
    return request(`/logs${qs ? `?${qs}` : ''}`);
  },

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (settings) => request('/settings', { method: 'PUT', body: JSON.stringify({ settings }) }),

  // Status
  checkAllStatus: () => request('/status/check-all', { method: 'POST' }),
  checkServerStatus: (id) => request(`/status/check/${id}`, { method: 'POST' }),
  checkLatency: (id) => request(`/status/latency/${id}`, { method: 'POST' }),

  // Categories (custom fields)
  getCategories: () => request('/categories'),
  createCategory: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  // Backup
  listBackups: () => request('/backup'),
  getBackupSettings: () => request('/backup/settings'),
  saveBackupSettings: (data) => request('/backup/settings', { method: 'PUT', body: JSON.stringify(data) }),
  runBackup: (label) => request('/backup/run', { method: 'POST', body: JSON.stringify({ label }) }),
  deleteBackup: (filename) => request(`/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
  downloadBackup: (filename) => `${API_BASE}/backup/download/${encodeURIComponent(filename)}`,
  restoreBackup: (filename) => request('/backup/restore', { method: 'POST', body: JSON.stringify({ filename }) }),

  // Server Credentials & Assignments
  getServerCredentials: (id) => request(`/servers/${id}/credentials`),
  assignServer: (id, data) => request(`/servers/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  removeServerAssignment: (serverId, assignmentId) => request(`/servers/${serverId}/assign/${assignmentId}`, { method: 'DELETE' }),
  getServerAssignments: (id) => request(`/servers/${id}/assignments`),

  // Activity
  logActivity: (data) => request('/logs/activity', { method: 'POST', body: JSON.stringify(data) }),

  // Token-based access
  requestOpenToken: (id, protocol) =>
    request(`/tokens/request/${id}`, { method: 'POST', body: JSON.stringify({ protocol }) }),

  // Announcements
  getAnnouncements: (params = {}) => {
    const q = new URLSearchParams();
    if (params.division) q.set('division', params.division);
    if (params.pinned) q.set('pinned', params.pinned);
    if (params.page) q.set('page', params.page);
    const qs = q.toString();
    return request(`/announcements${qs ? '?' + qs : ''}`);
  },
  getAnnouncement: (id) => request(`/announcements/${id}`),
  createAnnouncement: (data) => request('/announcements', { method: 'POST', body: JSON.stringify(data) }),
  updateAnnouncement: (id, data) => request(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAnnouncement: (id) => request(`/announcements/${id}`, { method: 'DELETE' }),
  togglePinAnnouncement: (id) => request(`/announcements/${id}/pin`, { method: 'PATCH' }),

  // Chat
  getChatRooms: () => request('/chat/rooms'),
  getChatMessages: (room, params = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', params.limit);
    if (params.before) q.set('before', params.before);
    const qs = q.toString();
    return request(`/chat/rooms/${encodeURIComponent(room)}/messages${qs ? '?' + qs : ''}`);
  },
  deleteChatMessage: (id) => request(`/chat/messages/${id}`, { method: 'DELETE' }),

  // Forum
  getForumCategories: () => request('/forum/categories'),
  createForumCategory: (data) => request('/forum/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateForumCategory: (id, data) => request(`/forum/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteForumCategory: (id) => request(`/forum/categories/${id}`, { method: 'DELETE' }),
  getForumTopics: (params = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.set('category', params.category);
    if (params.page) q.set('page', params.page);
    if (params.sort) q.set('sort', params.sort);
    const qs = q.toString();
    return request(`/forum/topics${qs ? '?' + qs : ''}`);
  },
  getForumTopic: (id) => request(`/forum/topics/${id}`),
  createForumTopic: (data) => request('/forum/topics', { method: 'POST', body: JSON.stringify(data) }),
  deleteForumTopic: (id) => request(`/forum/topics/${id}`, { method: 'DELETE' }),
  createForumReply: (topicId, data) => request(`/forum/topics/${topicId}/replies`, { method: 'POST', body: JSON.stringify(data) }),
  deleteForumReply: (id) => request(`/forum/replies/${id}`, { method: 'DELETE' }),
  toggleLockTopic: (id) => request(`/forum/topics/${id}/lock`, { method: 'PATCH' }),
  togglePinTopic: (id) => request(`/forum/topics/${id}/pin`, { method: 'PATCH' }),
};
