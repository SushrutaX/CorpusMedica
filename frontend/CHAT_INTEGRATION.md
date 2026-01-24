# ChatPanel Integration Instructions

## Step 1: Add Import at the Top of App.tsx

Add this line after the existing imports (around line 3):

```typescript
import ChatPanel from './components/ChatPanel';
```

## Step 2: Add State for Chat Panel

Add this state variable with your other useState declarations (around line 264):

```typescript
const [chatPanelOpen, setChatPanelOpen] = useState<boolean>(false);
```

## Step 3: Add Chat Button in Hero Section

Find the hero section (around line 1700) and add this button in the hero-copy div:

```typescript
<div className="hero-copy">
  <span className="pill">Open source - modular - model agnostic</span>
  <h1 className="hero-title">
    MedAI <span>Platform</span>
  </h1>
  <p className="lead">
    Upload a medical scan, select a segmentation model, and track results
    in real time.
  </p>
  
  {/* ADD THIS BUTTON */}
  <button
    onClick={() => setChatPanelOpen(true)}
    className="btn btn-accent"
    style={{
      marginTop: '20px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px'
    }}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    Ask AI Assistant
  </button>
  
  <div className="hero-meta">
    <div className="meta-chip">Workflow: scan to segmentation</div>
    <div className="meta-chip">Jobs: queued, running, done</div>
  </div>
</div>
```

## Step 4: Add ChatPanel Component at the End

Add this just before the closing `</div>` of your main app div (before the last `</div>` tag, around line 2300):

```typescript
      <div className="toast-stack" aria-live="polite">
        {notices.map((notice) => (
          <div key={notice.id} className={`toast toast-${notice.type}`}>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>
        ))}
      </div>
      
      {/* ADD THIS COMPONENT */}
      <ChatPanel
        isOpen={chatPanelOpen}
        onClose={() => setChatPanelOpen(false)}
        apiBase={API_BASE}
      />
    </div>
  );
}
```

## Summary of Changes

**3 Simple Changes:**

1. **Import** - Add `import ChatPanel from './components/ChatPanel';` at top
2. **State** - Add `const [chatPanelOpen, setChatPanelOpen] = useState<boolean>(false);`
3. **Button** - Add chat button in hero section
4. **Component** - Add `<ChatPanel>` component before closing div

## Quick Copy-Paste Version

If you want to do it quickly:

### 1. At top (after line 2):
```typescript
import ChatPanel from './components/ChatPanel';
```

### 2. After other useState declarations (around line 264):
```typescript
const [chatPanelOpen, setChatPanelOpen] = useState<boolean>(false);
```

### 3. In hero section (around line 1720):
```typescript
<button
  onClick={() => setChatPanelOpen(true)}
  className="btn btn-accent"
  style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
  Ask AI Assistant
</button>
```

### 4. Before final closing div (around line 2300):
```typescript
<ChatPanel
  isOpen={chatPanelOpen}
  onClose={() => setChatPanelOpen(false)}
  apiBase={API_BASE}
/>
```

Done! The chat will slide in from the right when you click the button.
