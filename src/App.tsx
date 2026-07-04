import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent, PointerEvent } from 'react'
import { AiOutlineCamera, AiOutlinePicture } from 'react-icons/ai'
import './App.css'

type Tab = 'idea' | 'connect'

type Idea = {
  id: string
  text: string
  image?: boolean
  important: boolean
  createdAt: number
}

type Sticky = {
  id: string
  title: string
  color: string
  afterIdeaId: string | null
}

type DragItem =
  | { kind: 'idea'; id: string }
  | { kind: 'sticky'; id: string }
  | null

type FlyingIdea = {
  id: string
  direction: 'to-connect' | 'to-idea'
} | null

const STORAGE_KEY = 'moyatto-connect-v1'

const colors = [
  { name: 'pink 1', value: '#f31059' },
  { name: 'pink 2', value: '#f31059' },
  { name: 'pink 3', value: '#f31059' },
  { name: 'pink 4', value: '#f31059' },
  { name: 'pink 5', value: '#f31059' },
  { name: 'pink 6', value: '#f31059' },
  { name: 'pale pink', value: '#e4b1b4' },
]

const starterIdeas: Idea[] = []

const starterStickies: Sticky[] = []

function savedData() {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved ? JSON.parse(saved) : null
}

function App() {
  const [tab, setTab] = useState<Tab>('idea')
  const [appTitle, setAppTitle] = useState(() => savedData()?.appTitle ?? 'タイトル')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(appTitle)
  const [ideas, setIdeas] = useState<Idea[]>(() => {
    const saved = savedData()
    return saved?.ideas ?? starterIdeas
  })
  const [connectOrder, setConnectOrder] = useState<string[]>(() => {
    const saved = savedData()
    return saved
      ? saved.connectOrder
      : starterIdeas.filter((idea) => idea.important).map((idea) => idea.id)
  })
  const [stickies, setStickies] = useState<Sticky[]>(() => {
    const saved = savedData()
    return saved?.stickies ?? starterStickies
  })
  const [draft, setDraft] = useState('')
  const [addingIdea, setAddingIdea] = useState(false)
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [stickyTarget, setStickyTarget] = useState<string | null | undefined>()
  const [stickyTitle, setStickyTitle] = useState('')
  const [stickyColor, setStickyColor] = useState(colors[0].value)
  const [dragItem, setDragItem] = useState<DragItem>(null)
  const [flyingIdea, setFlyingIdea] = useState<FlyingIdea>(null)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ appTitle, ideas, connectOrder, stickies }),
    )
  }, [appTitle, ideas, connectOrder, stickies])

  useEffect(() => {
    if (ideas.some((idea) => idea.important)) return
    if (connectOrder.length === 0 && stickies.length === 0) return

    setConnectOrder([])
    setStickies([])
  }, [connectOrder.length, ideas, stickies.length])

  const importantIdeas = useMemo(() => {
    const currentIds = ideas
      .filter((idea) => idea.important)
      .map((idea) => idea.id)

    return connectOrder
      .filter((id) => currentIds.includes(id))
      .concat(currentIds.filter((id) => !connectOrder.includes(id)))
      .map((id) => ideas.find((idea) => idea.id === id))
      .filter(Boolean) as Idea[]
  }, [connectOrder, ideas])

  const orderedStickies = useMemo(() => {
    const ideaPosition = new Map(
      importantIdeas.map((idea, index) => [idea.id, index]),
    )

    return [...stickies].sort((a, b) => {
      const aPosition =
        a.afterIdeaId === null ? -1 : ideaPosition.get(a.afterIdeaId) ?? 999
      const bPosition =
        b.afterIdeaId === null ? -1 : ideaPosition.get(b.afterIdeaId) ?? 999
      return aPosition - bPosition
    })
  }, [importantIdeas, stickies])

  function addIdea(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return

    const id = crypto.randomUUID()
    const important = tab === 'connect'
    setIdeas((current) => [
      ...current,
      { id, text, important, createdAt: Date.now() },
    ])
    if (important) {
      setConnectOrder((current) => [...current, id])
    }
    setDraft('')
    setAddingIdea(false)
  }

  function startEditIdea(idea: Idea) {
    setAddingIdea(false)
    setStickyTarget(undefined)
    setEditingIdeaId(idea.id)
    setEditingDraft(idea.text)
  }

  function saveIdea(event: FormEvent) {
    event.preventDefault()
    const text = editingDraft.trim()
    if (!text || !editingIdeaId) return

    setIdeas((current) =>
      current.map((idea) =>
        idea.id === editingIdeaId ? { ...idea, text } : idea,
      ),
    )
    setEditingIdeaId(null)
    setEditingDraft('')
  }

  function deleteIdea() {
    if (!editingIdeaId) return

    setIdeas((current) => current.filter((idea) => idea.id !== editingIdeaId))
    setConnectOrder((current) => current.filter((id) => id !== editingIdeaId))
    setStickies((current) =>
      current.filter((sticky) => sticky.afterIdeaId !== editingIdeaId),
    )
    setEditingIdeaId(null)
    setEditingDraft('')
  }

  function toggleImportant(id: string) {
    const idea = ideas.find((currentIdea) => currentIdea.id === id)
    if (idea && !idea.important) {
      setFlyingIdea({ id, direction: 'to-connect' })
      window.setTimeout(() => {
        setIdeas((current) =>
          current.map((currentIdea) =>
            currentIdea.id === id ? { ...currentIdea, important: true } : currentIdea,
          ),
        )
        setConnectOrder((current) =>
          current.includes(id) ? current : [...current, id],
        )
        setFlyingIdea(null)
      }, 360)
      return
    }

    if (idea?.important) {
      setFlyingIdea({ id, direction: 'to-idea' })
      window.setTimeout(() => {
        setIdeas((current) =>
          current.map((currentIdea) =>
            currentIdea.id === id
              ? { ...currentIdea, important: false }
              : currentIdea,
          ),
        )
        setConnectOrder((current) => current.filter((currentId) => currentId !== id))
        setStickies((current) =>
          current.filter((sticky) => sticky.afterIdeaId !== id),
        )
        setFlyingIdea(null)
      }, 360)
      return
    }

    setIdeas((current) =>
      current.map((idea) =>
        idea.id === id ? { ...idea, important: !idea.important } : idea,
      ),
    )
    setConnectOrder((current) =>
      current.includes(id) ? current : [...current, id],
    )
  }

  function stickyForIdea(ideaId: string) {
    const ideaIndex = importantIdeas.findIndex((idea) => idea.id === ideaId)
    if (ideaIndex === -1) return undefined

    return orderedStickies
      .filter((sticky) => {
        if (sticky.afterIdeaId === null) return true
        const stickyIndex = importantIdeas.findIndex(
          (idea) => idea.id === sticky.afterIdeaId,
        )
        return stickyIndex < ideaIndex
      })
      .at(-1)
  }

  function moveIdea(targetId: string) {
    if (!dragItem) return

    if (dragItem.kind === 'idea') {
      if (dragItem.id === targetId) return

      const sourceSticky = stickyForIdea(dragItem.id)
      const destinationSticky = stickyForIdea(targetId)

      setConnectOrder((current) => {
        const next = current.filter((id) => id !== dragItem.id)
        const targetIndex = next.indexOf(targetId)
        next.splice(targetIndex, 0, dragItem.id)
        return next
      })

      if (sourceSticky && sourceSticky.id !== destinationSticky?.id) {
        setStickies((current) =>
          current.filter((sticky) => sticky.id !== sourceSticky.id),
        )
      }
    }

    if (dragItem.kind === 'sticky') {
      const previousIdeaId =
        importantIdeas[importantIdeas.findIndex((idea) => idea.id === targetId) - 1]
          ?.id ?? null
      setStickies((current) =>
        current.map((sticky) =>
          sticky.id === dragItem.id
            ? { ...sticky, afterIdeaId: previousIdeaId }
            : sticky,
        ),
      )
    }
  }

  function addSticky(event: FormEvent) {
    event.preventDefault()
    const title = stickyTitle.trim()
    if (!title) return
    const afterIdeaId = stickyTarget ?? null
    if (stickies.some((sticky) => sticky.afterIdeaId === afterIdeaId)) {
      setStickyTitle('')
      setStickyColor(colors[0].value)
      setStickyTarget(undefined)
      return
    }

    setStickies((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title,
        color: stickyColor,
        afterIdeaId,
      },
    ])
    setStickyTitle('')
    setStickyColor(colors[0].value)
    setStickyTarget(undefined)
  }

  function colorForIdea(ideaId: string) {
    const ideaIndex = importantIdeas.findIndex((idea) => idea.id === ideaId)
    const activeSticky = orderedStickies
      .filter((sticky) => {
        if (sticky.afterIdeaId === null) return true
        const stickyIndex = importantIdeas.findIndex(
          (idea) => idea.id === sticky.afterIdeaId,
        )
        return stickyIndex < ideaIndex
      })
      .at(-1)

    return activeSticky?.color ?? '#000002'
  }

  function saveTitle() {
    const nextTitle = titleDraft.trim() || 'タイトル'
    setAppTitle(nextTitle)
    setTitleDraft(nextTitle)
    setEditingTitle(false)
  }

  return (
    <main className="app-shell">
      <section className={`phone-frame ${tab}-screen`} aria-label="もやっとこねくと">
        <header className="app-header">
          {editingTitle ? (
            <form
              className="title-editor"
              onSubmit={(event) => {
                event.preventDefault()
                saveTitle()
              }}
            >
              <input
                autoFocus
                value={titleDraft}
                onBlur={saveTitle}
                onChange={(event) => setTitleDraft(event.target.value)}
              />
            </form>
          ) : (
            <button
              className="title-button"
              onClick={() => {
                setTitleDraft(appTitle)
                setEditingTitle(true)
              }}
              type="button"
            >
              {appTitle}
            </button>
          )}
        </header>

        <div className="content">
          {tab === 'idea' ? (
            <IdeaTab
              flyingIdea={flyingIdea}
              ideas={ideas.filter((idea) => !idea.important)}
              onEditIdea={startEditIdea}
              onToggleImportant={toggleImportant}
            />
          ) : (
            <ConnectTab
              ideas={importantIdeas}
              stickies={orderedStickies}
              colorForIdea={colorForIdea}
              onDropIdea={moveIdea}
              onDragStart={setDragItem}
              onDragEnd={() => setDragItem(null)}
              onEditIdea={startEditIdea}
              onOpenSticky={(afterIdeaId) => setStickyTarget(afterIdeaId)}
              onReturnIdea={toggleImportant}
              flyingIdea={flyingIdea}
            />
          )}
        </div>

        {addingIdea ? (
          <form className="idea-composer-screen" onSubmit={addIdea}>
            <div className="idea-composer-top">
              <button
                aria-label="閉じる"
                className="composer-close"
                type="button"
                onClick={() => setAddingIdea(false)}
              />
              <button className="composer-ok" type="submit">
                OK
              </button>
            </div>
            <textarea
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="もやっとしたことを書く"
            />
            <div className="composer-image-preview" aria-hidden="true" />
            <div className="composer-tool-row" aria-label="画像追加">
              <button aria-label="カメラ" type="button">
                <AiOutlineCamera />
              </button>
              <button aria-label="写真" type="button">
                <AiOutlinePicture />
              </button>
            </div>
          </form>
        ) : null}

        {editingIdeaId ? (
          <form className="composer" onSubmit={saveIdea}>
            <textarea
              autoFocus
              value={editingDraft}
              onChange={(event) => setEditingDraft(event.target.value)}
              placeholder="アイディアを編集"
            />
            <div className="composer-actions">
              <button className="danger-button" type="button" onClick={deleteIdea}>
                削除
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingIdeaId(null)
                  setEditingDraft('')
                }}
              >
                閉じる
              </button>
              <button type="submit">保存</button>
            </div>
          </form>
        ) : null}

        {stickyTarget !== undefined ? (
          <form className="composer sticky-composer" onSubmit={addSticky}>
            <input
              autoFocus
              value={stickyTitle}
              onChange={(event) => setStickyTitle(event.target.value)}
              placeholder="付箋タイトル"
            />
            <div className="color-row" aria-label="付箋の色">
              {colors.map((color) => (
                <button
                  aria-label={color.name}
                  className={stickyColor === color.value ? 'selected' : ''}
                  key={color.name}
                  onClick={() => setStickyColor(color.value)}
                  style={{ background: color.value }}
                  type="button"
                />
              ))}
            </div>
            <div className="composer-actions">
              <button type="button" onClick={() => setStickyTarget(undefined)}>
                閉じる
              </button>
              <button type="submit">挿入</button>
            </div>
          </form>
        ) : null}

        <button
          aria-label="アイディアを追加"
          className="fab"
          onClick={() => setAddingIdea(true)}
          type="button"
        >
          <span />
        </button>

        <nav className="tabbar" aria-label="画面切り替え">
          <span className={`tab-indicator ${tab}`} />
          <button
            className={tab === 'idea' ? 'active' : ''}
            onClick={() => setTab('idea')}
            type="button"
          >
            idea
          </button>
          <button
            className={tab === 'connect' ? 'active' : ''}
            onClick={() => setTab('connect')}
            type="button"
          >
            connect
          </button>
        </nav>
      </section>
    </main>
  )
}

