import React, { useEffect, useRef, useState } from 'react'; // Import necessary React hooks
import { DirectLine } from 'botframework-directlinejs'; // Import the DirectLine library for connecting to Bot Framework
import './App.css'; // Import the CSS for styling

// A functional component to render loading dots while waiting for a bot response
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

// The main App component
const App = () => {
  const tokenEndpoint = process.env.REACT_APP_WEBSITE_TOKEN; // Environment variable for the token endpoint
  // console.log('API Key:', tokenEndpoint); // Logs the API Key for debugging (remove in production)

  // State management using React hooks
  const [messages, setMessages] = useState([]); // Tracks messages in the chat
  const [input, setInput] = useState(''); // Tracks the current input value
  const [error, setError] = useState(null); // Tracks errors
  const [directLine, setDirectLine] = useState(null); // DirectLine instance for bot communication
  const [isLoading, setIsLoading] = useState(false); // Loading state for bot responses

  const chatWindowRef = useRef(null); // Ref to the chat window for scrolling
  const bottomRef = useRef(null); // Ref to the bottom of the chat window for smooth scrolling

  const exampleQuestions = [ // Predefined example questions for quick interactions
    'What is a rare disease?',
    'How can I find information about a specific rare disease?',
    'Are there any treatments available for rare diseases?',
  ];

  // Effect hook for initializing bot connection
  useEffect(() => {
    const initializeBotConnection = async () => {
      try {
        console.log("Token Endpoint:", tokenEndpoint);
        const response = await fetch(tokenEndpoint, { method: 'GET' }); // Fetch the token from the endpoint
        if (!response.ok) {
          throw new Error(`Failed to fetch token: ${response.statusText}`);
        }
        const data = await response.json();
        const directLineToken = data.token;

        const directLineInstance = new DirectLine({ token: directLineToken }); // Create DirectLine instance
        setDirectLine(directLineInstance);

        // Subscribe to bot activities
        directLineInstance.activity$.subscribe(
          (activity) => {
            if (activity.type === 'message' && activity.from.name !== 'User') {
              setIsLoading(false); // Stop loading state when a response is received
              const enrichedMessage = processMessage(activity.text); // Process the bot's message
              setMessages((prevMessages) => [
                ...prevMessages,
                { text: enrichedMessage.text, from: activity.from.name, sources: enrichedMessage.sources },
              ]);
            }
          },
          (err) => {
            setError(`Error receiving activity: ${err}`);
            setIsLoading(false); // Stop loading state on error
          }
        );
      } catch (err) {
        setError(err.message); // Handle errors during initialization
        setIsLoading(false);
      }
    };

    initializeBotConnection(); // Initialize bot connection on component mount
  }, [tokenEndpoint]);

  // Effect hook to scroll to the bottom of the chat window when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Function to process the bot's response message and format it
  const processMessage = (text) => {
    // Regex to find source references like [1]: https://example.com "Title"
    const sourceRegex = /\[(\d+)\]:\s*(https?:\/\/[^\s]+)\s*\"([^\"]+)\"/g;
    const references = [];
  
    // Remove extra duplicate references appearing in response
    let messageWithoutSources = text.replace(sourceRegex, (_, num, url, sourceName) => {
      references.push({ num, url, sourceName });
      return ''; // Remove from original text to avoid duplication
    });
  
    // Format Markdown-style bold (**bold text**) → <strong>bold text</strong>
    messageWithoutSources = messageWithoutSources.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
    // Convert Markdown-style headings (### Heading) → <h3>Heading</h3>
    messageWithoutSources = messageWithoutSources.replace(/###\s*(.*?)(?=\n|$)/g, '<h3>$1</h3>');
  
    // Insert clickable references inside the message itself
    const formattedText = messageWithoutSources.replace(/\[(\d+)\]/g, (match, num) => {
      const ref = references.find((r) => r.num === num);
      if (ref) {
        return `<a href="${ref.url}" target="_blank" class="reference-link">[${num}]</a>`; // Linked references
      }
      return match;
    });
  
    // 🔥 **NEW FIX**: Only show links **once**, below the message if not already inside
    let sourcesHTML = '';
    const existingLinks = new Set(); // Track which links are already inside the message
  
    references.forEach((source) => {
      if (!formattedText.includes(source.url)) {
        // If the link is NOT already in the message, add it below
        existingLinks.add(source.num);
      }
    });
  
    if (existingLinks.size > 0) {
      sourcesHTML = '<div class="source-links">';
      references.forEach((source) => {
        if (existingLinks.has(source.num)) {
          sourcesHTML += `<div><a href="${source.url}" target="_blank" class="reference-link">[${source.num}] ${source.sourceName}</a></div>`;
        }
      });
      sourcesHTML += '</div>';
    }
  
    return { text: formattedText + sourcesHTML, sources: references };
  };
  
  

  // Function to send a message to the bot
  const sendMessage = (messageText) => {
    if (directLine && messageText.trim() && !isLoading) {
      setIsLoading(true); // Set loading state
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: messageText, from: 'User' }, // Add user message to state
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
      setInput(''); // Clear input field
    }
  };

  // Handle 'Enter' key press to send messages
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
        {error ? ( // Show error message if there's an error
          <p className="error-message">Error: {error}</p>
        ) : (
          <div className="chat-window" ref={chatWindowRef}>
            <div className="messages">
              {messages.map((message, index) => ( // Render each message
                <div key={index} className={`message ${message.from === 'User' ? 'user-message' : 'bot-message'}`}>
                  <div dangerouslySetInnerHTML={{ __html: message.text }}></div> {/* Display formatted text */}
                  {message.sources && message.sources.length > 0 && ( // Render sources if available
                    <div className="sources">
                      {message.sources.map((source, i) => (
                        <div key={i} id={source.num} className="source-item">
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            [{source.num}] {source.sourceName}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && <LoadingDots />} {/* Show loading dots during bot response */}
              <div ref={bottomRef}></div> {/* Element for scrolling to bottom */}
            </div>
            <div className="input-container">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)} // Update input state on change
                onKeyDown={handleKeyDown} // Handle 'Enter' key
                placeholder="Ask me anything about rare diseases"
                disabled={isLoading} // Disable input when loading
                className={isLoading ? 'input-disabled' : ''}
              />
              <button 
                onClick={() => sendMessage(input)} 
                disabled={isLoading} // Disable button when loading
                className={isLoading ? 'button-disabled' : ''}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="feather feather-send"
                >
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
            <div className="example-questions-row">
              {exampleQuestions.map((question, index) => ( // Render example questions
                <div
                  key={index}
                  className={`example-question-box ${isLoading ? 'disabled' : ''}`}
                  onClick={() => !isLoading && sendMessage(question)} // Send example question on click
                >
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
