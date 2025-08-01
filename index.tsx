import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// =================================================================================
// TYPES (from types.ts)
// =================================================================================

interface Action {
  label: string;
  url: string;
}

interface Source {
  title: string;
  uri: string;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  imagePreview?: string;
  actions?: Action[];
  sources?: Source[];
  isLoading?: boolean;
  youtubeVideoId?: string;
}

// Web Speech API Typings
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: any;
}

declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition; };
    webkitSpeechRecognition: { new (): SpeechRecognition; };
  }
}

// =================================================================================
// ICONS (from components/Icons.tsx)
// =================================================================================

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
  </svg>
);

const MicrophoneIcon = ({ isListening }: { isListening: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-6 h-6 transition-colors ${isListening ? 'text-red-500' : ''}`}>
    <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
    <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.75 6.75 0 1 1-13.5 0v-1.5a.75.75 0 0 1 .75-.75Z" />
  </svg>
);

const PaperClipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.5 10.5a.75.75 0 0 0 1.06 1.06l10.5-10.5a.75.75 0 0 1 1.06 0Zm-4.594 4.594a2.25 2.25 0 0 0-3.182 0L3.422 15.927a2.25 2.25 0 0 0 0 3.182.75.75 0 0 0 1.06-1.061 1.053 1.053 0 0 1-.018-1.043l7.76-7.761a.75.75 0 0 1 1.06 0Zm-4.664 4.665a2.25 2.25 0 0 0-3.182 0L3.345 19.95a.75.75 0 0 0 1.061 1.06l3.182-3.182a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
  </svg>
);

const SpeakerOnIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.66 1.905H6.44l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06ZM18.584 12c0-1.857-.87-3.53-2.288-4.618l-1.24 1.24A2.989 2.989 0 0 1 15.75 12a2.989 2.989 0 0 1-.673 1.878l1.24 1.24C17.714 15.53 18.584 13.857 18.584 12ZM20.93 12c0-2.923-1.385-5.52-3.646-7.23l-1.24 1.24A5.47 5.47 0 0 1 18.75 12a5.47 5.47 0 0 1-2.706 4.79l1.24 1.24C19.546 17.52 20.93 14.923 20.93 12Z" />
  </svg>
);

const SpeakerOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.66 1.905H6.44l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06Z" />
    <path fillRule="evenodd" d="M17.842 15.158 16.38 13.696a.75.75 0 0 1 1.06-1.06l1.462 1.462a.75.75 0 0 1-1.06 1.06ZM21.192 18.508l-9-9a.75.75 0 0 1 1.06-1.06l9 9a.75.75 0 0 1-1.06 1.06Z" clipRule="evenodd" />
    <path fillRule="evenodd" d="m16.38 10.304 1.462-1.462a.75.75 0 0 1 1.06 1.06l-1.462 1.462a.75.75 0 0 1-1.06-1.06Z" clipRule="evenodd" />
  </svg>
);


// =================================================================================
// GEMINI SERVICE (from services/geminiService.ts)
// =================================================================================

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const intentDetectionModel = "gemini-2.5-flash";
const searchModel = "gemini-2.5-flash";

// A map of common application names to their direct URL schemes
const knownAppSchemes: { [key: string]: string } = {
    // Social & Communication
    'instagram': 'instagram://', 'facebook': 'fb://', 'twitter': 'twitter://', 'x': 'twitter://', 'whatsapp': 'whatsapp://', 'snapchat': 'snapchat://', 'tiktok': 'tiktok://', 'linkedin': 'linkedin://', 'pinterest': 'pinterest://', 'slack': 'slack://', 'discord': 'discord://', 'telegram': 'tg://', 'zoom': 'zoomus://', 'reddit': 'reddit://',
    // Music, Video & Entertainment
    'spotify': 'spotify:', 'youtube': 'youtube://', 'netflix': 'nflx://', 'soundcloud': 'soundcloud://', 'pandora': 'pandora://', 'apple music': 'music://',
    // Navigation & Travel
    'maps': 'googlemaps://', 'google maps': 'googlemaps://', 'waze': 'waze://', 'uber': 'uber://', 'lyft': 'lyft://', 'airbnb': 'airbnb://',
    // Google Suite
    'gmail': 'googlegmail://', 'google drive': 'googledrive://', 'drive': 'googledrive://', 'google photos': 'googlephotos://', 'photos': 'googlephotos://', 'google calendar': 'googlecalendar://', 'calendar': 'googlecalendar://', 'google docs': 'googledocs://', 'docs': 'googledocs://', 'google sheets': 'googlesheets://', 'sheets': 'googlesheets://', 'google slides': 'googleslides://', 'slides': 'googleslides://',
    // Shopping & Food
    'amazon': 'amazon://', 'ebay': 'ebay://', 'etsy': 'etsy://', 'walmart': 'walmart://', 'doordash': 'doordash://', 'grubhub': 'grubhub://', 'uber eats': 'ubereats://',
    // Productivity & Finance
    'evernote': 'evernote://', 'trello': 'trello://', 'asana': 'asana://', 'outlook': 'ms-outlook://', 'microsoft teams': 'msteams://', 'teams': 'msteams://', 'dropbox': 'dbx-dropbox://', 'paypal': 'paypal://', 'venmo': 'venmo://', 'cash app': 'cashapp://',
    // Other
    'duolingo': 'duolingo://',
};

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const getYouTubeVideoId = (url: string): string | null => {
    try {
        if (!url || !url.trim()) return null;
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
};

const intentSchema = {
    type: Type.OBJECT,
    properties: {
        music: { type: Type.OBJECT, properties: { platform: { type: Type.STRING, description: "The music platform, e.g., Spotify, Apple Music." }, query: { type: Type.STRING, description: "The song and/or artist to search for" } } },
        youtube: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "The video to search for on YouTube" } } },
        call: { type: Type.OBJECT, properties: { number: { type: Type.STRING, description: "The phone number to call" } } },
        website: { type: Type.OBJECT, properties: { url: { type: Type.STRING, description: "The full URL of the website to open, ensuring it starts with http:// or https://" } } },
        map: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "The location or directions to search on Google Maps" } } },
        openApp: { type: Type.OBJECT, properties: { appName: { type: Type.STRING, description: "The name of the application to open, e.g., 'Instagram', 'Calculator', 'WhatsApp'." } } },
        webSearch: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "The user's original query for a web search" } } },
        generalResponse: { type: Type.STRING, description: "A direct answer for general conversation, a question that doesn't need a web search, or if the intent is unclear." },
    },
};

const getAssistantResponse = async (prompt: string, attachedFile: File | null): Promise<Partial<Message>> => {
    try {
        const parts = [{ text: prompt }];
        if (attachedFile) {
            const imagePart = await fileToGenerativePart(attachedFile);
            parts.push(imagePart as any);
        }

        const systemInstruction = `You are a powerful and helpful multipurpose assistant.
Analyze the user's prompt and determine their primary intent. Your response must be in JSON format conforming to the provided schema.
Based on the intent, populate ONLY ONE of the fields in the JSON. All other fields must be null.

IMPORTANT RULE: If a user asks to play something and mentions 'YouTube', you MUST use the 'youtube' intent.
IMPORTANT RULE: When a user's request could be both an app and a website (e.g., "open facebook"), you MUST prioritize the 'openApp' intent.

Here are the intents:
- youtube: User wants to watch a video on YouTube. Prioritize this if 'youtube' is mentioned in a media request.
- music: User wants to play music on a platform OTHER THAN YouTube.
- openApp: User wants to open a native application on their device. Prioritize this over 'website' for ambiguous names.
- website: User wants to open a specific website. Use for clear domain names (e.g., 'espn.com').
- call: User wants to make a phone call.
- map: User wants to find a location or directions.
- webSearch: Use this for any question that requires up-to-date, real-time, or factual information (e.g., "Who won the last Super Bowl?", "What is the capital of France?", "What is the weather like?"). Also use for explicit search commands like "google...".
- generalResponse: Use this to answer general knowledge questions that do not require real-time data (e.g., "Why is the sky blue?", "Tell me a joke"). It is also used for simple greetings, conversation, or when analyzing an attached image.`;
        
        const intentResponse = await ai.models.generateContent({
            model: intentDetectionModel,
            contents: { role: 'user', parts },
            config: { systemInstruction: systemInstruction, responseMimeType: "application/json", responseSchema: intentSchema }
        });

        const intentJsonText = intentResponse.text.trim();
        const intentData = JSON.parse(intentJsonText);

        const musicData = intentData.music;
        if (musicData && musicData.query && musicData.query.toLowerCase() !== 'null' && musicData.platform && musicData.platform.toLowerCase() !== 'null') {
            const { platform, query } = musicData;
            if (platform.toLowerCase().includes('spotify')) {
                return { text: `Playing "${query}" on Spotify.`, actions: [{ label: `Play on Spotify`, url: `spotify:search:${encodeURIComponent(query)}` }] };
            }
            return { text: `Playing "${query}" on ${platform}.`, actions: [{ label: `Play on ${platform}`, url: `https://www.google.com/search?q=${encodeURIComponent(`play ${query} on ${platform}`)}` }] };
        } else if (intentData.youtube && intentData.youtube.query && intentData.youtube.query.toLowerCase() !== 'null') {
            const { query } = intentData.youtube;
            try {
                const searchPrompt = `Search for a YouTube video about "${query}". Return ONLY the full raw URL of the top video result, like "https://www.youtube.com/watch?v=...". Do not add any other text.`;
                const videoSearchResponse = await ai.models.generateContent({ model: searchModel, contents: { role: 'user', parts: [{ text: searchPrompt }] }, config: { tools: [{ googleSearch: {} }] } });
                const videoUrl = videoSearchResponse.text.trim();
                const videoId = getYouTubeVideoId(videoUrl);
                if (videoId) {
                    return { text: `Here is the video for "${query}".`, youtubeVideoId: videoId, actions: [{ label: 'Watch on YouTube Website', url: `https://www.youtube.com/watch?v=${videoId}` }] };
                } else {
                    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    return { text: `I couldn't find a specific video, but here are the search results for "${query}".`, actions: [{ label: 'Search on YouTube', url: searchUrl }] };
                }
            } catch (error) {
                const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                return { text: `I had trouble finding a specific video, but you can see the search results here.`, actions: [{ label: 'Search on YouTube', url: searchUrl }] };
            }
        } else if (intentData.call && intentData.call.number && intentData.call.number.toLowerCase() !== 'null') {
            const { number } = intentData.call;
            const sanitizedNumber = number.replace(/\s/g, '');
            return { text: `Calling ${number}.`, actions: [{ label: `Call ${number}`, url: `tel:${sanitizedNumber}` }] };
        } else if (intentData.website && intentData.website.url && intentData.website.url.toLowerCase() !== 'null') {
            let { url } = intentData.website;
            if (!url.startsWith('http')) { url = `https://${url}`; }
            let hostname = 'the website';
            try { hostname = new URL(url).hostname; } catch (e) { console.warn('Could not parse URL for label:', url); }
            return { text: `Opening ${hostname}.`, actions: [{ label: `Open ${hostname}`, url }] };
        } else if (intentData.map && intentData.map.query && intentData.map.query.toLowerCase() !== 'null') {
            const { query } = intentData.map;
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
            return { text: `Finding "${query}" on Google Maps.`, actions: [{ label: 'Open in Google Maps', url }] };
        } else if (intentData.openApp && intentData.openApp.appName && intentData.openApp.appName.toLowerCase() !== 'null') {
            const { appName } = intentData.openApp;
            const normalizedAppName = appName.toLowerCase().trim();
            const scheme = knownAppSchemes[normalizedAppName];
            if (scheme) {
                return { text: `Opening ${appName}...`, actions: [{ label: `Open ${appName}`, url: scheme }] };
            } else {
                return { text: `I can't open "${appName}" directly, but this link might help you find it.`, actions: [{ label: `Find ${appName}`, url: `https://www.google.com/search?q=${encodeURIComponent(`open ${appName} app`)}` }] };
            }
        } else if (intentData.webSearch && intentData.webSearch.query && intentData.webSearch.query.toLowerCase() !== 'null') {
            const { query } = intentData.webSearch;
            const searchResponse = await ai.models.generateContent({ model: searchModel, contents: { role: 'user', parts: [{ text: query }] }, config: { tools: [{ googleSearch: {} }] } });
            const responseText = searchResponse.text.trim();
            const groundingMetadata = searchResponse.candidates?.[0]?.groundingMetadata;
            const webSources: Source[] = groundingMetadata?.groundingChunks?.filter((c: any) => c.web?.uri).map((c: any) => ({ uri: c.web.uri, title: c.web.title || c.web.uri })) || [];
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            return { text: responseText || "Here are some search results for your query.", sources: webSources.length > 0 ? webSources : undefined, actions: [{ label: `Search Google for "${query}"`, url: searchUrl }] };
        } else if (intentData.generalResponse) {
            const responseText = intentData.generalResponse;
            const query = prompt.trim();
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            if (responseText) {
                return { text: responseText, actions: [{ label: `Search Google for "${query}"`, url: searchUrl }] };
            } else {
                return { text: `I couldn't answer that directly, so here are some Google search results for you.`, actions: [{ label: `Search Google for "${query}"`, url: searchUrl }] };
            }
        } else {
            console.warn("Falling back to web search due to missing params or unhandled intent:", intentData);
            const query = prompt.trim();
            if (!query) return { text: "Sorry, I didn't understand that. Could you please rephrase?" };
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            return { text: `I wasn't sure how to handle that. Here are the Google search results for you.`, actions: [{ label: `Search Google for "${query}"`, url: searchUrl }] };
        }
    } catch (error) {
        console.error("Error getting assistant response:", error);
        return { text: "Sorry, I encountered an error. Please try again." };
    }
};