function IdeaTab({
  flyingIdea,
  ideas,
  onEditIdea,
  onToggleImportant,
}: {
  flyingIdea: FlyingIdea
  ideas: Idea[]
  onEditIdea: (idea: Idea) => void
  onToggleImportant: (id: string) => void
}) {
  return (
    <div className="idea-list">
      {ideas.map((idea) => (
        <SwipeCard
          flyDirection={
            flyingIdea?.id === idea.id ? flyingIdea.direction : undefined
          }
          idea={idea}
          key={idea.id}
          onEdit={() => onEditIdea(idea)}
          onSwipe={() => onToggleImportant(idea.id)}
        />
      ))}
    </div>
  )
}

function SwipeCard({
  flyDirection,
  idea,
  onEdit,
  onSwipe,
}: {
  flyDirection?: 'to-connect' | 'to-idea'
  idea: Idea
  onEdit: () => void
  onSwipe: () => void
}) {
  const [startX, setStartX] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const isFlying = Boolean(flyDirection)

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (isFlying) return
    setStartX(event.clientX)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (isFlying) return
    if (!startX) return
    setOffsetX(Math.max(0, Math.min(86, event.clientX - startX)))
  }

  function onPointerUp() {
    if (isFlying) return
    if (offsetX > 54) onSwipe()
    if (offsetX < 8) onEdit()
    setStartX(0)
    setOffsetX(0)
  }

  return (
    <article
      className={`idea-card ${idea.important ? 'important' : ''} ${flyDirection ? `flying-${flyDirection}` : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ transform: `translateX(${offsetX}px)` }}
    >
      <p>{idea.text}</p>
      {idea.image ? <div className="image-placeholder" /> : null}
    </article>
  )
}

function ConnectTab({
  flyingIdea,
  ideas,
  stickies,
  colorForIdea,
  onDropIdea,
  onDragStart,
  onDragEnd,
  onEditIdea,
  onOpenSticky,
  onReturnIdea,
}: {
  flyingIdea: FlyingIdea
  ideas: Idea[]
  stickies: Sticky[]
  colorForIdea: (id: string) => string
  onDropIdea: (targetId: string) => void
  onDragStart: (item: DragItem) => void
  onDragEnd: () => void
  onEditIdea: (idea: Idea) => void
  onOpenSticky: (afterIdeaId: string | null) => void
  onReturnIdea: (id: string) => void
}) {
  if (ideas.length === 0) {
    return <div className="connect-list" />
  }

  const stickyByGap = new Map(
    stickies.map((sticky) => [sticky.afterIdeaId, sticky]),
  )

  return (
    <div className="connect-list">
      {ideas.map((idea, index) => {
        const gapId = index === 0 ? null : ideas[index - 1].id
        const stickyBeforeIdea = stickyByGap.get(gapId)

        return (
          <div className="connect-block" key={idea.id}>
            {stickyBeforeIdea ? (
              <StickyLabel
                sticky={stickyBeforeIdea}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ) : (
              <button
                className="insert-button"
                onClick={() => onOpenSticky(gapId)}
                type="button"
              >
                +
              </button>
            )}
            <ConnectSwipeCard
              flyDirection={
                flyingIdea?.id === idea.id ? flyingIdea.direction : undefined
              }
              idea={idea}
              onDragEnd={onDragEnd}
              onDragStart={() => onDragStart({ kind: 'idea', id: idea.id })}
              onDrop={() => onDropIdea(idea.id)}
              onEdit={() => onEditIdea(idea)}
              onSwipeLeft={() => onReturnIdea(idea.id)}
              style={{ '--bar-color': colorForIdea(idea.id) } as CSSProperties}
            />
          </div>
        )
      })}
    </div>
  )
}

function ConnectSwipeCard({
  flyDirection,
  idea,
  onDragEnd,
  onDragStart,
  onDrop,
  onEdit,
  onSwipeLeft,
  style,
}: {
  flyDirection?: 'to-connect' | 'to-idea'
  idea: Idea
  onDragEnd: () => void
  onDragStart: () => void
  onDrop: () => void
  onEdit: () => void
  onSwipeLeft: () => void
  style: CSSProperties
}) {
  const [startX, setStartX] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const isFlying = Boolean(flyDirection)

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (isFlying) return
    setStartX(event.clientX)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (isFlying) return
    if (!startX) return
    setOffsetX(Math.min(0, Math.max(-86, event.clientX - startX)))
  }

  function onPointerUp() {
    if (isFlying) return
    if (offsetX < -54) onSwipeLeft()
    if (offsetX > -8) onEdit()
    setStartX(0)
    setOffsetX(0)
  }

  return (
    <article
      className={`idea-card connect-card ${flyDirection ? `flying-${flyDirection}` : ''}`}
      draggable
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ ...style, transform: `translateX(${offsetX}px)` }}
    >
      <p>{idea.text}</p>
    </article>
  )
}

function StickyLabel({
  sticky,
  onDragStart,
  onDragEnd,
}: {
  sticky: Sticky
  onDragStart: (item: DragItem) => void
  onDragEnd: () => void
}) {
  return (
    <div
      className="sticky-label"
      draggable
      onDragEnd={onDragEnd}
      onDragStart={() => onDragStart({ kind: 'sticky', id: sticky.id })}
      style={{ background: sticky.color }}
    >
      {sticky.title}
    </div>
  )
}

export default App
