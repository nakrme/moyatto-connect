import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, PointerEvent } from 'react'
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

type FlyingIdea = {
  id: string
  direction: 'to-connect' | 'to-idea'
} | null

const STORAGE_KEY = 'moyatto-connect-v1'

const starterIdeas: Idea[] = []

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
  const [draft, setDraft] = useState('')
  const [addingIdea, setAddingIdea] = useState(false)
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [editingImageUrl, setEditingImageUrl] = useState('')
  const [flyingIdea, setFlyingIdea] = useState<FlyingIdea>(null)
  const [reorderingIdeaId, setReorderingIdeaId] = useState<string | null>(null)
  const [draftImageUrl, setDraftImageUrl] = useState('')
  const [keyboardInset, setKeyboardInset] = useState(0)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const pictureInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if ((!addingIdea && !editingIdeaId) || !viewport) {
      setKeyboardInset(0)
      return
    }

    function updateInset() {
      const inset = window.innerHeight - viewport!.height - viewport!.offsetTop
      setKeyboardInset(Math.max(0, Math.round(inset)))
    }

    updateInset()
    viewport.addEventListener('resize', updateInset)
    viewport.addEventListener('scroll', updateInset)
    return () => {
      viewport.removeEventListener('resize', updateInset)
      viewport.removeEventListener('scroll', updateInset)
    }
  }, [addingIdea, editingIdeaId])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ appTitle, ideas, connectOrder }),
    )
  }, [appTitle, ideas, connectOrder])

  useEffect(() => {
    if (ideas.some((idea) => idea.important)) return
    if (connectOrder.length === 0) return

    setConnectOrder([])
  }, [connectOrder.length, ideas])

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

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      if (editingIdeaId) {
        setEditingImageUrl(reader.result)
      } else {
        setDraftImageUrl(reader.result)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function startEditIdea(idea: Idea) {
    setAddingIdea(false)
    setEditingIdeaId(idea.id)
    setEditingDraft(idea.text)
    setEditingImageUrl(idea.imageUrl ?? '')
  }

  function saveIdea(event: FormEvent) {
    event.preventDefault()
    const text = editingDraft.trim()
    if ((!text && !editingImageUrl) || !editingIdeaId) return

    setIdeas((current) =>
      current.map((idea) =>
        idea.id === editingIdeaId
          ? { ...idea, text, imageUrl: editingImageUrl || undefined }
          : idea,
      ),
    )
    setEditingIdeaId(null)
    setEditingDraft('')
    setEditingImageUrl('')
  }

  function deleteIdea(id: string) {
    setIdeas((current) => current.filter((idea) => idea.id !== id))
    setConnectOrder((current) => current.filter((currentId) => currentId !== id))
    if (editingIdeaId === id) {
      setEditingIdeaId(null)
      setEditingDraft('')
      setEditingImageUrl('')
    }
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

  function moveConnectIdea(
    sourceId: string,
    targetId: string,
    position: 'before' | 'after',
  ) {
    if (sourceId === targetId) return

    setConnectOrder((current) => {
      const next = current.filter((id) => id !== sourceId)
      const targetIndex = next.indexOf(targetId)
      if (targetIndex === -1) return current
      next.splice(position === 'before' ? targetIndex : targetIndex + 1, 0, sourceId)
      return next
    })
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
              onDeleteIdea={deleteIdea}
              onEditIdea={startEditIdea}
              onToggleImportant={toggleImportant}
            />
          ) : (
            <ConnectTab
              ideas={importantIdeas}
              onEditIdea={startEditIdea}
              onMoveIdea={moveConnectIdea}
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
            <div className="idea-composer-body">
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
            </div>
            <input
              accept="image/*"
              capture="environment"
              className="visually-hidden-file"
              onChange={handleImageChange}
              ref={cameraInputRef}
              type="file"
            />
            <input
              accept="image/*"
              className="visually-hidden-file"
              onChange={handleImageChange}
              ref={pictureInputRef}
              type="file"
            />
            <div
              aria-label="画像追加"
              className="composer-tool-row"
              style={{ bottom: keyboardInset }}
            >
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
          <form className="idea-composer-screen" onSubmit={saveIdea}>
            <div className="idea-composer-top">
              <button
                aria-label="閉じる"
                className="composer-close"
                type="button"
                onClick={() => {
                  setEditingIdeaId(null)
                  setEditingDraft('')
                  setEditingImageUrl('')
                }}
              />
              <button className="composer-ok" type="submit">
                OK
              </button>
            </div>
            <div className="idea-composer-body">
              <textarea
                autoFocus
                value={editingDraft}
                onChange={(event) => setEditingDraft(event.target.value)}
                placeholder="思いついたことをなんでも書いてみよう"
              />
              {editingImageUrl ? (
                <div className="composer-image-preview">
                  <img src={editingImageUrl} alt="" />
                </div>
              ) : null}
            </div>
            <input
              accept="image/*"
              capture="environment"
              className="visually-hidden-file"
              onChange={handleImageChange}
              ref={cameraInputRef}
              type="file"
            />
            <input
              accept="image/*"
              className="visually-hidden-file"
              onChange={handleImageChange}
              ref={pictureInputRef}
              type="file"
            />
            <div
              aria-label="画像追加"
              className="composer-tool-row"
              style={{ bottom: keyboardInset }}
            >
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
  onDeleteIdea,
  onEditIdea,
  onToggleImportant,
}: {
  flyingIdea: FlyingIdea
  ideas: Idea[]
  onDeleteIdea: (id: string) => void
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
          onDelete={() => onDeleteIdea(idea.id)}
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
  onDelete,
  onEdit,
  onSwipe,
}: {
  flyDirection?: 'to-connect' | 'to-idea'
  idea: Idea
  onDelete: () => void
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
    setOffsetX(Math.max(-86, Math.min(86, event.clientX - startX)))
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (isFlying) return
    const finalOffsetX = Math.max(-86, Math.min(86, event.clientX - startX))
    if (finalOffsetX > 54) onSwipe()
    else if (finalOffsetX < -54) onDelete()
    else if (Math.abs(finalOffsetX) < 8) onEdit()
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
  onEditIdea,
  onMoveIdea,
  onReturnIdea,
  onStartReorder,
  onStopReorder,
  reorderingIdeaId,
}: {
  flyingIdea: FlyingIdea
  ideas: Idea[]
  onEditIdea: (idea: Idea) => void
  onMoveIdea: (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after',
  ) => void
  onReturnIdea: (id: string) => void
  onStartReorder: (id: string) => void
  onStopReorder: () => void
  reorderingIdeaId: string | null
}) {
  return (
    <div className="connect-list">
      {ideas.map((idea) => (
        <ConnectSwipeCard
          flyDirection={
            flyingIdea?.id === idea.id ? flyingIdea.direction : undefined
          }
          idea={idea}
          key={idea.id}
          onEdit={() => onEditIdea(idea)}
          onMoveIdea={onMoveIdea}
          onSwipeLeft={() => onReturnIdea(idea.id)}
          onStartReorder={() => onStartReorder(idea.id)}
          onStopReorder={onStopReorder}
          reorderingIdeaId={reorderingIdeaId}
        />
      ))}
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
}: {
  flyDirection?: 'to-connect' | 'to-idea'
  idea: Idea
  onEdit: () => void
  onMoveIdea: (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after',
  ) => void
  onSwipeLeft: () => void
  onStartReorder: () => void
  onStopReorder: () => void
  reorderingIdeaId: string | null
}) {
  const [startX, setStartX] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [dragStartY, setDragStartY] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const isDragging = useRef(false)
  const isFlying = Boolean(flyDirection)
  const isThisReordering = reorderingIdeaId === idea.id

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

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (isFlying) return
    const finalOffsetX = Math.min(0, Math.max(-86, event.clientX - startX))
    if (finalOffsetX < -54) onSwipeLeft()
    if (finalOffsetX > -8) onEdit()
    setStartX(0)
    setOffsetX(0)
  }

  function onHandlePointerDown(event: PointerEvent<HTMLElement>) {
    if (isFlying) return
    event.stopPropagation()
    isDragging.current = true
    setDragStartY(event.clientY)
    setOffsetY(0)
    onStartReorder()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onHandlePointerMove(event: PointerEvent<HTMLElement>) {
    event.stopPropagation()
    if (!isDragging.current) return
    setOffsetY(event.clientY - dragStartY)
  }

  function onHandlePointerUp(event: PointerEvent<HTMLElement>) {
    event.stopPropagation()
    if (!isDragging.current) return

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('[data-connect-idea-id]'),
    ).filter((card) => card.dataset.connectIdeaId !== idea.id)
    const beforeCard = cards.find((card) => {
      const rect = card.getBoundingClientRect()
      return event.clientY < rect.top + rect.height / 2
    })
    const targetCard = beforeCard ?? cards.at(-1)
    const targetId = targetCard?.dataset.connectIdeaId

    if (targetId) {
      onMoveIdea(idea.id, targetId, beforeCard ? 'before' : 'after')
    }
    isDragging.current = false
    onStopReorder()
    setDragStartY(0)
    setOffsetY(0)
  }

  function onHandlePointerCancel(event: PointerEvent<HTMLElement>) {
    event.stopPropagation()
    isDragging.current = false
    onStopReorder()
    setDragStartY(0)
    setOffsetY(0)
  }

  return (
    <article
      className={`idea-card connect-card ${flyDirection ? `flying-${flyDirection}` : ''} ${isThisReordering ? 'reordering' : ''}`}
      data-connect-idea-id={idea.id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
    >
      <p>{idea.text}</p>
      <IdeaImage idea={idea} />
      <button
        aria-label="並び替え"
        className="drag-handle"
        onPointerCancel={onHandlePointerCancel}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        type="button"
      >
        <span />
      </button>
    </article>
  )
}

export default App
