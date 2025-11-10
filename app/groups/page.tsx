"use client";

import { useEffect, useMemo, useState } from "react";

type Group = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  friends_count: number;
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const backendBase = useMemo(() => {
    // 后端默认运行在 8000 端口
    return "http://127.0.0.1:8000";
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendBase}/groups`);
      if (!res.ok) throw new Error(`加载失败 (${res.status})`);
      const data: Group[] = await res.json();
      setGroups(data);
    } catch (e: any) {
      setError(e?.message || "加载分组失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createGroup = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const res = await fetch(`${backendBase}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "创建分组失败");
      }
      setNewName("");
      fetchGroups();
    } catch (e: any) {
      alert(e?.message || "创建分组失败");
    }
  };

  const startEdit = (g: Group) => {
    setEditingId(g.id);
    setEditingName(g.name);
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const name = editingName.trim();
    if (!name) return;
    try {
      const res = await fetch(`${backendBase}/groups/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "更新分组失败");
      }
      setEditingId(null);
      setEditingName("");
      fetchGroups();
    } catch (e: any) {
      alert(e?.message || "更新分组失败");
    }
  };

  const deleteGroup = async (id: number) => {
    if (!confirm("确定删除该分组？")) return;
    try {
      const res = await fetch(`${backendBase}/groups/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "删除分组失败");
      }
      fetchGroups();
    } catch (e: any) {
      alert(e?.message || "删除分组失败");
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <h1 className="text-2xl font-semibold text-gray-800">好友分类</h1>
      
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 space-y-6">

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新建分组名称"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={createGroup}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
          >
            新建
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <span className="text-sm font-medium text-gray-700">分组列表</span>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="text-sm text-gray-600">加载中...</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : groups.length === 0 ? (
            <div className="text-sm text-gray-600">暂无分组</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-primary-50 to-secondary-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">分组名称</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">好友数</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">创建时间</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">更新时间</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {editingId === g.id ? (
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      ) : (
                        <span className="font-medium">{g.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{g.friends_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{g.created_at}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{g.updated_at}</td>
                    <td className="px-4 py-3 text-sm">
                      {editingId === g.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveEdit}
                            className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors duration-200"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditingName("");
                            }}
                            className="rounded-md bg-white border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(g)}
                            className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-primary-600 border border-primary-600 hover:bg-primary-50 transition-colors duration-200"
                          >
                            修改
                          </button>
                          <button
                            onClick={() => {
                              if (g.friends_count > 0) {
                                alert("该分组下仍有好友，禁止删除");
                                return;
                              }
                              deleteGroup(g.id);
                            }}
                            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors duration-200"
                          >
                            删除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}