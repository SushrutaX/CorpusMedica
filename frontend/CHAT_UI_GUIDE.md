# 🎨 Chat Panel UI - Complete Guide

## 📸 What You'll Get

```
┌────────────────────────────────────────────────────────────────────┐
│  MedAI Platform                            [💬 Ask AI Assistant]  │
│                                                                     │
│  Upload scan → Select model → Run → Results                        │
└────────────────────────────────────────────────────────────────────┘
                                                                    ┌──┐
                                                                    │  │
  When you click the button, a panel slides in from the right: ───>│  │
                                                                    │  │
                                                                    │  │
┌───────────────────────────────────────────────────────────────────┼──┤
│  Main Content Area                                                │💬│
│                                                                   │  │
│  • Model Selection                                                │C │
│  • Upload Interface                                               │H │
│  • Segmentation Results                                           │A │
│                                                                   │T │
│                                                                   │  │
│                                                                   │P │
│                                                                   │A │
│                                                                   │N │
│                                                                   │E │
│                                                                   │L │
└───────────────────────────────────────────────────────────────────┴──┘
```

## 🎯 Chat Panel Features

### 📍 Position & Animation
- ✅ Slides in from **RIGHT SIDE** of screen
- ✅ **400px width** (adjusts to 100% on mobile)
- ✅ **Smooth slide animation** (0.3s cubic-bezier)
- ✅ **Semi-transparent backdrop** (darkens main content)
- ✅ Click backdrop to close

