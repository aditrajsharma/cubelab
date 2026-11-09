/** The animated backdrop. Pure CSS so it costs nothing on the GPU the cube needs. */
export function Background() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-void">
      <div className="aurora">
        <div
          className="aurora-blob"
          style={{
            width: '46vw',
            height: '46vw',
            left: '-8vw',
            top: '-10vw',
            background: 'radial-gradient(circle, rgba(139,92,246,0.55) 0%, rgba(139,92,246,0) 70%)',
          }}
        />
        <div
          className="aurora-blob"
          style={{
            width: '52vw',
            height: '52vw',
            right: '-14vw',
            bottom: '-16vw',
            background: 'radial-gradient(circle, rgba(34,211,238,0.42) 0%, rgba(34,211,238,0) 70%)',
          }}
        />
        <div
          className="aurora-blob"
          style={{
            width: '34vw',
            height: '34vw',
            right: '6vw',
            top: '-6vw',
            background: 'radial-gradient(circle, rgba(245,158,11,0.28) 0%, rgba(245,158,11,0) 70%)',
          }}
        />
      </div>

      <div className="absolute inset-0 grid-veil" />
      <div className="grain absolute inset-0" />
      {/* Keeps the bottom of the viewport readable behind the glass panels. */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-void to-transparent" />
    </div>
  )
}
