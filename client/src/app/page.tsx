"use client"
import { useEffect, useRef, useState } from "react";
import { deleteRequest, get, streamPost } from "./utils/api";
import { v4 } from 'uuid';
import Loading from "./components/Loading";

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

interface Chat {
  chat_id: string;
  content: Message[];
  timestamp: number;
  title: string;
}

interface ChatHistory {
  [id: string]: Chat;
}

export default function Home() {
  const [activeChat, setActiveChat] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [output, setOutput] = useState<ChatHistory>({});
  const [apiStatus, setApiStatus] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const promptRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get API Health status
    get('/health').then((health) => {

      if (health.status === 'OK') {

        setApiStatus(true);

        // Get history if the API is up 
        get('/history').then((history) => {
          
          // Sort the chat dict by timestamp (inefficient, can be done in the backend)
          const sortedChatHistory: ChatHistory = {};
          Object.keys(history)
          .sort((a, b) => history[a].timestamp - history[b].timestamp)
          .forEach(key => {
            sortedChatHistory[key] = history[key];
          });

          // Save sorted history
          setOutput(sortedChatHistory);
          // Set active chat to the last one
          setActiveChat(Object.keys(sortedChatHistory)[Object.keys(sortedChatHistory).length - 1]);
        }).catch((error) => {
          console.error('Error fetching history:', error);
          // Handle error fetching history
        });

      } else {
        setApiStatus(false);
      }
    })
    .catch((error) => {
      console.error('Error fetching health status:', error);
      setApiStatus(false);
    });

  }, []);

  const handlePromptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
  };

  const invokeChatEndpoint = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Don't send empty prompts
    if (prompt.trim() === '') {
      return;
    }
    // If no chat is selected create a new one
    if (activeChat === undefined || activeChat === '') {
      createNewChat();
    }

    // Update chat title if it's still untitled
    if (output[activeChat]?.title === "") {
      output[activeChat].title = prompt;
    }

    setIsLoading(true);

    // Append the prompt to the chat
    addMessage({ role: 'user', content: prompt });
    // Send the prompt to the chat endpoint and append answer to the chat
    streamPost('/chat', { chat_id: activeChat, prompt: prompt }, (line) => {
      addMessage({ role: 'assistant', content: line.trim() });
    }).finally(() => {setIsLoading(false)});
    // Clear the prompt
    setPrompt('');
  }

  // Append message ot the chat
  const addMessage = (message: Message) => {
    setOutput((prevHistory) => {
      const currentChatHistory = prevHistory[activeChat] || {content: [], timestamp: 0, title: ''};
      const lastMessage = currentChatHistory.content[currentChatHistory.content.length - 1];
  
      if (lastMessage && lastMessage.role === message.role) {
        // If the last message is of the same role, append to the last message
        return {
          ...prevHistory,
          [activeChat]: {
            ...currentChatHistory,
            content: [
              ...currentChatHistory.content.slice(0, -1), // Remove the last message
              {
                ...lastMessage,
                content: lastMessage.content + '\n' + message.content // Concatenate content
              }
            ],
          }
        };
      } else {
        // Otherwise, create a new message
        return {
          ...prevHistory,
          [activeChat]: {
            ...currentChatHistory,
            content: [
              ...(prevHistory[activeChat]?.content || []),
              message
            ]
          }
        };
      }
    });
  };

  const createNewChat = () => {
    const newChatId = v4();
    setOutput((prevHistory) => ({
      ...prevHistory,
      [newChatId.toString()]: {
        chat_id: newChatId.toString(),
        content: [],
        timestamp: Date.now(),
        title: prompt
      }
    }));
    setActiveChat(newChatId.toString());
    // Focus the prompt input
    if (promptRef.current){
      promptRef.current.focus();
    }
  };

  const deleteChat = (chatId: string) => {
    if (window.confirm("Are you sure you want to delete this chat?")) {
      deleteRequest(`/history/${chatId}`).then(() => {
        setOutput((prevHistory) => {
          const newHistory = { ...prevHistory };
          delete newHistory[chatId];
          return newHistory;
        });
        setActiveChat('');
      }).catch((error) => {
        console.error('Error deleting chat:', error);
      });
    }
  };

  return (
    <div className="relative z-0 flex h-screen w-full overflow-y-auto bg-neutral-950">
      {/* Left Sidebar section */}
      <div className="h-full w-[260px] bg-neutral-900 sticky top-0 left-0 right-0">
        <div className="bg-neutral-900 flex flex-col flex-1">
          <div className="sticky top-0 left-0 right-0 bg-neutral-900 p-5">
            <h1 className="text-xl mb-5 font-bold">FrancescoGPT</h1>
            <button className="w-full p-2 px-3 bg-green-500 text-black text-sm rounded-lg" onClick={createNewChat}>New Chat</button>
          </div>
          <div className="flex-1 mx-5 mb-5 overflow-y-auto">
            <h1 className="text-lg">History</h1>
            <ul>
              {Object.keys(output).reverse().map((chatIndex) => (
                <li 
                  key={chatIndex} 
                  onClick={() => setActiveChat(chatIndex)} 
                  className={`cursor-pointer ${activeChat === chatIndex ? 'bg-green-500 text-black' : 'bg-neutral-800 text-white'} w-full p-2 px-3 mt-3 text-sm rounded-lg`}>
                    <div className="flex flex-row justify-between items-center">
                      <div className="flex flex-col justify-center items-start">
                        <p>{output[chatIndex].title || 'Untitled'}</p>
                        <p className={`text-xs ${activeChat != chatIndex ? 'text-neutral-500' : 'text-black'}`}>{new Date(output[chatIndex].timestamp * 1000).toLocaleString()}</p>
                      </div>
                      <span onClick={() => deleteChat(output[chatIndex].chat_id)}>&#10005;</span>
                    </div>
                </li>
              ))}
            </ul>
          </div>
          {/* Sidebar Footer */}
          <div className="absolute bottom-0 left-5">
            <hr className="w-full border border-neutral-800" />
            <div className="flex justify-center items-center">
              <p className="text-sm text-neutral-500 text-center py-5 px-3">API Status</p>
              <span className={`h-2 w-2 ${apiStatus ? 'bg-green-500' : 'bg-red-500'} rounded-xl`}></span>
            </div>
            <div className="flex flex-row justify-center items-center p-5">
              <p className="text-sm text-neutral-500 text-center">Made with &#127829; by</p>
              <a className="text-sm underline text-green-500 ml-1" href="https://francescocoacci.com" target="_blank">Francesco</a>
            </div>
          </div>
        </div>
      </div>
      {/* Content and prompt bar section */}
      <div className="relative flex h-full max-w-full flex-1 flex-col bg-neutral-950 mx-52">
        {/* Content container */}
        <div className="flex-1 mx-10 mb-11">
          {activeChat && (
            <div>
              {output[activeChat].content.map((message, index) => (
                <div key={index} className={`rounded-xl px-7 py-5 my-3 bg-neutral-900 ${message.role === 'assistant' ? 'border border-green-500' : ''}`}>
                  {message.content}
                </div>
              ))}
              {isLoading && (<Loading />)}
            </div>
          )}
        </div>

        {/* Prompt container */}
        <div className="sticky bottom-7 items-center">
          <form className="w-full flex flex-row justify-center gap-5" onSubmit={invokeChatEndpoint}>
            <input
              ref={promptRef}
              type="text"
              placeholder="Enter your prompt here"
              className="border border-neutral-500 bg-neutral-900 p-3 outline-none ml-10 rounded-xl flex-1"
              value={prompt}
              onChange={handlePromptChange}
            />
            <button
              type="submit"
              className="border border-neutral-500 bg-neutral-900 mr-10 p-3 rounded-xl"
            >
              Generate
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
