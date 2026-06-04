'use client'

import { useState } from 'react'

export default function EmptyState() {
  const [isLoading, setIsLoading] = useState(false)

  const handleListPiece = () => {
    setIsLoading(true)
    // Handle button click - navigate to product creation flow
    setTimeout(() => {
      setIsLoading(false)
    }, 500)
  }

  return (
    <div className="flex-1 flex items-center justify-center px-5 py-8">
      <div className="flex flex-col items-center text-center max-w-sm w-full">
        {/* Decorative element - small saffron line with subtle leaf shape */}
        <div className="mb-8 flex justify-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="opacity-80"
          >
            {/* Stylized leaf shape in saffron */}
            <path
              d="M24 4 Q32 16 28 28 Q24 32 20 28 Q16 16 24 4"
              fill="#E8B43D"
              opacity="0.6"
            />
            {/* Small accent lines */}
            <line x1="24" y1="8" x2="24" y2="20" stroke="#E8B43D" strokeWidth="1.5" opacity="0.4" />
            <path
              d="M22 14 Q24 12 26 14"
              stroke="#E8B43D"
              strokeWidth="1.5"
              fill="none"
              opacity="0.4"
            />
          </svg>
        </div>

        {/* Main heading */}
        <h2 className="font-serif text-[28px] text-maya-text mb-3 leading-tight font-normal">
          Your shop is ready.
        </h2>

        {/* Subtitle */}
        <p className="text-base text-maya-muted mb-8 leading-relaxed font-normal">
          List your first piece. The world is waiting to see your work.
        </p>

        {/* Primary action button */}
        <button
          onClick={handleListPiece}
          disabled={isLoading}
          className="mb-4 h-14 px-6 bg-[#D67961] text-white font-medium text-[17px] rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-75 hover:bg-[#C2684E] min-h-[56px] shadow-sm w-[80%]"
        >
          {isLoading ? (
            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'List a piece'
          )}
        </button>

        {/* Hint text */}
        <p className="text-xs text-maya-muted font-normal">
          Takes about a minute.
        </p>
      </div>
    </div>
  )
}
