# 微信AI助手 - 统一主题样式指南

## 🎨 颜色系统

### 主题色（Primary - 青色/Teal）
- **primary-50**: `#f0fdfa` - 极浅背景
- **primary-100**: `#ccfbf1` - 浅背景
- **primary-200-300**: 浅色强调
- **primary-400-500**: `#14b8a6` - 主要按钮、链接
- **primary-600**: `#0d9488` - 深色主题、hover 状态
- **primary-700-900**: 更深色调

### 辅助色（Secondary - 翠绿色/Green）
- **secondary-50**: `#f0fdf4` - 极浅背景
- **secondary-400-500**: `#22c55e` - 成功提示
- **secondary-600**: `#16a34a` - 深色成功

### 中性色（Gray）
- **gray-50**: 页面背景
- **gray-100**: 卡片边框
- **gray-600**: 正文
- **gray-700-900**: 标题、强调文本

### 功能色
- **红色（red-600）**: 删除、错误、停止
- **绿色（green-600）**: 成功提示
- **黄色（yellow-500）**: 警告

## 📏 字体尺寸

- **text-xs (12px)**: 辅助提示、表格小字
- **text-sm (14px)**: 正文、按钮、输入框
- **text-base (16px)**: 普通文本
- **text-lg (18px)**: 小标题
- **text-xl (20px)**: 卡片标题
- **text-2xl (24px)**: 页面标题
- **text-3xl (30px)**: 主标题

## 🔘 组件样式规范

### 按钮
- **主要按钮**: `bg-primary-600 hover:bg-primary-700 text-white`
- **次要按钮**: `bg-white text-primary-600 border border-primary-600 hover:bg-primary-50`
- **危险按钮**: `bg-red-600 hover:bg-red-700 text-white`
- **禁用按钮**: `bg-gray-400 cursor-not-allowed`

### 输入框
- **默认**: `border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:outline-none`
- **字体**: `text-sm`

### 卡片
- **容器**: `bg-white rounded-xl shadow-md border border-gray-100`
- **内边距**: `p-6` (24px)

### 表格
- **表头**: `bg-gradient-to-r from-primary-50 to-secondary-50`
- **表头文字**: `text-sm font-semibold text-primary-800`
- **表格行**: `text-sm text-gray-800`

### 模态框
- **遮罩**: `bg-black/40`
- **容器**: `bg-white rounded-lg shadow-xl`
- **标题**: `text-sm font-medium text-gray-800`

## 🎯 间距规范

- **卡片间距**: `space-y-6` (24px)
- **按钮间距**: `gap-2` (8px)
- **表单元素**: `space-y-3` (12px)
- **页面边距**: `px-4 py-8`

## 🌈 渐变效果

- **标题渐变**: `bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent`
- **按钮渐变**: `bg-gradient-to-r from-primary-400 to-secondary-500`
- **下划线渐变**: `bg-gradient-to-r from-primary-500 to-secondary-500`

## 🎭 动画过渡

- **标准过渡**: `transition-colors duration-200`
- **全面过渡**: `transition-all duration-200`
- **悬停效果**: `hover:shadow-lg hover:scale-105`

