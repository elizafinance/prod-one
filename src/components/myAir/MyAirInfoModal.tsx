// src/components/myAir/MyAirInfoModal.tsx
import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, SparklesIcon, ChartBarIcon, CubeTransparentIcon, WalletIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';

interface MyAirInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MyAirInfoModal: React.FC<MyAirInfoModalProps> = ({ isOpen, onClose }) => {
  const flowSteps = [
    {
      icon: SparklesIcon,
      title: '1. Engage & Earn AIR',
      description: 'Participate in DeFAI activities, complete social tasks, and contribute to the community to earn AIR points. These points will appear on your My AIR dashboard.',
      color: 'text-purple-600',
    },
    {
      icon: ChartBarIcon,
      title: '2. Track Your Progress',
      description: 'Visit the "My AIR" page to see your current AIR points balance and legacy DeFAI snapshot (if applicable).',
      color: 'text-blue-600',
    },
    {
      icon: CubeTransparentIcon,
      title: '3. Mint AIR NFTs',
      description: 'Convert your accumulated AIR points into exclusive AIR NFTs. Choose from different tiers, each offering unique bonuses and features.',
      color: 'text-green-600',
    },
    {
      icon: WalletIcon,
      title: '4. View Your Collection',
      description: 'Your minted AIR NFTs will appear in the "My Owned AIR NFTs" section. Admire your collection and see their details.',
      color: 'text-yellow-700',
    },
    {
      icon: RocketLaunchIcon,
      title: '5. Unlock Future Benefits (Coming Soon!)',
      description: 'Hold your AIR NFTs to potentially unlock enhanced rewards, governance rights, and other exciting utilities within the DeFAI ecosystem as the platform evolves.',
      color: 'text-red-600',
    },
  ];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-2xl font-semibold leading-6 text-gray-900 mb-1 flex justify-between items-center"
                >
                  <span>Your AIR Journey: From Points to NFTs</span>
                  <button
                    type="button"
                    className="p-1 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-6 w-6" />
                    <span className="sr-only">Close modal</span>
                  </button>
                </Dialog.Title>
                <p className="text-sm text-gray-500 mb-6">
                  Follow these steps to maximize your DeFAI Rewards experience with AIR points and NFTs.
                </p>

                <div className="space-y-6">
                  {flowSteps.map((step, index) => (
                    <div key={index} className="flex items-start space-x-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-opacity-20 flex items-center justify-center ${step.color.replace('text-', 'bg-')}`}>
                        <step.icon className={`w-7 h-7 ${step.color}`} />
                      </div>
                      <div>
                        <h4 className={`text-lg font-medium ${step.color.replace('-600','-700')}`}>{step.title}</h4>
                        <p className="mt-1 text-sm text-gray-600">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 text-right">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    Got it, thanks!
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default MyAirInfoModal; 