"use client";

import { useEffect, useRef, useState } from "react";

export default function SendContent() {
  const [msg, setMsg] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "later">("now");
  const [laterAt, setLaterAt] = useState("");
  const [groups, setGroups] = useState<{ id: number; name: string; friends_count: number }[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"history" | "schedule">("history");
  const [sentHistory, setSentHistory] = useState<{
    id: number;
    content: string;
    groups: string[];
    total: number;
    successCount: number;
    at: string;
  }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [scheduledJobs, setScheduledJobs] = useState<{
    id: number;
    content: string;
    groups: string[];
    at: string;
    status?: string;
    total?: number;
    successCount?: number;
    error?: string | null;
  }[]>([]);

  // 日期时间选择器引用与最小可选时间（当前时间）
  const dtRef = useRef<HTMLInputElement | null>(null);
  const formatDateTimeLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hour = pad(d.getHours());
    const minute = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hour}:${minute}`;
  };
  const minDateTime = formatDateTimeLocal(new Date());
  

  // 加载全部分组及好友数量
  useEffect(() => {
    const fetchGroups = async () => {
      setLoadingGroups(true);
      setGroupsError(null);
      try {
        const res = await fetch("http://127.0.0.1:8000/groups");
        if (!res.ok) throw new Error(`加载分组失败(${res.status})`);
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setGroupsError(e?.message || "加载分组失败");
        setGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroups();
  }, []);

  // 立即发送：按选中分组聚合好友并调用后端
  const handleSendNow = async () => {
    setSendError(null);
    setSendSuccess(null);
    if (!msg.trim()) {
      setSendError("请输入要发送的内容");
      return;
    }
    if (selectedGroupIds.length === 0) {
      setSendError("请至少选择一个分组");
      return;
    }
    setSending(true);
    try {
      const resFriends = await fetch("http://127.0.0.1:8000/friends");
      if (!resFriends.ok) throw new Error(`加载好友失败(${resFriends.status})`);
      const allFriends: { id: number; name: string; group_id?: number | null }[] = await resFriends.json();
      const targetFriends = allFriends.filter(
        (f) => f.group_id != null && selectedGroupIds.includes(Number(f.group_id))
      );

      const friendIds = targetFriends.map((f) => f.id);
      const friendNames = Object.fromEntries(targetFriends.map((f) => [f.id, f.name]));
      const selectedNames = groups
        .filter((g) => selectedGroupIds.includes(g.id))
        .map((g) => g.name);

      if (friendIds.length === 0) {
        setSendError("选中分组下没有好友");
        return;
      }

      const res = await fetch("http://127.0.0.1:8000/send_message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendIds,
          friendNames,
          content: msg.trim(),
          groups: selectedNames,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `发送失败(${res.status})`);
      }
      setSendSuccess(`发送完成：总计 ${data.total}，成功 ${data.successCount}`);
      // 刷新历史记录（从后端持久化仓库加载）
      await fetchSentHistory();
      setMsg("");
    } catch (e: any) {
      setSendError(e?.message || "发送失败");
    } finally {
      setSending(false);
    }
  };

  // 加入定时队列
  const handleScheduleCreate = async () => {
    setSendError(null);
    setSendSuccess(null);
    if (!msg.trim()) {
      setSendError("请输入要发送的内容");
      return;
    }
    if (selectedGroupIds.length === 0) {
      setSendError("请至少选择一个分组");
      return;
    }
    if (!laterAt) {
      setSendError("请选择执行时间");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/schedule_message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: msg.trim(), groupIds: selectedGroupIds, runAt: laterAt }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.detail || data?.error || `创建定时任务失败(${res.status})`);
      }
      setSendSuccess(`已加入定时队列，任务ID ${data.id}`);
      setMsg("");
      setActiveTab("schedule");
      await fetchScheduledJobs();
    } catch (e: any) {
      setSendError(e?.message || "创建定时任务失败");
    } finally {
      setSending(false);
    }
  };

  // 加载历史记录
  const fetchSentHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/send_history");
      if (!res.ok) throw new Error(`加载历史失败(${res.status})`);
      const data: {
        id: number;
        content: string;
        groups: string[];
        friend_ids: number[];
        total: number;
        success_count: number;
        created_at: string;
      }[] = await res.json();
      const mapped = (Array.isArray(data) ? data : []).map((h) => ({
        id: h.id,
        content: h.content,
        groups: Array.isArray(h.groups) ? h.groups : [],
        total: h.total,
        successCount: h.success_count,
        at: h.created_at,
      }));
      setSentHistory(mapped);
    } catch (e: any) {
      setHistoryError(e?.message || "加载历史失败");
      setSentHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 切换到历史标签时加载历史
  useEffect(() => {
    if (activeTab === "history") {
      fetchSentHistory();
    } else if (activeTab === "schedule") {
      fetchScheduledJobs();
    }
  }, [activeTab]);

  // 加载定时任务列表
  const fetchScheduledJobs = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/scheduled_jobs");
      if (!res.ok) throw new Error(`加载定时任务失败(${res.status})`);
      const data: {
        id: number;
        content: string;
        groups: string[];
        group_ids: number[];
        run_at: string;
        status: string;
        total: number;
        success_count: number;
        error?: string | null;
        created_at: string;
        updated_at: string;
      }[] = await res.json();
      const mapped = (Array.isArray(data) ? data : []).map((j) => ({
        id: j.id,
        content: j.content,
        groups: Array.isArray(j.groups) ? j.groups : [],
        at: j.run_at,
        status: j.status,
        total: j.total,
        successCount: j.success_count,
        error: j.error ?? null,
      }));
      setScheduledJobs(mapped);
    } catch (e) {
      setScheduledJobs([]);
    }
  };

  // 删除未执行的定时任务
  const handleDeleteJob = async (id: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/scheduled_jobs/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.detail || data?.error || `删除失败(${res.status})`);
      }
      await fetchScheduledJobs();
    } catch (e: any) {
      setSendError(e?.message || "删除定时任务失败");
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <h1 className="text-2xl font-semibold text-gray-800">营销推广</h1>
      
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 space-y-6">
        {/* 卡片标题 */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">发送消息</h2>
        </div>

      {/* 消息内容 */}
      <div>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={5}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          placeholder="请输入要发送的内容..."
        />
      </div>

 

      {/* 全部分组列表：名称(数量)，支持多选 */}
      <div>
        <div className="text-base font-semibold text-gray-900 mb-2">选择分组</div>
        {loadingGroups ? (
          <div className="text-sm text-gray-600">分组加载中...</div>
        ) : groupsError ? (
          <div className="text-sm text-red-600">{groupsError}</div>
        ) : groups.length === 0 ? (
          <div className="text-sm text-gray-600">暂无分组</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const active = selectedGroupIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() =>
                    setSelectedGroupIds((prev) =>
                      prev.includes(g.id)
                        ? prev.filter((id) => id !== g.id)
                        : [...prev, g.id]
                    )
                  }
                  className={`px-3 py-1.5 rounded-md text-sm border transition-all duration-200 ${
                    active
                      ? "bg-primary-600 text-white border-primary-600"
                      : "bg-white text-primary-700 border-primary-600 hover:bg-primary-50"
                  }`}
                >
                  {`${g.name}(${g.friends_count})`}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-2 text-xs text-gray-500">
          已选分组：{selectedGroupIds.length} 个
        </div>
      </div>

           {/* 发送方式 */}
      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">发送方式</label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="sendMode"
              checked={sendMode === "now"}
              onChange={() => setSendMode("now")}
              className="text-primary-500"
            />
            <span className="text-sm text-gray-800">立即发送</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="sendMode"
              checked={sendMode === "later"}
              onChange={() => setSendMode("later")}
              className="text-primary-500"
            />
            <span className="text-sm text-gray-800">定时发送</span>
          </label>
        </div>
        {sendMode === "later" && (
          <div className="mt-3 flex items-center gap-3">
            <input
              ref={dtRef}
              type="datetime-local"
              value={laterAt}
              min={minDateTime}
              inputMode="none"
              onKeyDown={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
              onChange={(e) => setLaterAt(e.target.value)}
              placeholder="请选择日期时间"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <button
              type="button"
              onClick={() => {
                const el = dtRef.current;
                if (!el) return;
                const anyEl = el as any;
                if (typeof anyEl.showPicker === 'function') {
                  anyEl.showPicker();
                } else {
                  el.focus();
                }
              }}
              className="px-3 py-2 rounded-md bg-primary-600 text-white text-sm hover:bg-primary-700 transition-colors duration-200"
            >
              选择日期时间
            </button>
          </div>
        )}
      </div>

      {/* 发送按钮与状态反馈 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">已选分组 {selectedGroupIds.length} 个</div>
        <button
          disabled={
            sending || (sendMode === "later" && (!laterAt || selectedGroupIds.length === 0 || !msg.trim()))
          }
          onClick={sendMode === "now" ? handleSendNow : handleScheduleCreate}
          className={`px-4 py-2 rounded-lg text-white text-sm font-semibold transition ${
            ((sendMode === "now" && !sending) || (sendMode === "later" && !sending && !!laterAt && selectedGroupIds.length > 0 && !!msg.trim()))
              ? "bg-gradient-to-r from-primary-400 to-secondary-500 hover:shadow-primary"
              : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          {sending ? "处理中..." : sendMode === "now" ? "立即发送" : "加入定时队列"}
        </button>
        {sendMode === "later" && !sending && (!laterAt || selectedGroupIds.length === 0 || !msg.trim()) && (
          <div className="text-xs text-gray-500 ml-3">请填写内容、选择分组并设定执行时间</div>
        )}
      </div>
      {sendError && (
        <div className="text-sm text-red-600">{sendError}</div>
      )}
      {sendSuccess && (
        <div className="text-sm text-green-600">{sendSuccess}</div>
      )}

      {/* 历史发送消息 / 定时任务 Tabs */}
      <div className="mt-6">
        <div className="flex gap-2 border-b border-gray-200 mb-3">
          <button
            className={`px-3 py-2 text-sm border-b-2 ${
              activeTab === "history"
                ? "border-primary-600 text-primary-700 font-semibold"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => setActiveTab("history")}
          >
            历史发送消息
          </button>
          <button
            className={`px-3 py-2 text-sm border-b-2 ${
              activeTab === "schedule"
                ? "border-primary-600 text-primary-700 font-semibold"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => setActiveTab("schedule")}
          >
            定时任务
          </button>
        </div>

        {activeTab === "history" ? (
          historyLoading ? (
            <div className="text-sm text-gray-600">历史加载中...</div>
          ) : historyError ? (
            <div className="text-sm text-red-600">{historyError}</div>
          ) : sentHistory.length === 0 ? (
            <div className="text-sm text-gray-600">暂无历史记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-700">
                    <th className="px-2 py-2">内容</th>
                    <th className="px-2 py-2">分组</th>
                    <th className="px-2 py-2">总数</th>
                    <th className="px-2 py-2">成功数</th>
                    <th className="px-2 py-2">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {sentHistory.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="px-2 py-2 text-gray-900">{h.content}</td>
                      <td className="px-2 py-2 text-gray-700">{h.groups.join(", ")}</td>
                      <td className="px-2 py-2">{h.total}</td>
                      <td className="px-2 py-2">{h.successCount}</td>
                      <td className="px-2 py-2 text-gray-600">{h.at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          scheduledJobs.length === 0 ? (
            <div className="text-sm text-gray-600">暂无定时任务</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-700">
                    <th className="px-2 py-2">内容</th>
                    <th className="px-2 py-2">分组</th>
                    <th className="px-2 py-2">执行时间</th>
                    <th className="px-2 py-2">状态</th>
                    <th className="px-2 py-2">总数</th>
                    <th className="px-2 py-2">成功数</th>
                    <th className="px-2 py-2">错误</th>
                    <th className="px-2 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledJobs.map((j) => (
                    <tr key={j.id} className="border-t">
                      <td className="px-2 py-2 text-gray-900">{j.content}</td>
                      <td className="px-2 py-2 text-gray-700">{j.groups.join(", ")}</td>
                      <td className="px-2 py-2 text-gray-600">{j.at}</td>
                      <td className="px-2 py-2">{j.status || "-"}</td>
                      <td className="px-2 py-2">{j.total ?? 0}</td>
                      <td className="px-2 py-2">{j.successCount ?? 0}</td>
                      <td className="px-2 py-2 text-red-600">{j.error || ""}</td>
                      <td className="px-2 py-2">
                        {j.status === "pending" ? (
                          <button
                            className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors duration-200"
                            onClick={() => handleDeleteJob(j.id)}
                          >
                            删除
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
      </div>
    </div>
  );
}