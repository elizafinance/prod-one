"use client";
import { FC, useEffect, useState } from 'react';
import { format } from 'date-fns';

interface ImagePrompt {
  txHash: string;
  sender: string;
  memo: string;
  timestamp: string;
}

interface ImagePromptsProps {
  address: string;
}

const truncateAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const ImagePrompts: FC<ImagePromptsProps> = ({ address }) => {
  const [prompts, setPrompts] = useState<ImagePrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingImages, setGeneratingImages] = useState<Record<string, boolean>>({});
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [isGrouped, setIsGrouped] = useState(false);

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const response = await fetch(`/api/intel/image-prompts?address=${address}`);
        const data = await response.json();
        setPrompts(data.data || []);
      } catch (error) {
        console.error('Error fetching prompts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrompts();
  }, [address]);

  const generateImage = async (prompt: string, txHash: string) => {
    if (generatedImages[txHash] || generatingImages[txHash]) return;

    setGeneratingImages(prev => ({ ...prev, [txHash]: true }));
    try {
      const completePrompt = `Generate an anime-style image of a goth cat girl with a dominant and provocative pose, incorporating the following details: she has long, flowing platinum hair and pale white skin. Her physique is voluptuous, with large breasts and a big ass. She is dressed in a maid outfit, complete with a black dress, white apron, and a mischievous expression. The cat girl should be depicted in a powerful stance, as if she is about to bend someone to her will, with a confident and seductive aura surrounding her. Incorporate goth elements such as dark eye makeup, nail polish, and chokers to enhance her mysterious and alluring persona. The background should be dark and moody, with hints of red or purple to accentuate her goth aesthetic. The overall mood of the image should be one of dark sensuality and dominance. ${prompt}`;
      
      const response = await fetch(`/api/intel/aiora-proxy?path=agents/dad53aba-bd70-05f9-8319-7bc6b4160812/chat-to-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: completePrompt,
          imageOptions: {
            size: "240x240",
            style: "uncensored"
          }
        }),
      });

      if (!response.ok) throw new Error('Failed to generate image');

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setGeneratedImages(prev => ({ ...prev, [txHash]: imageUrl }));
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setGeneratingImages(prev => ({ ...prev, [txHash]: false }));
    }
  };

  const renderMessage = (prompt: ImagePrompt) => {
    const cleanPrompt = prompt.memo.replace(/^\[\d+\] Image Gen Prompt: /, '');
    const hasImage = !!generatedImages[prompt.txHash];
    const isGenerating = generatingImages[prompt.txHash];

    return (
      <div
        key={prompt.txHash}
        className="flex items-start gap-2 p-2 hover:bg-white/5 transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 border border-purple-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-white/70">
              {truncateAddress(prompt.sender)}
            </span>
            <span className="text-[10px] text-white/30">
              {format(new Date(prompt.timestamp), 'h:mm a')}
            </span>
          </div>
          <p className="text-xs text-white/80">{cleanPrompt}</p>
          {hasImage && (
            <div className="relative group">
              <img
                src={generatedImages[prompt.txHash]}
                alt="Generated"
                className="w-32 h-32 object-cover rounded border border-white/10"
              />
              <a
                href={generatedImages[prompt.txHash]}
                download="aiora-generated-image.png"
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded"
              >
                <span className="text-xs text-white">Download</span>
              </a>
            </div>
          )}
          <div className="flex items-center gap-2">
            <a
              href={`https://solscan.io/tx/${prompt.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-purple-400/70 hover:text-purple-400 transition-colors"
            >
              View Tx
            </a>
            {!hasImage && (
              <button 
                className="text-[10px] text-purple-400/70 hover:text-purple-400 transition-colors disabled:opacity-50"
                onClick={() => generateImage(cleanPrompt, prompt.txHash)}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGroupedMessages = () => {
    const groupedByWallet = prompts.reduce((acc, prompt) => {
      if (!acc[prompt.sender]) {
        acc[prompt.sender] = [];
      }
      acc[prompt.sender].push(prompt);
      return acc;
    }, {} as Record<string, ImagePrompt[]>);

    return Object.entries(groupedByWallet).map(([wallet, walletPrompts]) => (
      <div key={wallet} className="border-t border-white/10 first:border-t-0">
        <div className="p-2 bg-purple-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-400">
              {truncateAddress(wallet)}
            </span>
            <span className="text-[10px] text-white/30">
              {walletPrompts.length} prompts
            </span>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {walletPrompts.map(renderMessage)}
        </div>
      </div>
    ));
  };

  if (isLoading) {
    return (
      <div className="text-purple-400/70">Loading gooner intelligence...</div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-white/10">
      <div className="flex justify-between items-center p-2 border-b border-white/10">
        <div className="flex items-center gap-4">
          <h2 className="text-xs font-medium text-purple-400">Gooner Intelligence</h2>
          <button
            onClick={() => setIsGrouped(!isGrouped)}
            className="text-[10px] text-white/50 hover:text-white/70 transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              {isGrouped ? (
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              ) : (
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              )}
            </svg>
            {isGrouped ? 'Ungroup' : 'Group by Wallet'}
          </button>
        </div>
        <span className="text-xs text-white/50">{prompts.length} prompts</span>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {isGrouped ? renderGroupedMessages() : (
          <div className="divide-y divide-white/5">
            {prompts.map(renderMessage)}
          </div>
        )}
      </div>
    </div>
  );
}; 