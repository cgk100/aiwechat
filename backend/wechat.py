import logging
from typing import Optional


class WeChatSingleton:
    """
    微信发送器单例
    - 基于 wxautox.WeChat 封装发送能力
    - 初始化失败时返回 None，让上层友好提示
    """

    _instance: Optional["WeChatSingleton"] = None

    def __init__(self):
        self._ok = False
        self._wx = None
        try:
            # 尝试初始化 COM 环境（在某些机器上必须）
            try:
                import pythoncom  # type: ignore
                pythoncom.CoInitialize()
            except Exception:
                # 非致命，继续尝试初始化微信
                pass

            # 延迟导入，避免模块导入阶段失败
            from wxautox import WeChat  # type: ignore
            self._wx = WeChat()
            self._ok = True
            logging.info("WeChat 初始化成功")
        except Exception as e:
            logging.exception(f"WeChat 初始化失败: {e}")
            self._ok = False
            self._wx = None

    @classmethod
    def get_instance(cls) -> Optional["WeChatSingleton"]:
        try:
            if cls._instance is None:
                cls._instance = WeChatSingleton()
            if cls._instance and cls._instance._ok:
                return cls._instance
            return None
        except Exception as e:
            logging.exception("创建微信实例失败")
            return None

    def SendMsg(self, content: str, friend_name: str):
        """发送消息到指定好友备注/昵称。
        - 若未初始化，抛出异常供上层捕获
        """
        if not self._ok or not self._wx:
            raise RuntimeError("微信未初始化或不可用")
        # 调用真实发送逻辑
        self._wx.SendMsg(content, friend_name)
    
    def ChatWith(self, friend_name: str):
        """打开与指定好友的聊天窗口"""
        if not self._ok or not self._wx:
            raise RuntimeError("微信未初始化或不可用")
        return self._wx.ChatWith(friend_name)
    
    def ManageFriend(self, remark: str = None, **kwargs):
        """管理好友信息（修改备注等）"""
        if not self._ok or not self._wx:
            raise RuntimeError("微信未初始化或不可用")
        return self._wx.ManageFriend(remark=remark, **kwargs)
    
    def GetAllMessage(self):
        """获取当前聊天窗口的所有消息"""
        if not self._ok or not self._wx:
            raise RuntimeError("微信未初始化或不可用")
        return self._wx.GetAllMessage()
    
    def LoadMoreMessage(self):
        """加载更多历史消息"""
        if not self._ok or not self._wx:
            raise RuntimeError("微信未初始化或不可用")
        return self._wx.LoadMoreMessage()