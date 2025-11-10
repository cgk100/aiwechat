# 前端字体规范

## 📐 统一字体大小规则

### 1. 页面标题
- **类名**: `text-2xl font-semibold text-gray-800`
- **大小**: 24px
- **用途**: 页面主标题（如"好友管理"、"好友分类"）

### 2. 卡片/区块标题
- **类名**: `text-lg font-bold text-gray-900`
- **大小**: 18px
- **用途**: 卡片内的区块标题

### 3. 说明文字
- **类名**: `text-base text-gray-600`
- **大小**: 16px
- **用途**: 说明性文字、提示信息

### 4. 按钮文字
- **类名**: `text-sm font-medium`
- **大小**: 14px
- **用途**: 所有按钮内的文字

### 5. 正文/输入框
- **类名**: `text-sm text-gray-800`
- **大小**: 14px
- **用途**: 表单输入框、普通正文

### 6. 表格内容
- **类名**: `text-sm text-gray-800`
- **大小**: 14px
- **用途**: 表格单元格内容

### 7. 表格表头
- **类名**: `text-sm font-semibold text-primary-800`
- **大小**: 14px
- **用途**: 表格列标题

### 8. 辅助提示
- **类名**: `text-xs text-gray-500`
- **大小**: 12px
- **用途**: 次要提示信息、统计数字

## 🎯 应用示例

```tsx
// 页面结构
<div className="space-y-6">
  {/* 页面标题 */}
  <h1 className="text-2xl font-semibold text-gray-800">好友管理</h1>
  
  {/* 卡片 */}
  <div className="bg-white rounded-xl shadow-md p-6">
    {/* 卡片标题 */}
    <h2 className="text-lg font-bold text-gray-900 mb-4">基本信息</h2>
    
    {/* 说明文字 */}
    <p className="text-base text-gray-600 mb-3">请填写以下信息</p>
    
    {/* 输入框 */}
    <input className="text-sm px-3 py-2" />
    
    {/* 按钮 */}
    <button className="text-sm font-medium">提交</button>
    
    {/* 辅助提示 */}
    <div className="text-xs text-gray-500 mt-2">已保存 5 条记录</div>
  </div>
</div>
```

