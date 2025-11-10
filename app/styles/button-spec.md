# 按钮样式规范

## 🎨 统一按钮样式系统

### 1. 主要按钮（Primary Button）
**用途**: 主要操作、确认、提交

```tsx
className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium 
           hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
           transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
```

**示例**: 提交表单、确认操作、同步好友

### 2. 次要按钮（Secondary Button）
**用途**: 次要操作、取消、返回

```tsx
className="px-4 py-2 rounded-lg bg-white text-primary-600 text-sm font-medium
           border border-primary-600 hover:bg-primary-50 focus:ring-2 focus:ring-primary-500
           transition-colors duration-200"
```

**示例**: 取消、关闭、返回

### 3. 危险按钮（Danger Button）
**用途**: 删除、停止等危险操作

```tsx
className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium
           hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2
           transition-colors duration-200"
```

**示例**: 删除、停止自动回复

### 4. 成功按钮（Success Button）
**用途**: 成功状态、启动、开始

```tsx
className="px-4 py-2 rounded-lg bg-secondary-600 text-white text-sm font-medium
           hover:bg-secondary-700 focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2
           transition-colors duration-200"
```

**示例**: 启动自动回复、开始任务

### 5. 渐变按钮（Gradient Button）
**用途**: 特殊操作、吸引注意力

```tsx
className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-secondary-500 
           text-white text-sm font-medium hover:shadow-lg hover:from-primary-600 
           hover:to-secondary-600 transition-all duration-200"
```

**示例**: 同步好友、立即发送

### 6. 小型按钮（Small Button）
**用途**: 表格操作、紧凑布局

```tsx
className="px-3 py-1.5 rounded-md bg-primary-600 text-white text-xs font-medium
           hover:bg-primary-700 transition-colors duration-200"
```

**示例**: 表格中的编辑、删除按钮

### 7. 图标按钮（Icon Button）
**用途**: 仅图标、紧凑操作

```tsx
className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-primary-600
           transition-colors duration-200"
```

**示例**: 关闭弹窗、展开菜单

### 8. 选择按钮（Toggle Button）
**用途**: 可选中的按钮组

```tsx
// 未选中
className="px-3 py-1.5 rounded-md text-sm font-medium border transition-all duration-200
           bg-white text-primary-700 border-primary-600 hover:bg-primary-50"

// 已选中
className="px-3 py-1.5 rounded-md text-sm font-medium border transition-all duration-200
           bg-primary-600 text-white border-primary-600"
```

**示例**: 分组选择、标签选择

## 📏 尺寸规范

| 尺寸 | 类名 | 内边距 | 字体 | 用途 |
|------|------|--------|------|------|
| **大** | `px-6 py-3` | 24px×12px | `text-base` | 重要操作 |
| **默认** | `px-4 py-2` | 16px×8px | `text-sm` | 常规操作 |
| **小** | `px-3 py-1.5` | 12px×6px | `text-xs` | 表格操作 |
| **迷你** | `px-2 py-1` | 8px×4px | `text-xs` | 极小空间 |

## 🎯 圆角规范

- **默认按钮**: `rounded-lg` (8px)
- **小型按钮**: `rounded-md` (6px)
- **图标按钮**: `rounded-lg` (8px)

## 🌈 状态规范

### Hover（悬停）
- **主要**: 颜色加深一级（600 → 700）
- **次要**: 背景变浅（white → primary-50）
- **渐变**: 添加阴影 + 颜色加深

### Focus（聚焦）
- 添加 `focus:ring-2` 环形高亮
- 颜色与按钮主色相同
- 添加 `focus:ring-offset-2` 偏移

### Disabled（禁用）
- 背景色：`bg-gray-400`
- 光标：`cursor-not-allowed`
- 透明度：可选 `opacity-50`

### Active（激活）
- 可选：`active:scale-95` 按下缩放效果

## 📋 完整示例

```tsx
// 主要按钮 - 提交表单
<button
  onClick={handleSubmit}
  disabled={loading}
  className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium 
             hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 
             focus:ring-offset-2 transition-colors duration-200 
             disabled:bg-gray-400 disabled:cursor-not-allowed"
>
  {loading ? '提交中...' : '提交'}
</button>

// 次要按钮 - 取消
<button
  onClick={handleCancel}
  className="px-4 py-2 rounded-lg bg-white text-primary-600 text-sm font-medium
             border border-primary-600 hover:bg-primary-50 focus:outline-none 
             focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
>
  取消
</button>

// 危险按钮 - 删除
<button
  onClick={handleDelete}
  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium
             hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 
             focus:ring-offset-2 transition-colors duration-200"
>
  删除
</button>

// 小型按钮 - 表格操作
<button
  onClick={handleEdit}
  className="px-3 py-1.5 rounded-md bg-primary-600 text-white text-xs font-medium
             hover:bg-primary-700 transition-colors duration-200"
>
  编辑
</button>

// 选择按钮 - 标签选择
<button
  onClick={() => setSelected(id)}
  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all duration-200 ${
    selected === id
      ? 'bg-primary-600 text-white border-primary-600'
      : 'bg-white text-primary-700 border-primary-600 hover:bg-primary-50'
  }`}
>
  选项
</button>
```

## 🚫 避免的做法

❌ 不要混用不同的圆角大小  
❌ 不要使用不一致的内边距  
❌ 不要忘记禁用状态  
❌ 不要省略 focus 样式  
❌ 不要使用过渡时间超过 300ms  
❌ 不要在按钮上使用下划线  

## ✅ 最佳实践

✓ 统一使用 `text-sm` 或 `text-xs` 作为按钮文字  
✓ 所有按钮添加 `transition-colors duration-200`  
✓ 主要操作使用实心按钮，次要操作使用描边按钮  
✓ 危险操作使用红色，必要时添加二次确认  
✓ 按钮文字使用 `font-medium`  
✓ 禁用状态使用 `disabled:` 前缀  
✓ 考虑移动端的可点击面积（最小 44×44px）