// =================================================================================
// MESSAGE COMPONENT (from components/Message.tsx)
// =================================================================================

const UserMessage: React.FC<{ message: Message }> = ({ message }) => (
  <div className="flex justify-end">
    <div className="bg-blue-600 rounded-lg rounded-br-none p-3 max-w-lg text-white">
      {message.imagePreview && (
        <img src={message.imagePreview} alt="User upload" className="rounded-md mb-2 max-h-48" />
      )}
      <p>{message.text}</p>
    </div>
  </div>
);

const ModelMessage: React.FC<{ message: Message }> = ({ message }) => (
  <div className="flex justify-start">
    <div className="bg-slate-700 rounded-lg rounded-bl-none p-3 max-w-lg text-gray-100">
      {message.isLoading ? (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap">{message.text}</p>
          {message.youtubeVideoId && (
            <div className="mt-3 aspect-video">
              <iframe className="w-full h-full rounded-md" src={`https://www.youtube.com/embed/${message.youtubeVideoId}?autoplay=1`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
            </div>
          )}
          {message.actions && message.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.actions.map((action: Action, index: number) => (
                <a key={index} href={action.url} target="_blank" rel="noopener noreferrer" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full text-sm transition-colors duration-200">
                  {action.label}
                </a>
              ))}
            </div>
          )}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-4 border-t border-slate-600 pt-3">
              <h4 className="text-xs font-semibold text-gray-400 mb-2">Sources:</h4>
              <div className="flex flex-col space-y-2">
                {message.sources.map((source: Source, index: number) => (
                  <a key={index} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate" title={source.uri}>
                    {index + 1}. {source.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </div>
);

const MessageDisplay: React.FC<{ message: Message }> = ({ message }) => {
  return message.role === 'user' ? <UserMessage message={message} /> : <ModelMessage message={message} />;
};


// =================================================================================
// INPUT BAR COMPONENT (from components/InputBar.tsx)
// =================================================================================

interface InputBarProps {
  input: string;
  setInput: (value: string) => void;
  isListening: boolean;
  onSend: (e?: React.FormEvent) => void;
  onMicClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
}

const InputBar: React.FC<InputBarProps> = ({ input, setInput, isListening, onSend, onMicClick, onFileChange, isLoading }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const handleAttachClick = () => { fileInputRef.current?.click(); };

  return (
    <form onSubmit={onSend} className="bg-slate-800 p-4 flex items-center space-x-3 border-t border-slate-700">
      <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
      <button type="button" onClick={handleAttachClick} disabled={isLoading} className="p-2 text-gray-400 hover:text-white disabled:text-gray-600 transition-colors">
        <PaperClipIcon />
      </button>
      <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={isListening ? 'Listening...' : 'Ask me anything...'} disabled={isLoading} className="flex-1 bg-slate-900 text-white placeholder-gray-500 p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
      <button type="button" onClick={onMicClick} disabled={isLoading} className="p-2 text-gray-400 hover:text-white disabled:text-gray-600 transition-colors">
        <MicrophoneIcon isListening={isListening} />
      </button>
      <button type="submit" disabled={isLoading || !input.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-full p-3 transition-colors">
        <SendIcon />
      </button>
    </form>
  );
};


// =================================================================================
// APP COMPONENT (from App.tsx)
// =================================================================================

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionImpl();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => { console.error('Speech recognition error:', event.error); setIsListening(false); };
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results).map((result) => result[0]).map((result) => result.transcript).join('');
        setInput(transcript);
        if (event.results[0].isFinal) { handleSend(undefined, transcript); }
      };
      recognitionRef.current = recognition;
    }
  }, []); 
  
  const speak = useCallback((text: string) => {
      if (!isTtsEnabled || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
  }, [isTtsEnabled]);

  const handleSend = async (e?: React.FormEvent, voiceInput?: string) => {
    if (e) e.preventDefault();
    const currentInput = voiceInput || input;
    if (!currentInput.trim() && !attachedFile) return;

    setIsLoading(true);
    const userMessage: Message = { id: Date.now().toString(), role: 'user', text: currentInput, imagePreview: imagePreview || undefined };
    setMessages((prev) => [...prev, userMessage, { id: 'loading', role: 'model', text: '', isLoading: true }]);

    const response = await getAssistantResponse(currentInput, attachedFile);
    setInput('');
    setAttachedFile(null);
    setImagePreview('');

    if (response.actions && response.actions.length > 0 && !response.youtubeVideoId) {
      window.open(response.actions[0].url, '_blank');
    }

    const modelMessage: Message = { id: Date.now().toString() + '-model', role: 'model', text: response.text || 'Sorry, I could not process that.', actions: response.actions, sources: response.sources, youtubeVideoId: response.youtubeVideoId };
    speak(modelMessage.text);

    setMessages((prev) => prev.filter(m => m.id !== 'loading'));
    setMessages((prev) => [...prev, modelMessage]);
    setIsLoading(false);
  };
  
  const handleMicClick = () => {
    if (isListening) { recognitionRef.current?.stop(); } else { recognitionRef.current?.start(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => { setImagePreview(reader.result as string); };
      reader.readAsDataURL(file);
      setInput(prev => prev ? `${prev} (see attached image)` : 'Describe this image.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
      <header className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold text-white">Nexus AI Assistant</h1>
        <button onClick={() => setIsTtsEnabled(prev => !prev)} className="p-2 text-gray-300 hover:text-white transition-colors">
          {isTtsEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
        </button>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => (
            <MessageDisplay key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="w-full">
         {imagePreview && (
          <div className="bg-slate-800 p-2 text-center text-sm relative">
            <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover inline-block rounded-md"/>
            <button onClick={() => { setAttachedFile(null); setImagePreview(''); }} className="absolute top-0 right-2 text-white bg-red-600 rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">&times;</button>
          </div>
        )}
        <InputBar input={input} setInput={setInput} isListening={isListening} onSend={handleSend} onMicClick={handleMicClick} onFileChange={handleFileChange} isLoading={isLoading} />
      </footer>
    </div>
  );
};


// =================================================================================
// RENDER LOGIC (from original index.tsx)
// =================================================================================

// Register the service worker for PWA capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);