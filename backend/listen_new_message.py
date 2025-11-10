import time
import logging
import requests
import json
import os
from datetime import datetime
from wxautox import WeChat

# ==================== 增强日志配置 ====================
# 确保日志目录存在
log_dir = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(log_dir, exist_ok=True)

# 创建日志文件名
log_filename = os.path.join(log_dir, f'wechat_ai_assistant_{datetime.now().strftime("%Y%m%d")}.log')

# 清除之前的日志配置（防止重复）
for handler in logging.root.handlers[:]:
    logging.root.removeHandler(handler)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_filename, encoding='utf-8', mode='a'),
        logging.StreamHandler()
    ]
)

# 设置日志级别
logger = logging.getLogger('WeChatAIAssistant')
logger.setLevel(logging.INFO)

# 测试日志是否工作
logger.info("=" * 50)
logger.info("🚀 微信AI助手日志系统启动")
logger.info(f"📁 日志文件路径: {log_filename}")
logger.info("=" * 50)

# ==================== AI助手核心类 ====================
class WeChatAIAssistant:
    def __init__(self, check_interval=2):
        self.wx = WeChat()
        self.check_interval = check_interval
        self.current_chat = None
        self.conversation_history = {}  # 存储每个聊天的对话历史
        # 消息去重：改为 TTL 机制，允许相同内容在一段时间后再次处理
        self.processed_messages = {}
        self.dedup_ttl_seconds = 1.5
        

        
    def start_listening(self):
        """启动智能微信监听"""
        logger.info("🚀 启动智能微信AI助手...")
        logger.info("🤖 回复将通过本地接口 /ai_test 生成")
        logger.info(f"⏰ 检查间隔: {self.check_interval}秒")
        
        while True:  # 外层无限循环，确保异常后能恢复
            try:
                while True:
                    # 检查新消息（轮询队列）
                    try:
                        # 不过滤静音聊天，避免遗漏消息
                        new_messages = self.wx.GetNextNewMessage(filter_mute=False)
                        if new_messages and new_messages.get('msg'):
                            logger.info(f"🔔 获取到新消息")
                            self.handle_new_messages(new_messages)
                    except Exception as e:
                        logger.warning(f"⚠️ 轮询新消息异常: {e}")

                    time.sleep(self.check_interval)

            except KeyboardInterrupt:
                logger.info("🛑 用户停止监听")
                break  # 用户主动停止，退出循环
            except Exception as e:
                logger.error(f"❌ 监听错误: {e}，5秒后自动重启...", exc_info=True)
                time.sleep(5)
                logger.info("🔄 正在重启监听循环...")
                # 继续外层循环，实现自动恢复
    
    def handle_new_messages(self, messages):
        """处理新消息"""
        chat_name = messages.get('chat_name')
        msgs = messages.get('msg', [])
        # 兼容非列表返回
        if msgs and not isinstance(msgs, list):
            msgs = [msgs]
        if not msgs:
            logger.debug("📭 新消息容器为空，跳过处理")
            return
        # 尝试从第一条消息或当前上下文获取聊天名
        if not chat_name:
            try:
                sample = msgs[0]
                chat_name = getattr(sample, 'chat_name', None) or self.current_chat or '未知聊天'
            except Exception:
                chat_name = self.current_chat or '未知聊天'
        
        logger.info(f"📨 收到 {len(msgs)} 条新消息来自: {chat_name}")
        
        for msg in msgs:
            # 先记录原始消息信息（调试用）
            logger.debug(f"🔍 检查消息: sender={getattr(msg, 'sender', '')}, content={getattr(msg, 'content', '')[:20]}...")
            
            if not self.is_valid_message(msg, chat_name):
                logger.info(f"⏭️  消息被过滤，不处理")
                continue
            
            # 详细记录消息
            logger.info(f"📱 消息详情:")
            logger.info(f"   💬 聊天: {chat_name}")
            logger.info(f"   👤 发送者: {msg.sender}")
            logger.info(f"   📝 内容: {msg.content}")
            logger.info(f"   🔖 类型: {msg.type}")
            logger.info(f"   🏷️ 属性: {msg.attr}")
            logger.info(f"   🔍 是否自己: self={getattr(msg, 'self', None)}, is_self={getattr(msg, 'is_self', None)}")
            
            # 如果是新聊天，初始化对话历史
            if chat_name not in self.conversation_history:
                self.conversation_history[chat_name] = []
                self.current_chat = chat_name
                logger.info(f"🆕 新聊天创建: {chat_name}")

            # 处理所有来源的消息（好友/群聊/公众号等）
            self.process_intelligent_response(chat_name, msg)
    
    def process_intelligent_response(self, chat_name, msg):
        try:
            logger.info(f"🎯 开始处理回复: {chat_name}")
            
            # 初始化对话历史
            self.conversation_history.setdefault(chat_name, [])

            # 统一通过后端 /ai_test 接口生成回复，不在本地拼接
            # 添加到对话历史
            self.conversation_history[chat_name].append({
                "role": "user",
                "content": msg.content,
                "sender": msg.sender
            })
            
            # 保持对话历史在合理长度
            if len(self.conversation_history[chat_name]) > 20:
                self.conversation_history[chat_name] = self.conversation_history[chat_name][-20:]
                logger.debug("🧹 清理旧对话历史")
            
            # 获取AI回复（调用本地 /ai_test）
            ai_response = self.get_ai_response(chat_name, msg.content)

            if ai_response:
                # 发送回复（增强健壮性：重试与备用发送器）
                sent_ok = False
                try:
                    logger.info(f"📤 尝试发送回复到: {chat_name}")
                    self.wx.SendMsg(ai_response, who=chat_name)
                    sent_ok = True
                except Exception as e:
                    logger.warning(f"⚠️ 首次发送失败，尝试选择聊天后重试: {e}")
                    try:
                        # 若支持选择聊天窗口，先选择再发送
                        if hasattr(self.wx, 'SelectChat'):
                            try:
                                self.wx.SelectChat(chat_name)
                                logger.info(f"✅ 已选择聊天窗口: {chat_name}")
                            except Exception as se:
                                logger.debug(f"选择聊天窗口失败: {se}")
                        self.wx.SendMsg(ai_response, who=chat_name)
                        sent_ok = True
                    except Exception as e2:
                        logger.warning(f"⚠️ 第二次发送失败，尝试备用发送器: {e2}")
                        try:
                            # 备用发送器（通过单例封装）
                            from .wechat import WeChatSingleton  # 延迟导入避免循环依赖
                            wx_single = WeChatSingleton.get_instance()
                            if wx_single:
                                wx_single.SendMsg(ai_response, chat_name)
                                sent_ok = True
                            else:
                                logger.error("❌ 备用发送器不可用")
                        except Exception as e3:
                            logger.error(f"❌ 备用发送器发送失败: {e3}")

                if sent_ok:
                    # 添加到对话历史
                    self.conversation_history[chat_name].append({
                        "role": "assistant",
                        "content": ai_response,
                        "sender": "AI助手"
                    })
                    logger.info(f"🤖 AI回复成功:")
                    logger.info(f"   💬 回复内容: {ai_response}")
                    logger.info(f"   📊 对话历史长度: {len(self.conversation_history[chat_name])}")
                else:
                    logger.error(f"❌ AI回复发送失败: {chat_name}")
                
        except Exception as e:
            logger.error(f"❌ 回复处理错误: {e}", exc_info=True)
            self.wx.SendMsg("抱歉，我暂时无法回复，请稍后再试。", who=chat_name)
    
    def get_ai_response(self, chat_name, user_message):
        """调用后端本地接口获取智能回复（与前端问答测试一致）"""
        try:
            logger.info("🔄 调用本地AI测试接口...")
            payload = {
                "question": user_message
            }
            # 通过本地 FastAPI 接口，避免外网证书问题

            response = requests.post("http://127.0.0.1:8000/ai_test", json=payload, timeout=10)
            response.raise_for_status()
            data = response.json()
            content = (data.get('answer') or '').strip()
            cleaned_response = self.clean_response(content or "")
            logger.info(f"✅ AI调用成功，回复长度: {len(cleaned_response)}字符")
            return cleaned_response or "好的。"
        except Exception as e:
            logger.error(f"❌ AI调用失败: {e}", exc_info=True)
            return "我现在有点忙，稍后再回复你好吗？"
    
    def clean_response(self, response):
        """清理AI回复内容"""
        # 移除多余的空行和空格
        response = response.strip()
        # 限制长度
        if len(response) > 300:
            response = response[:297] + "..."
        return response
    
    
    def is_valid_message(self, msg, chat_name):
        """验证消息是否有效"""
        # 检查类型（兼容缺失或大小写差异）
        msg_type = getattr(msg, 'type', '') or ''
        if msg_type and msg_type.lower() != 'text':
            logger.debug(f"🚫 忽略非文本消息: {msg_type}")
            return False
        
        # 检查是否是自己发送的消息（避免回复自己的消息）
        sender = getattr(msg, 'sender', '')
        content = getattr(msg, 'content', '')
        msg_attr = getattr(msg, 'attr', '')
        
        # 关键修复：检查 sender 和 attr 的值是否是 'self'
        if sender == 'self' or msg_attr == 'self':
            logger.info(f"🚫 忽略自己发送的消息: sender={sender}, attr={msg_attr}, content={content[:30]}...")
            return False
        
        # 如果 sender 为空，也可能是自己发的消息
        if not sender:
            logger.info(f"🚫 忽略sender为空的消息: {content[:30]}...")
            return False
            
        # 检查重复
        msg_key = f"{chat_name}_{sender}_{content}"
        now_ts = time.time()
        last_ts = self.processed_messages.get(msg_key)
        if last_ts is not None and (now_ts - last_ts) < self.dedup_ttl_seconds:
            logger.debug(f"🔄 忽略短期内重复消息: {msg_key}")
            return False

        # 记录本次处理时间
        self.processed_messages[msg_key] = now_ts

        # 清理旧的消息记录（防止内存溢出）
        if len(self.processed_messages) > 1000:
            logger.debug("🧹 清理消息记录缓存")
            # 只保留最近 TTL 内的记录，其他删除
            cutoff = now_ts - self.dedup_ttl_seconds
            self.processed_messages = {k: ts for k, ts in self.processed_messages.items() if ts >= cutoff}
            
        return True
    
    def get_chat_stats(self):
        """获取聊天统计"""
        stats = {
            "total_chats": len(self.conversation_history),
            "active_chats": list(self.conversation_history.keys()),
            "total_messages": sum(len(hist) for hist in self.conversation_history.values())
        }
        logger.info(f"📊 统计信息: {stats}")
        return stats

# ==================== 启动程序 ====================
if __name__ == "__main__":
    print("🤖 智能微信AI助手启动中...")
    print("📋 功能特性:")
    print("   ✓ 智能对话回复")
    print("   ✓ 上下文记忆")
    print("   ✓ 多聊天切换")
    print("   ✓ 详细日志记录")
    print("   ✓ 错误处理")
    print()
    print(f"📁 日志文件将保存在: {log_filename}")
    print()
    
    assistant = WeChatAIAssistant(check_interval=1.5)
    
    try:
        assistant.start_listening()
    except KeyboardInterrupt:
        logger.info("🛑 程序已安全停止")
        stats = assistant.get_chat_stats()
        logger.info(f"📊 运行统计: {stats}")
        print(f"📁 日志文件位置: {log_filename}")
