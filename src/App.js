import React, { useEffect, useRef, useState } from 'react';
import { DirectLine } from 'botframework-directlinejs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // Enables GitHub-style Markdown (### headings, lists, bold)
import './App.css';

const LoadingDots = () => {
  return (
    <div className="message bot-message loading-dots">
      <div className="dot-container">
        <div className="dot"></div>
        <div className="dot"></div>
        <div className="dot"></div>
      </div>
    </div>
  );
};

const App = () => {
  const tokenEndpoint = process.env.REACT_APP_WEBSITE_TOKEN;
  console.log('API Key:', tokenEndpoint);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [directLine, setDirectLine] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const chatWindowRef = useRef(null);
  const bottomRef = useRef(null);

  const exampleQuestions = [
    'What is a rare disease?',
    'How can I find information about a specific rare disease?',
    'Are there any treatments available for rare diseases?',
  ];

  useEffect(() => {
    const initializeBotConnection = async () => {
      try {
        const response = await fetch(tokenEndpoint, { method: 'GET' });
        if (!response.ok) {
          throw new Error(`Failed to fetch token: ${response.statusText}`);
        }
        const data = await response.json();
        const directLineToken = data.token;

        const directLineInstance = new DirectLine({ token: directLineToken });
        setDirectLine(directLineInstance);

        directLineInstance.activity$.subscribe(
          (activity) => {
            if (activity.type === 'message' && activity.from.name !== 'User') {
              setIsLoading(false);
              setMessages((prevMessages) => [
                ...prevMessages,
                { text: activity.text, from: activity.from.name },
              ]);
            }
          },
          (err) => {
            setError(`Error receiving activity: ${err}`);
            setIsLoading(false);
          }
        );
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    initializeBotConnection();
  }, [tokenEndpoint]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = (messageText) => {
    if (directLine && messageText.trim() && !isLoading) {
      setIsLoading(true);
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: messageText, from: 'User' },
      ]);
      directLine.postActivity({
        from: { id: 'user1', name: 'User' },
        type: 'message',
        text: messageText,
      }).subscribe(
        (id) => console.log(`Message sent with ID: ${id}`),
        (err) => {
          setIsLoading(false);
          setError(`Error sending message: ${err}`);
        }
      );
      setInput('');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !isLoading) {
      sendMessage(input);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Rare<span style={{ fontWeight: 'bold' }}>Diseases</span></h1>
        <p className="app-subtitle">Helping You with Rare Disease Queries</p>
      </header>
      <main className="chat-container">
        {error ? (
          <p className="error-message">Error: {error}</p>
        ) : (
          <div className="chat-window" ref={chatWindowRef}>
            <div className="messages">
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.from === 'User' ? 'user-message' : 'bot-message'}`}>
                  {/* ✅ Renders Markdown Properly (Fix for ### headings) */}
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                </div>
              ))}
              {isLoading && <LoadingDots />}
              <div ref={bottomRef}></div>
            </div>
            <div className="input-container">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about rare diseases"
                disabled={isLoading}
                className={isLoading ? 'input-disabled' : ''}
              />
              <button onClick={() => sendMessage(input)} disabled={isLoading} className={isLoading ? 'button-disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-send">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
            <div className="example-questions-row">
              {exampleQuestions.map((question, index) => (
                <div key={index} className={`example-question-box ${isLoading ? 'disabled' : ''}`} onClick={() => !isLoading && sendMessage(question)}>
                  {question}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
