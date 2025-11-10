"use client";

import { useEffect, useMemo, useState } from "react";

export default function SystemSettings() {
  const backendBase = useMemo(() => "http://127.0.0.1:8000", []);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 自动回复控制
  const [autoReplyOn, setAutoReplyOn] = useState(false);
  const [opMsg, setOpMsg] = useState<string | null>(null);
  const [opErr, setOpErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${backendBase}/ai_settings`);
        const data = await res.json();
        if (res.ok && typeof data?.system === "string") {
          setSystemPrompt(String(data.system || ""));
        }
      } catch (e) {
        setError("加载系统提示词失败");
      }
    })();
  }, [backendBase]);

  const save = async () => {
    setSaving(true);
    setSavedMsg(null);
    setError(null);
    try {
      const sys = systemPrompt.trim();
      if (!sys) {
        setError("系统提示词不能为空");
        return;
      }
      const res = await fetch(`${backendBase}/ai_settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: sys }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.detail || data?.error || `保存失败(${res.status})`);
      }
      setSavedMsg("已保存系统提示词");
    } catch (e: any) {
      setError(e?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const startAutoReply = async () => {
    setStarting(true);
    setOpMsg(null);
    setOpErr(null);
    try {
      const res = await fetch(`${backendBase}/api/start-auto-reply`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.detail || data?.error || `启动失败(${res.status})`);
      }
      setAutoReplyOn(true);
      setOpMsg("已启动自动回复");
    } catch (e: any) {
      setOpErr(e?.message || "启动失败");
    } finally {
      setStarting(false);
    }
  };

  const stopAutoReply = async () => {
    setStopping(true);
    setOpMsg(null);
    setOpErr(null);
    try {
      const res = await fetch(`${backendBase}/api/stop-auto-reply`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.detail || data?.error || `停止失败(${res.status})`);
      }
      setAutoReplyOn(false);
      setOpMsg("已停止自动回复");
    } catch (e: any) {
      setOpErr(e?.message || "停止失败");
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <h1 className="text-2xl font-semibold text-gray-800">系统配置</h1>
      
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 space-y-6">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">系统提示词</h2>
        <p className="text-sm text-gray-600">用于指导 AI 回答风格与约束，建议谨慎维护。此处的设置为全局默认，问答测试可临时覆盖。</p>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="例如：严格依据知识库作答，回答简洁礼貌；不足时提示需要更多信息。"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={6}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors duration-200 ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'}`}
          >保存</button>
          {error && <span className="text-sm text-red-600">{error}</span>}
          {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
        </div>
      </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">自动回复</h2>
        <p className="text-sm text-gray-600">启用后，系统将自动答复用户消息。可随时停止。</p>
        <div className="flex items-center gap-2">
          <button
            onClick={startAutoReply}
            disabled={starting || autoReplyOn}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors duration-200 ${starting || autoReplyOn ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'}`}
          >启动自动回复</button>
          <button
            onClick={stopAutoReply}
            disabled={stopping || !autoReplyOn}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors duration-200 ${stopping || !autoReplyOn ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2'}`}
          >停止自动回复</button>
          <span className={`text-sm ${autoReplyOn ? 'text-green-600' : 'text-gray-600'}`}>当前状态：{autoReplyOn ? '已开启' : '未开启'}</span>
        </div>
        <div className="flex items-center gap-2">
          {opErr && <span className="text-sm text-red-600">{opErr}</span>}
          {opMsg && <span className="text-sm text-green-600">{opMsg}</span>}
        </div>
        </div>
      </div>
    </div>
  );
}