### 🎨 VS Code-Inspired Design
- ✅ **Dark theme** (#1e1e1e background)
- ✅ **Header bar** with chat icon and title
- ✅ **Messages area** with auto-scroll
- ✅ **Input field** at bottom
- ✅ **Source attributions** (expandable)

### 💬 Chat Experience

**When Empty:**
```
┌──────────────────────────────────┐
│ 💬 CHAT                       ✕  │
│ Corpus Medica AI Assistant       │
├──────────────────────────────────┤
│                                  │
│         💬                       │
│    Build with Agent              │
│                                  │
│  AI responses may be inaccurate  │
│                                  │
│  Ask about MONAI bundles, models │
│  architectures, or workflows     │
│                                  │
│  Suggested questions:            │
│  • How does MONAI inference work?│
│  • Explain BraTS architecture    │
│  • What preprocessing for CT?    │
│  • How to add new model?         │
│                                  │
├──────────────────────────────────┤
│ Describe what to build next...  │
│                              [>] │
│ Enter to send • Shift+Enter     │
└──────────────────────────────────┘
```

**With Messages:**
```
┌──────────────────────────────────┐
│ 💬 CHAT                    🗑 ✕  │
│ Corpus Medica AI Assistant       │
├──────────────────────────────────┤
│                                  │
│  👤 You:                         │
│  ┌─────────────────────────────┐│
│  │ How does the MONAI bundle   ││
│  │ inference work?             ││
│  └─────────────────────────────┘│
│                                  │
│  🤖 Assistant:                   │
│  MONAI bundle inference uses... │
│  - Loads configuration          │
│  - Applies preprocessing        │
│  - Runs model forward pass      │
│  - Post-processes outputs       │
│                                  │
│  ⌄ 3 sources                    │
│  ────────────────────────────── │
│  📄 python_code (87%)            │
│  inference.py                    │
│  ────────────────────────────── │
│                                  │
│  [More messages...]              │
│                                  │
├──────────────────────────────────┤
│ Describe what to build next...  │
│                              [>] │
│ Enter to send • Shift+Enter     │
└──────────────────────────────────┘
```

## 🔧 Integration Points

### Backend Connection
```typescript
POST ${API_BASE}/api/chat
{
  "query": "user question here",
  "history": [...previous messages],
  "top_k": 5
}

Response:
{
  "response": "AI answer here",
  "sources": [
    {
      "source": "file/path",
      "type": "python_code",
      "score": 0.87
    }
  ],
  "context_used": 5
}
```

### Frontend State
```typescript
const [chatPanelOpen, setChatPanelOpen] = useState(false);

// Open chat
<button onClick={() => setChatPanelOpen(true)}>
  Ask AI Assistant
</button>

// Chat component
<ChatPanel
  isOpen={chatPanelOpen}
  onClose={() => setChatPanelOpen(false)}
  apiBase="http://localhost:8000"
/>
```

## 🎨 Color Palette

```
Background:     #1e1e1e  (Dark)
Header:         #252526  (Slightly lighter)
Borders:        #333333  (Subtle)
Text:           #cccccc  (Light gray)
Muted text:     #858585  (Gray)
User message:   #2d2d30  (Dark blue-gray)
AI avatar:      #16825d  (Green)
User avatar:    #0e639c  (Blue)
Accent:         #007acc  (VS Code blue)
```

## ✨ Animations

### Slide In
```
From: right: -400px (off-screen)
To:   right: 0       (visible)
Duration: 0.3s
Easing: cubic-bezier(0.25, 0.8, 0.25, 1)
```

### Backdrop Fade
```
From: opacity: 0
To:   opacity: 1
Duration: 0.2s
```

### Message Appear
```
From: opacity: 0, translateY(10px)
To:   opacity: 1, translateY(0)
Duration: 0.3s
```

### Typing Indicator
```
3 dots bouncing up and down
Each dot delayed by 0.2s
Smooth sine wave animation
```

## 📱 Responsive Behavior

### Desktop (> 768px)
- Panel: **400px width**
- Position: **Fixed right side**
- Backdrop: **Semi-transparent**

### Mobile (≤ 768px)
- Panel: **100% width**
- Position: **Full screen overlay**
- Backdrop: **Darker**

## 🎯 User Interactions

### Opening Chat
1. Click "Ask AI Assistant" button
2. Backdrop fades in
3. Panel slides in from right
4. Input field auto-focuses

### Sending Message
1. Type message in input
2. Press **Enter** (or click send button)
3. User message appears with animation
4. Loading indicator shows
5. AI response appears
6. Sources expandable below

### Closing Chat
1. Click X button (top right)
2. **OR** click backdrop
3. **OR** press Escape key
4. Panel slides out
5. Backdrop fades out

## 💡 Example Usage

```typescript
// In your App.tsx

// 1. Import
import ChatPanel from './components/ChatPanel';

// 2. Add state
const [chatOpen, setChatOpen] = useState(false);

// 3. Add button anywhere
<button onClick={() => setChatOpen(true)}>
  💬 Ask AI
</button>

// 4. Add component (at end, before closing </div>)
<ChatPanel
  isOpen={chatOpen}
  onClose={() => setChatOpen(false)}
  apiBase="http://localhost:8000"
/>
```

## ✅ Testing Checklist

- [ ] Button appears in hero section
- [ ] Click button opens chat panel
- [ ] Panel slides in smoothly from right
- [ ] Backdrop darkens main content
- [ ] Click backdrop closes panel
- [ ] Click X button closes panel
- [ ] Input field is focused when opened
- [ ] Can type and send messages
- [ ] Messages appear with animation
- [ ] Loading indicator shows while waiting
- [ ] AI responses appear correctly
- [ ] Sources are expandable
- [ ] Chat history is maintained
- [ ] Suggested questions are clickable
- [ ] Clear chat button works
- [ ] Panel is responsive on mobile

## 🚀 Quick Start

1. **Files are ready:**
   - ✅ `ChatPanel.tsx` created
   - ✅ `ChatPanel.css` created
   - ✅ Integration instructions ready

2. **Follow:** `CHAT_INTEGRATION.md`
   - 4 simple changes to App.tsx
   - Takes 2 minutes

3. **Test:**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Use:**
   - Click "Ask AI Assistant"
   - Start chatting!

## 🎉 Result

You'll have a beautiful, VS Code-inspired chat panel that:
- ✅ Matches your image reference
- ✅ Connects to your working backend
- ✅ Provides intelligent answers about your codebase
- ✅ Shows source attributions
- ✅ Maintains conversation context
- ✅ Looks professional and polished

**Backend is perfect, frontend is ready, just integrate!** 🚀
