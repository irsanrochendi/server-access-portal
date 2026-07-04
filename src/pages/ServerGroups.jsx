import { useState, useEffect } from 'react';
import { Folder, Plus, Edit2, Trash2, Server, X, Check } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function ServerGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const toast = useToast();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:4000/api/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGroups(data.data || []);
    } catch (err) {
      toast.error('Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/api/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSelectedGroup(data.data);
    } catch (err) {
      toast.error('Failed to fetch group details');
    }
  };

  const handleCreate = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:4000/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success('Group created');
        fetchGroups();
        setShowCreateModal(false);
      }
    } catch (err) {
      toast.error('Failed to create group');
    }
  };

  const handleUpdate = async (id, formData) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/api/groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success('Group updated');
        fetchGroups();
        setEditingGroup(null);
      }
    } catch (err) {
      toast.error('Failed to update group');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this group? Servers will not be deleted.')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/api/groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('Group deleted');
        fetchGroups();
        setSelectedGroup(null);
      }
    } catch (err) {
      toast.error('Failed to delete group');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3 mb-2">
            <Folder className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <span className="gradient-text">Server Groups</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Organize servers into logical groups
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-lg hover:scale-105 transition-all"
        >
          <Plus className="w-5 h-5" />
          Create Group
        </button>
      </div>

      {/* Groups grid */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl text-center">
          <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">No groups yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">Create your first group to organize servers</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              onClick={() => fetchGroupDetails(group.id)}
              className="glass-card p-5 rounded-2xl hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: group.color + '20' }}
                  >
                    <Folder className="w-6 h-6" style={{ color: group.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {group.name}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {group.server_count} server{group.server_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingGroup(group);
                    }}
                    className="p-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(group.id);
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
              {group.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{group.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingGroup) && (
        <GroupFormModal
          group={editingGroup}
          onClose={() => {
            setShowCreateModal(false);
            setEditingGroup(null);
          }}
          onSave={(data) => {
            if (editingGroup) {
              handleUpdate(editingGroup.id, data);
            } else {
              handleCreate(data);
            }
          }}
        />
      )}

      {/* Group Details Modal */}
      {selectedGroup && (
        <GroupDetailsModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onRefresh={() => fetchGroupDetails(selectedGroup.id)}
        />
      )}
    </div>
  );
}

function GroupFormModal({ group, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: group?.name || '',
    description: group?.description || '',
    color: group?.color || '#6366f1',
    icon: group?.icon || 'folder',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="glass-card rounded-3xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-gray-900 dark:text-white">
            {group ? 'Edit Group' : 'Create Group'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/20 dark:hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Color</label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full h-12 rounded-xl cursor-pointer"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-lg transition-all"
            >
              {group ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GroupDetailsModal({ group, onClose, onRefresh }) {
  const toast = useToast();

  const handleRemoveServer = async (serverId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/api/groups/${group.id}/members/${serverId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('Server removed from group');
        onRefresh();
      }
    } catch (err) {
      toast.error('Failed to remove server');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="glass-card rounded-3xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: group.color + '20' }}
            >
              <Folder className="w-6 h-6" style={{ color: group.color }} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{group.name}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{group.members?.length || 0} servers</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/20 dark:hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {!group.members || group.members.length === 0 ? (
            <div className="text-center py-12">
              <Server className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-600 dark:text-gray-400">No servers in this group</p>
            </div>
          ) : (
            <div className="space-y-2">
              {group.members.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-white">{server.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{server.ip_address}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveServer(server.id)}
                    className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
