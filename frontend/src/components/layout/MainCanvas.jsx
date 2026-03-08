export default function MainCanvas({ children }) {
  return (
    <main className="flex-1 overflow-auto bg-surface-900 relative">
      {/* Subtle top-edge shadow to give depth from header */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-10" />
      <div className="relative z-0 h-full">
        {children}
      </div>
    </main>
  )
}
