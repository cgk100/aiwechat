"use client";

import { useEffect, useMemo, useState } from "react";

type QAItem = {
  id: number;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
};

export default function AiContent() {
  const backendBase = useMemo(() => "http://127.0.0.1:8000", []);

  // 1) 问答测试
  const [testQ, setTestQ] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [chat, setChat] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [savingSystem, setSavingSystem] = useState(false);
  const [systemSavedMsg, setSystemSavedMsg] = useState<string | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);

  // 2) 知识库录入
  const [kbQ, setKbQ] = useState("");
  const [kbA, setKbA] = useState("");
  const [kbSaving, setKbSaving] = useState(false);
  const [kbError, setKbError] = useState<string | null>(null);
  const [kbSuccess, setKbSuccess] = useState<string | null>(null);

  // 3) 列表与分页
  const [items, setItems] = useState<QAItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");

  const fetchList = async () => {
    setListLoading(true);
    setListError(null);
    try {
      const offset = (page - 1) * pageSize;
      const res = await fetch(`${backendBase}/qa_kb?offset=${offset}&limit=${pageSize}`);
      if (!res.ok) throw new Error(`加载失败(${res.status})`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
    } catch (e: any) {
      setListError(e?.message || "加载知识库失败");
      setItems([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    // 加载系统提示词
    (async () => {
      try {
        const res = await fetch(`${backendBase}/ai_settings`);
        const data = await res.json();
        if (res.ok && typeof data?.system === "string") {
          setSystemPrompt(String(data.system || ""));
        }
      } catch {}
    })();
  }, [backendBase]);

  const handleTest = async () => {
    setTesting(true);
    setTestError(null);
    try {
      const q = testQ.trim();
      if (!q) {
        setTestError("请输入问题");
        return;
      }
      // 记录用户消息到聊天
      setChat((prev) => [...prev, { role: 'user', content: q }]);
      const sys = systemPrompt.trim();
      const res = await fetch(`${backendBase}/ai_test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, system: sys || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || `测试失败(${res.status})`);
      const ans = String(data?.answer || "");
      setChat((prev) => [...prev, { role: 'assistant', content: ans }]);
      setTestQ("");
    } catch (e: any) {
      setTestError(e?.message || "测试失败");
      setChat((prev) => [...prev, { role: 'assistant', content: `错误：${e?.message || '测试失败'}` }]);
    } finally {
      setTesting(false);
    }
  };

  const saveSystemPrompt = async () => {
    setSavingSystem(true);
    setSystemSavedMsg(null);
    setSystemError(null);
    try {
      const sys = systemPrompt.trim();
      if (!sys) {
        setSystemError("系统提示词不能为空");
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
      setSystemSavedMsg("已保存系统提示词");
    } catch (e: any) {
      setSystemError(e?.message || "保存失败");
    } finally {
      setSavingSystem(false);
    }
  };

  const handleAddKb = async () => {
    setKbSaving(true);
    setKbError(null);
    setKbSuccess(null);
    try {
      const q = kbQ.trim();
      const a = kbA.trim();
      if (!q || !a) {
        setKbError("问题与答复均不能为空");
        return;
      }
      const res = await fetch(`${backendBase}/qa_kb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, answer: a }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.detail || data?.error || `添加失败(${res.status})`);
      }
      setKbSuccess("已添加到知识库");
      setKbQ("");
      setKbA("");
      fetchList();
    } catch (e: any) {
      setKbError(e?.message || "添加失败");
    } finally {
      setKbSaving(false);
    }
  };

  const startEdit = (it: QAItem) => {
    setEditingId(it.id);
    setEditQ(it.question);
    setEditA(it.answer);
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    try {
      const q = editQ.trim();
      const a = editA.trim();
      if (!q || !a) {
        alert("问题与答复均不能为空");
        return;
      }
      const res = await fetch(`${backendBase}/qa_kb/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, answer: a }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.detail || data?.error || `更新失败(${res.status})`);
      }
      setEditingId(null);
      setEditQ("");
      setEditA("");
      fetchList();
    } catch (e: any) {
      alert(e?.message || "更新失败");
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("确定删除该条目？")) return;
    try {
      const res = await fetch(`${backendBase}/qa_kb/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.detail || data?.error || `删除失败(${res.status})`);
      }
      const newTotal = total - 1 >= 0 ? total - 1 : 0;
      setTotal(newTotal);
      // 若当前页已无数据，尝试回退一页
      const maxPage = Math.max(1, Math.ceil(newTotal / pageSize));
      if (page > maxPage) setPage(maxPage);
      fetchList();
    } catch (e: any) {
      alert(e?.message || "删除失败");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <h1 className="text-2xl font-semibold text-gray-800">AI 答复</h1>
      
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 space-y-6">
        {/* 新布局：左右 80/20 */}
        <div className="grid grid-cols-10 gap-6">
        {/* 左侧侧栏（20%）：系统提示词摘要 + 知识库录入与列表 */}
        <div className="col-span-10 md:col-span-7 space-y-6">
          <div className="rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-base font-semibold text-gray-900 mb-2">系统提示词（摘要）</div>
            <div className="text-sm text-gray-700 whitespace-pre-line">
              {systemPrompt ? systemPrompt : '尚未配置系统提示词，请前往"系统配置"页面维护。'}
            </div>
            <a href="/settings" className="mt-2 inline-block text-sm text-primary-600 hover:text-primary-700 transition-colors duration-200">去系统配置</a>
          </div>

          <div className="rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="text-base font-semibold text-gray-900">知识库录入</div>
            <input
              value={kbQ}
              onChange={(e) => setKbQ(e.target.value)}
              placeholder="问题"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              value={kbA}
              onChange={(e) => setKbA(e.target.value)}
              placeholder="答复"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddKb}
                disabled={kbSaving}
                className={`rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 ${kbSaving ? 'bg-gray-400' : 'bg-primary-600 hover:bg-primary-700'}`}
              >添加</button>
              {kbError && <span className="text-xs text-red-600">{kbError}</span>}
              {kbSuccess && <span className="text-xs text-green-600">{kbSuccess}</span>}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 shadow-sm">
            <div className="border-b px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">知识库列表</span>
              <div className="flex items-center gap-2 text-sm">
                <label className="text-gray-600">每页</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded-md border px-2 py-1 text-sm"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-gray-600">共 {total} 条</span>
              </div>
            </div>
            <div className="p-3 overflow-x-auto">
              {listLoading ? (
                <div className="text-sm text-gray-600">加载中...</div>
              ) : listError ? (
                <div className="text-sm text-red-600">{listError}</div>
              ) : items.length === 0 ? (
                <div className="text-sm text-gray-600">暂无数据</div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gradient-to-r from-primary-50 to-secondary-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-primary-800">问答</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-primary-800">答复</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-primary-800">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 text-sm text-gray-800 align-top">
                          {editingId === it.id ? (
                            <input value={editQ} onChange={(e) => setEditQ(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                          ) : (
                            <div className="max-w-[180px] truncate" title={it.question}>{it.question}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-800 align-top">
                          {editingId === it.id ? (
                            <textarea value={editA} onChange={(e) => setEditA(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500" rows={2} />
                          ) : (
                            <div className="max-w-[220px] truncate" title={it.answer}>{it.answer}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {editingId === it.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={saveEdit} className="rounded-md bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700 transition-colors duration-200">保存</button>
                              <button onClick={() => { setEditingId(null); setEditQ(""); setEditA(""); }} className="rounded-md bg-white border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200">取消</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button onClick={() => startEdit(it)} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-primary-600 border border-primary-600 hover:bg-primary-50 transition-colors duration-200">编辑</button>
                              <button onClick={() => deleteItem(it.id)} className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors duration-200">删除</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t px-3 py-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md bg-white px-3 py-1.5 border text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  disabled={page <= 1}
                >上一页</button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-md bg-white px-3 py-1.5 border text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  disabled={page >= totalPages}
                >下一页</button>
              </div>
              <div className="text-gray-600">第 {page} / {totalPages} 页</div>
            </div>
          </div>
        </div>

        {/* 右侧聊天问答（80%） */}
        <div className="col-span-10 md:col-span-3">
          <div className="rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col h-[600px]">
            <div className="text-lg font-semibold text-gray-900 mb-3">AI 问答</div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {chat.length === 0 ? (
                <div className="text-sm text-gray-600">暂无聊天记录，请输入问题开始对话。</div>
              ) : (
                chat.map((m, idx) => (
                  <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                      <div className="whitespace-pre-line break-words">{m.content}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={testQ}
                onChange={(e) => setTestQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !testing) {
                    e.preventDefault();
                    handleTest();
                  }
                }}
                placeholder="请输入问题，按 Enter 发送"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleTest}
                disabled={testing}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors duration-200 ${testing ? 'bg-gray-400' : 'bg-primary-600 hover:bg-primary-700'}`}
              >发送</button>
            </div>
            {testError && <div className="text-xs text-red-600 mt-2">{testError}</div>}
          </div>
        </div>
      </div>
      </div>

      {/* 1) 问答测试 */}
      <div className="space-y-3 hidden">
        <h2 className="text-lg font-bold text-gray-900">问答测试</h2>
   
        <div className="flex items-center gap-2">
          <input
            value={testQ}
            onChange={(e) => setTestQ(e.target.value)}
            placeholder="请输入一个问题"
            className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            onClick={handleTest}
            disabled={testing}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${testing ? 'bg-gray-400' : 'bg-teal-600 hover:bg-teal-700'}`}
          >
            测试
          </button>
        </div>
        {testError && <div className="text-sm text-red-600">{testError}</div>}
        {/* 已移除 testResult 显示区域，聊天历史由 chat 数组管理 */}
      </div>

      {/* 2) 知识库录入 */}
      <div className="space-y-3 hidden">
        <h2 className="text-lg font-bold text-gray-900">问答知识库</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={kbQ}
            onChange={(e) => setKbQ(e.target.value)}
            placeholder="问题"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            value={kbA}
            onChange={(e) => setKbA(e.target.value)}
            placeholder="答复"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddKb}
            disabled={kbSaving}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${kbSaving ? 'bg-gray-400' : 'bg-teal-600 hover:bg-teal-700'}`}
          >
            添加
          </button>
          {kbError && <span className="text-sm text-red-600">{kbError}</span>}
          {kbSuccess && <span className="text-sm text-green-600">{kbSuccess}</span>}
        </div>
      </div>

      {/* 3) 知识库列表 + 分页 */}
      <div className="rounded-lg border bg-white shadow-sm hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">知识库列表</span>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-600">每页</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border px-2 py-1 text-sm"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-gray-600">共 {total} 条</span>
          </div>
        </div>
        <div className="p-4">
          {listLoading ? (
            <div className="text-sm text-gray-600">加载中...</div>
          ) : listError ? (
            <div className="text-sm text-red-600">{listError}</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-600">暂无数据</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-teal-50 to-emerald-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-teal-800">问答</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-teal-800">答复</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-teal-800">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-3 text-sm text-gray-800 align-top">
                      {editingId === it.id ? (
                        <input value={editQ} onChange={(e) => setEditQ(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      ) : (
                        <div className="max-w-md truncate" title={it.question}>{it.question}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 align-top">
                      {editingId === it.id ? (
                        <textarea value={editA} onChange={(e) => setEditA(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" rows={2} />
                      ) : (
                        <div className="max-w-xl truncate" title={it.answer}>{it.answer}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm align-top">
                      {editingId === it.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={saveEdit} className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors duration-200">保存</button>
                          <button onClick={() => { setEditingId(null); setEditQ(""); setEditA(""); }} className="rounded-md bg-white border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200">取消</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(it)} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-primary-600 border border-primary-600 hover:bg-primary-50 transition-colors duration-200">编辑</button>
                          <button onClick={() => deleteItem(it.id)} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors duration-200">删除</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t px-4 py-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md bg-white px-3 py-1.5 border text-gray-700 hover:bg-gray-50"
              disabled={page <= 1}
            >上一页</button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md bg-white px-3 py-1.5 border text-gray-700 hover:bg-gray-50"
              disabled={page >= totalPages}
            >下一页</button>
          </div>
          <div className="text-gray-600">第 {page} / {totalPages} 页</div>
        </div>
      </div>
    </div>
  );
}