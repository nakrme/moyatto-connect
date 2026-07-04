import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, FormEvent, PointerEvent } from 'react'
import { AiOutlineCamera, AiOutlinePicture } from 'react-icons/ai'
import './App.css'

type Tab = 'idea' | 'connect'

type Idea = {
  id: string
  text: string
  image?: boolean
  imageUrl?: string
  important: boolean
  createdAt: number
}

type Sticky = {
  id: string
  title: string
  color: string
  afterIdeaId: string | null
}

type FlyingIdea = {
  id: string
  direction: 'to-connect' | 'to-idea'
} | null

const STORAGE_KEY = 'moyatto-connect-v1'

const colors = [
  { name: 'black', value: '#000002' },
  { name: 'plum', value: '#ba3264' },
  { name: 'hot pink', value: '#f31059' },
  { name: 'sage', value: '#9faca2' },
  { name: 'lime', value: '#89db3b' },
  { name: 'blue', value: '#209bfc' },
  { name: 'pale pink', value: '#e4b1b4' },
  { name: 'olive', value: '#cfd72d' },
  { name: 'mint', value: '#9bf3ae' },
  { name: 'yellow', value: '#fff332' },
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
  const [flyingIdea, setFlyingIdea] = useState<FlyingIdea>(null)
  const [reorderingIdeaId, setReorderingIdeaId] = useState<string | null>(null)
  const [draftImageUrl, setDraftImageUrl] = useState('')
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const pictureInputRef = useRef<HTMLInputElement>(null)

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
    if (!text && !draftImageUrl) return

    const id = crypto.randomUUID()
    const important = tab === 'connect'
    setIdeas((current) => [
      ...current,
      {
        id,
        text,
        imageUrl: draftImageUrl || undefined,
        important,
        createdAt: Date.now(),
      },
    ])
    if (important) {
      setConnectOrder((current) => [...current, id])
    }
    setDraft('')
    setDraftImageUrl('')
    setAddingIdea(false)
  }

  function handleDraftImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraftImageUrl(reader.result)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
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
      const ideaIndex = importantIdeas.findIndex((importantIdea) => importantIdea.id === id)
      const activeSticky = orderedStickies
        .filter((sticky) => {
          if (sticky.afterIdeaId === null) return true
          const stickyIndex = importantIdeas.findIndex(
            (importantIdea) => importantIdea.id === sticky.afterIdeaId,
          )
          return stickyIndex < ideaIndex
        })
        .at(-1)

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
          current.filter(
            (sticky) =>
              sticky.afterIdeaId !== id && sticky.id !== activeSticky?.id,
          ),
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
    const ideaIndex = importantIdeas.findIndex((importantIdea) => importantIdea.id === ideaId)
    if (ideaIndex === -1) return undefined

    return orderedStickies
      .filter((sticky) => {
        if (sticky.afterIdeaId === null) return true
        const stickyIndex = importantIdeas.findIndex(
          (importantIdea) => importantIdea.id === sticky.afterIdeaId,
        )
        return stickyIndex < ideaIndex
      })
      .at(-1)
  }

  function moveConnectIdea(sourceId: string, targetId: string) {
    if (sourceId === targetId) return

    const sourceSticky = stickyForIdea(sourceId)
    const destinationSticky = stickyForIdea(targetId)

    setConnectOrder((current) => {
      const next = current.filter((id) => id !== sourceId)
      const targetIndex = next.indexOf(targetId)
      if (targetIndex === -1) return current
      next.splice(targetIndex, 0, sourceId)
      return next
    })

    if (sourceSticky && sourceSticky.id !== destinationSticky?.id) {
      setStickies((current) =>
        current.filter((sticky) => sticky.id !== sourceSticky.id),
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
              onEditIdea={startEditIdea}
              onMoveIdea={moveConnectIdea}
              onOpenSticky={(afterIdeaId) => setStickyTarget(afterIdeaId)}
              onReturnIdea={toggleImportant}
              onStartReorder={setReorderingIdeaId}
              onStopReorder={() => setReorderingIdeaId(null)}
              reorderingIdeaId={reorderingIdeaId}
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
              placeholder="思いついたことをなんでも書いてみよう"
            />
            {draftImageUrl ? (
              <div className="composer-image-preview">
                <img src={draftImageUrl} alt="" />
              </div>
            ) : null}
            <input
              accept="image/*"
              capture="environment"
              className="visually-hidden-file"
              onChange={handleDraftImageChange}
              ref={cameraInputRef}
              type="file"
            />
            <input
              accept="image/*"
              className="visually-hidden-file"
              onChange={handleDraftImageChange}
              ref={pictureInputRef}
              type="file"
            />
            <div className="composer-tool-row" aria-label="画像追加">
              <button
                aria-label="カメラ"
                onClick={() => cameraInputRef.current?.click()}
                type="button"
              >
                <AiOutlineCamera />
              </button>
              <button
                aria-label="写真"
                onClick={() => pictureInputRef.current?.click()}
                type="button"
              >
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

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (isFlying) return
    const finalOffsetX = Math.max(0, Math.min(86, event.clientX - startX))
    if (finalOffsetX > 54) onSwipe()
    if (finalOffsetX < 8) onEdit()
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
      <IdeaImage idea={idea} />
    </article>
  )
}

function IdeaImage({ idea }: { idea: Idea }) {
  if (idea.imageUrl) {
    return <img className="idea-card-image" src={idea.imageUrl} alt="" />
  }

  if (idea.image) {
    return <div className="image-placeholder" />
  }

  return null
}

function ConnectTab({
  flyingIdea,
  ideas,
  stickies,
  colorForIdea,
  onEditIdea,
  onMoveIdea,
  onOpenSticky,
  onReturnIdea,
  onStartReorder,
  onStopReorder,
  reorderingIdeaId,
}: {
  flyingIdea: FlyingIdea
  ideas: Idea[]
  stickies: Sticky[]
  colorForIdea: (id: string) => string
  onEditIdea: (idea: Idea) => void
  onMoveIdea: (sourceId: string, targetId: string) => void
  onOpenSticky: (afterIdeaId: string | null) => void
  onReturnIdea: (id: string) => void
  onStartReorder: (id: string) => void
  onStopReorder: () => void
  reorderingIdeaId: string | null
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
              <StickyLabel sticky={stickyBeforeIdea} />
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
              onEdit={() => onEditIdea(idea)}
              onMoveIdea={onMoveIdea}
              onSwipeLeft={() => onReturnIdea(idea.id)}
              onStartReorder={() => onStartReorder(idea.id)}
              onStopReorder={onStopReorder}
              reorderingIdeaId={reorderingIdeaId}
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
  onEdit,
  onMoveIdea,
  onSwipeLeft,
  onStartReorder,
  onStopReorder,
  reorderingIdeaId,
  style,
}: {
  flyDirection?: 'to-connect' | 'to-idea'
  idea: Idea
  onEdit: () => void
  onMoveIdea: (sourceId: string, targetId: string) => void
  onSwipeLeft: () => void
  onStartReorder: () => void
  onStopReorder: () => void
  reorderingIdeaId: string | null
  style: CSSProperties
}) {
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const longPressTimer = useRef<number | undefined>(undefined)
  const isReordering = useRef(false)
  const isFlying = Boolean(flyDirection)
  const isThisReordering = reorderingIdeaId === idea.id

  function clearLongPressTimer() {
    if (!longPressTimer.current) return
    window.clearTimeout(longPressTimer.current)
    longPressTimer.current = undefined
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (isFlying) return
    setStartX(event.clientX)
    setStartY(event.clientY)
    isReordering.current = false
    longPressTimer.current = window.setTimeout(() => {
      isReordering.current = true
      setOffsetX(0)
      setOffsetY(0)
      onStartReorder()
    }, 420)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (isFlying) return
    if (!startX) return
    const deltaX = event.clientX - startX
    const deltaY = event.clientY - startY

    if (isReordering.current) {
      setOffsetY(deltaY)
      return
    }

    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      clearLongPressTimer()
    }
    if (Math.abs(deltaY) > Math.abs(deltaX)) return

    setOffsetX(Math.min(0, Math.max(-86, deltaX)))
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (isFlying) return
    clearLongPressTimer()

    if (isReordering.current) {
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest('[data-connect-idea-id]')
      const targetId = target?.getAttribute('data-connect-idea-id')

      if (targetId) {
        onMoveIdea(idea.id, targetId)
      }
      isReordering.current = false
      onStopReorder()
      setStartX(0)
      setStartY(0)
      setOffsetX(0)
      setOffsetY(0)
      return
    }

    const finalOffsetX = Math.min(0, Math.max(-86, event.clientX - startX))
    if (finalOffsetX < -54) onSwipeLeft()
    if (finalOffsetX > -8) onEdit()
    setStartX(0)
    setStartY(0)
    setOffsetX(0)
  }

  return (
    <article
      className={`idea-card connect-card ${flyDirection ? `flying-${flyDirection}` : ''} ${isThisReordering ? 'reordering' : ''}`}
      data-connect-idea-id={idea.id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ ...style, transform: `translate(${offsetX}px, ${offsetY}px)` }}
    >
      <p>{idea.text}</p>
      <IdeaImage idea={idea} />
    </article>
  )
}

function StickyLabel({ sticky }: { sticky: Sticky }) {
  return (
    <div
      className="sticky-label"
      style={{ background: sticky.color }}
    >
      {sticky.title}
    </div>
  )
}

export default App
