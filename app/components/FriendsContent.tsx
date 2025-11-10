"use client";

import { useEffect, useState } from "react";

interface Friend {
  id: number;
  name: string;
  uid: string;
  local: string;
  phone: string;
  created_at: string;
  updated_at: string;
  group_id?: number | null;
  group_name?: string | null;
}

interface GroupItem {
  id: number;
  name: string;
}

export default function FriendsContent() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [currentFriend, setCurrentFriend] = useState<Friend | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  
  // 备注修改相关状态
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);
  const [newRemark, setNewRemark] = useState("");

  // 聊天记录相关状态
  const [chatHistoryModalOpen, setChatHistoryModalOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, []);

  // 从数据库中获取好友
  const fetchFriends = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/friends");
      const data = await res.json();
      setFriends(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/groups");
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setGroups([]);
    }
  };

  // 同步好友
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/sync_friends", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        const before = friends.length;          // 同步前总数
        let polls = 0;
        const timer = setInterval(async () => {
          const newRes = await fetch("http://127.0.0.1:8000/friends");
          const newData: Friend[] = await newRes.json();
          const now = Array.isArray(newData) ? newData.length : 0;
          polls++;

          // 真正结束条件：数量变化 或 轮询超时
          if (now !== before || polls >= 15) {
            clearInterval(timer);
            setFriends(newData);               // 把最新数据写进状态
            setSyncing(false);
            setToast(`好友同步完成！共 ${now} 位好友`);
            setTimeout(() => setToast(""), 3000);
          }
        }, 2000);
      } else {
        setToast("同步失败：" + (result.error || "未知错误"));
        setSyncing(false);
      }
    } catch (e) {
      console.error(e);
      setToast("网络错误");
      setSyncing(false);
    }
  };

  const openGroupModal = async (f: Friend) => {
    setCurrentFriend(f);
    // 后端返回可能没有 group_id 字段，容错处理
    setSelectedGroupId((f as any).group_id ?? null);
    setGroupModalOpen(true);
    if (groups.length === 0) {
      await fetchGroups();
    }
  };

  const saveFriendGroup = async () => {
    if (!currentFriend) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/friends/${currentFriend.id}/group`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: selectedGroupId }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "更新分组失败");
      }
      setGroupModalOpen(false);
      setCurrentFriend(null);
      setSelectedGroupId(null);
      fetchFriends();
    } catch (e: any) {
      alert(e?.message || "更新分组失败");
    }
  };

  // 打开备注编辑浮层
  const openRemarkModal = (f: Friend) => {
    setCurrentFriend(f);
    setNewRemark(f.name); // 用当前昵称作为初始值
    setRemarkModalOpen(true);
  };

  // 保存备注
  const saveRemark = async () => {
    if (!currentFriend) return;
    
    const trimmedRemark = newRemark.trim();
    if (!trimmedRemark) {
      alert("备注不能为空");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/update-friend-remark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          friendId: currentFriend.id,
          newRemark: trimmedRemark 
        }),
      });
      
      const result = await res.json();
      
      if (!res.ok || !result.success) {
        throw new Error(result.error || "修改备注失败");
      }
      
      // 关闭浮层
      setRemarkModalOpen(false);
      setCurrentFriend(null);
      setNewRemark("");
      
      // 刷新好友列表
      fetchFriends();
      
      // 显示成功提示
      setToast("备注修改成功！");
      setTimeout(() => setToast(""), 3000);
    } catch (e: any) {
      alert(e?.message || "修改备注失败");
    }
  };

  // 打开聊天记录浮层
  const openChatHistoryModal = async (f: Friend) => {
    setCurrentFriend(f);
    setChatHistory([]);
    setChatHistoryModalOpen(true);
    
    // 立即加载聊天记录
    await loadChatHistory(f.id, f.name, false);
  };

  // 加载聊天记录
  const loadChatHistory = async (friendId: number, friendName: string, loadMore: boolean) => {
    setLoadingHistory(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/get-chat-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          friendId,
          friendName,
          loadMore 
        }),
      });
      
      const result = await res.json();
      
      if (!res.ok || !result.success) {
        throw new Error(result.error || "获取聊天记录失败");
      }
      
      setChatHistory(result.history || []);
    } catch (e: any) {
      alert(e?.message || "获取聊天记录失败");
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <h1 className="text-2xl font-semibold text-gray-800">好友管理</h1>
      
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 relative">
        {/* 居中浮层提示 */}
        {toast && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white text-gray-800 px-6 py-4 rounded-xl shadow-2xl animate-fade-in text-sm font-medium">
              {toast}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base text-gray-600">我的好友 ({friends.length})</h2>
          
        </div>
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索昵称 / UID / 地区 / 电话"
            aria-label="搜索好友"
            className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <button
            onClick={handleSync}
            disabled={syncing}
              className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-all duration-200 ${
              syncing ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-primary-400 to-secondary-500 hover:shadow-primary"
            }`}
          >
            {syncing ? "同步中…" : "同步好友"}
          </button>
        </div>
      </div>

        {loading ? (
          <p className="text-sm text-gray-600">加载中…</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-gray-600">暂无好友数据，请先同步。</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-primary-50 to-secondary-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">昵称</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">UID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">地区</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">电话</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">分组</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-primary-800">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(query ? friends.filter((f) => {
                const q = query.toLowerCase().trim();
                if (!q) return true;
                return (
                  (f.name || "").toLowerCase().includes(q) ||
                  (f.uid || "").toLowerCase().includes(q) ||
                  (f.local || "").toLowerCase().includes(q) ||
                  (f.phone || "").toLowerCase().includes(q)
                );
              }) : friends).map((f) => (
                <tr key={f.id} className="hover:bg-gradient-to-r hover:from-primary-50 hover:to-secondary-50 transition-colors duration-150">
                  <td className="px-4 py-3 text-sm text-gray-800">{f.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{f.uid}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{f.local}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{f.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(f.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{(f as any).group_name || "未分组"}</td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <button onClick={() => openRemarkModal(f)} className="px-3 py-1.5 rounded-md bg-white text-primary-600 text-xs font-medium border border-primary-600 hover:bg-primary-50 transition-colors duration-200">修改备注</button>
                      <button onClick={() => openChatHistoryModal(f)} className="px-3 py-1.5 rounded-md bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors duration-200">聊天记录</button>
                      <button onClick={() => openGroupModal(f)} className="px-3 py-1.5 rounded-md bg-white text-gray-600 text-xs font-medium border border-gray-300 hover:bg-gray-50 transition-colors duration-200">分组</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {groupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b px-4 py-3">
              <h3 className="text-base font-semibold text-gray-800">选择分组</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-gray-700">为好友：<span className="font-semibold">{currentFriend?.name}</span> 设置分组</div>
              <select
                value={selectedGroupId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedGroupId(v === '' ? null : Number(v));
                }}
                aria-label="选择分组"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">未分组</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                onClick={() => {
                  setGroupModalOpen(false);
                  setCurrentFriend(null);
                  setSelectedGroupId(null);
                }}
                className="px-4 py-2 rounded-lg bg-white text-gray-700 text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
              >
                取消
              </button>
              <button
                onClick={saveFriendGroup}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {remarkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b px-4 py-3">
              <h3 className="text-base font-semibold text-gray-800">修改备注</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-gray-700">
                为好友：<span className="font-semibold">{currentFriend?.name}</span> 修改备注
              </div>
              <input
                type="text"
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
                placeholder="请输入新的备注名称"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                onClick={() => {
                  setRemarkModalOpen(false);
                  setCurrentFriend(null);
                  setNewRemark("");
                }}
                className="px-4 py-2 rounded-lg bg-white text-gray-700 text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
              >
                取消
              </button>
              <button
                onClick={saveRemark}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {chatHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl h-[600px] rounded-lg bg-white shadow-xl flex flex-col">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">
                与 <span className="font-semibold">{currentFriend?.name}</span> 的聊天记录
              </h3>
              <button
                onClick={() => {
                  setChatHistoryModalOpen(false);
                  setCurrentFriend(null);
                  setChatHistory([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingHistory ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : chatHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">暂无聊天记录</div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.sender === currentFriend?.name ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.sender === currentFriend?.name
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-primary-600 text-white'
                      }`}
                    >
                      <div className="text-xs opacity-70 mb-1">
                        {msg.sender} {msg.time && `· ${msg.time}`}
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="border-t px-4 py-3 flex items-center justify-between">
              <div className="text-xs text-gray-500">共 {chatHistory.length} 条消息</div>
              <button
                onClick={() => {
                  setChatHistoryModalOpen(false);
                  setCurrentFriend(null);
                  setChatHistory([]);
                }}
                className="px-4 py-2 rounded-lg bg-white text-gray-700 text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}