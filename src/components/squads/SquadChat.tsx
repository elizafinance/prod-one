'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import UserAvatar from '@/components/UserAvatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
  _id: string;
  content: string;
  authorWalletAddress: string;
  createdAt: string;
  epoch: number;
  reactions?: Record<string, string[]>;
}

interface SquadChatProps {
  squadId: string;
  currentUserWallet: string;
}

const WEBSOCKET_SERVER_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001';

export default function SquadChat({ squadId, currentUserWallet }: SquadChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [charLeft, setCharLeft] = useState(140);
  const [hasPostedToday, setHasPostedToday] = useState(false);
  const [postCooldownMs, setPostCooldownMs] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Fetch initial messages
  useEffect(() => {
    async function fetchMessages() {
      try {
        const res = await fetch(`/api/squads/${squadId}/messages?epoch=current`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to fetch messages', err);
      }
    }
    fetchMessages();
  }, [squadId]);

  // Socket setup
  useEffect(() => {
    const socket = io(WEBSOCKET_SERVER_URL);
    socketRef.current = socket;
    socket.emit('join', { room: `squad_${squadId}` });

    socket.on('squad_message_new', (payload: any) => {
      if (payload?.squadId !== squadId) return;
      setMessages((prev) => [payload.message, ...prev]);
    });
    return () => {
      socket.disconnect();
    };
  }, [squadId]);

  // cooldown / posted today calc
  useEffect(() => {
    const today = new Date();
    const dayStr = `${today.getUTCFullYear()}-${(today.getUTCMonth() + 1).toString().padStart(2, '0')}-${today
      .getUTCDate()
      .toString()
      .padStart(2, '0')}`;
    const myMsgToday = messages.find((m) => m.authorWalletAddress === currentUserWallet && m.createdAt.startsWith(dayStr));
    if (myMsgToday) {
      setHasPostedToday(true);
      const nextDay = new Date(today);
      nextDay.setUTCDate(today.getUTCDate() + 1);
      nextDay.setUTCHours(0, 0, 0, 0);
      setPostCooldownMs(nextDay.getTime() - today.getTime());
    } else {
      setHasPostedToday(false);
      setPostCooldownMs(null);
    }
  }, [messages, currentUserWallet]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value.slice(0, 140);
    setInput(val);
    setCharLeft(140 - val.length);
  }

  async function sendMessage() {
    if (!input.trim()) return;
    try {
      const res = await fetch(`/api/squads/${squadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [data.message, ...prev]);
        setInput('');
        setCharLeft(140);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    try {
      const res = await fetch(`/api/squads/${squadId}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch (err) {
      console.error(err);
    }
  }

  function formatTime(ts: string) {
    const date = new Date(ts);
    return date.toLocaleString();
  }

  return (
    <div className="mt-4 border border-gray-700 rounded-md p-4 bg-gray-800/70">
      <h3 className="text-lg font-semibold mb-2">Squad Wall</h3>
      <div className="mb-4">
        <textarea
          value={input}
          onChange={handleInputChange}
          rows={3}
          className="w-full resize-none p-2 text-sm bg-gray-900 text-gray-200 rounded-md border border-gray-700 focus:outline-none"
          placeholder={hasPostedToday ? 'You have posted today. Come back tomorrow!' : 'Share a suggestion (140 chars)'}
          disabled={hasPostedToday}
        />
        <div className="flex justify-between items-center mt-1 text-xs text-gray-400">
          <span>{charLeft} characters left</span>
          <button
            onClick={sendMessage}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 px-3 py-1 rounded text-white"
            disabled={hasPostedToday || input.trim().length === 0}
          >
            Post
          </button>
        </div>
        {hasPostedToday && postCooldownMs !== null && (
          <p className="text-xs text-yellow-400 mt-1">
            You can post again in {Math.ceil(postCooldownMs / 1000 / 60 / 60)}h
          </p>
        )}
      </div>
      <ul className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {messages.map((msg) => (
          <li key={msg._id} className="flex items-start gap-2">
            <UserAvatar className="w-8 h-8" />
            <div className="flex-1 bg-gray-700/50 p-2 rounded-md">
              <div className="text-xs text-gray-400 mb-1 flex justify-between">
                <span>{msg.authorWalletAddress.slice(0, 6)}…</span>
                <span>{formatTime(msg.createdAt)}</span>
              </div>
              <div className="prose prose-sm prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
              <div className="mt-1 flex gap-2 text-sm">
                {['👍', '👀'].map((emoji) => {
                  const count = msg.reactions?.[emoji]?.length || 0;
                  const userReacted = msg.reactions?.[emoji]?.includes(currentUserWallet);
                  return (
                    <button
                      key={emoji}
                      className={`flex items-center gap-1 px-1 rounded hover:bg-gray-600/50 ${userReacted ? 'bg-gray-600/50' : ''}`}
                      onClick={() => toggleReaction(msg._id, emoji)}
                    >
                      <span>{emoji}</span>
                      <span className="text-xs">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
} 