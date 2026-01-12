import { useState, useRef, useEffect } from 'react';
import './ChatSidebar.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    source: string;
    type: string;
    score: number;
  }>;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  apiBase: string;
}

export default function ChatSidebar({ isOpen, onClose, apiBase }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant for Corpus Medica. I can help you with:\n\n• Backend and frontend code architecture\n• MONAI bundle configurations\n• Medical imaging workflows\n• Specific models in /models/bundles\n• ML and medical imaging theory\n\nWhat would you like to know?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSources, setShowSources] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          history: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          top_k: 5
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        sources: data.sources
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    "How does the MONAI bundle inference work?",
    "Explain the BraTS model architecture",
    "What's the difference between the backend routes?",
    "How do I add a new model to the platform?",
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="chat-backdrop"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`chat-sidebar ${isOpen ? 'chat-sidebar-open' : ''}`}>
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-content">
            <div className="chat-icon">🤖</div>
            <div>
              <h3>AI Assistant</h3>
              <p>Corpus Medica Knowledge Base</p>
            </div>
          </div>
          <button 
            className="chat-close-btn"
            onClick={onClose}
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div key={index} className={`chat-message chat-message-${message.role}`}>
              <div className="chat-message-avatar">
                {message.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="chat-message-content">
                <div className="chat-message-text">
                  {message.content}
                </div>
                {message.sources && message.sources.length > 0 && (
                  <div className="chat-sources">
                    <button
                      className="chat-sources-toggle"
                      onClick={() => setShowSources(showSources === index ? null : index)}
                    >
                      📚 {message.sources.length} sources
                    </button>
                    {showSources === index && (
                      <div className="chat-sources-list">
                        {message.sources.map((source, idx) => (
                          <div key={idx} className="chat-source-item">
                            <div className="chat-source-type">{source.type}</div>
                            <div className="chat-source-path">{source.source}</div>
                            <div className="chat-source-score">
                              {(source.score * 100).toFixed(0)}% match
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="chat-message chat-message-assistant">
              <div className="chat-message-avatar">🤖</div>
              <div className="chat-message-content">
                <div className="chat-loading">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length === 1 && !isLoading && (
          <div className="chat-suggestions">
            <p>Try asking:</p>
            {suggestedQuestions.map((question, idx) => (
              <button
                key={idx}
                className="chat-suggestion-btn"
                onClick={() => setInput(question)}
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form className="chat-input-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="chat-input"
            placeholder="Ask about the codebase, models, or ML theory..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? '⏳' : '➤'}
          </button>
        </form>
      </div>
    </>
  );
}
