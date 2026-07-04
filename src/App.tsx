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

type Heading = {
  id: string
  title: string
  color: string
  afterIdeaId: string | null
}

const STORAGE_KEY = 'moyatto-connect-v1'
const headingColors = [
  '#000002',
  '#ba3264',
  '#f31059',
  '#9faca2',
  '#89db3b',
  '#209bfc',
  '#e4b1b4',
  '#cfd72d',
  '#9bf3ae',
  '#fff332',
]

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
  const [reorderingIdeaId, setReorderingIdeaId] = useState<string | null>(null)
  const [headingTarget, setHeadingTarget] = useState<string | null | undefined>()
  const [headingTitle, setHeadingTitle] = useState('')
  const [headingColor, setHeadingColor] = useState(headingColors[0])
  const [draftImageUrl, setDraftImageUrl] = useState('')
  const [headings, setHeadings] = useState<Heading[]>(() => {
    const saved = savedData()
    return saved?.headings ?? []
  })
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
      JSON.stringify({ appTitle, ideas, connectOrder, headings }),
    )
  }, [appTitle, ideas, connectOrder, headings])

  useEffect(() => {
    if (ideas.some((idea) => idea.important)) return
    if (connectOrder.length === 0 && headings.length === 0) return

    setConnectOrder([])
    setHeadings([])
  }, [connectOrder.length, headings.length, ideas])

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

  const orderedHeadings = useMemo(() => {
    const ideaPosition = new Map(
      importantIdeas.map((idea, index) => [idea.id, index]),
    )

    return [...headings].sort((a, b) => {
      const aPosition =
        a.afterIdeaId === null ? -1 : ideaPosition.get(a.afterIdeaId) ?? 999
      const bPosition =
        b.afterIdeaId === null ? -1 : ideaPosition.get(b.afterIdeaId) ?? 999
      return aPosition - bPosition
    })
  }, [headings, importantIdeas])

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
    setHeadings((current) =>
      current.filter((heading) => heading.afterIdeaId !== id),
    )
    if (editingIdeaId === id) {
      setEditingIdeaId(null)
      setEditingDraft('')
      setEditingImageUrl('')
    }
  }

  function toggleImportant(id: string) {
    const idea = ideas.find((currentIdea) => currentIdea.id === id)
    if (idea && !idea.important) {
      setIdeas((current) =>
        current.map((currentIdea) =>
          currentIdea.id === id ? { ...currentIdea, important: true } : currentIdea,
        ),
      )
      setConnectOrder((current) =>
        current.includes(id) ? current : [...current, id],
      )
      return
    }

    if (idea?.important) {
      setIdeas((current) =>
        current.map((currentIdea) =>
          currentIdea.id === id
            ? { ...currentIdea, important: false }
            : currentIdea,
        ),
      )
      setConnectOrder((current) => current.filter((currentId) => currentId !== id))
      setHeadings((current) =>
        current.filter((heading) => heading.afterIdeaId !== id),
      )
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

  function headingForIdea(ideaId: string) {
    const ideaIndex = importantIdeas.findIndex((idea) => idea.id === ideaId)
    if (ideaIndex === -1) return undefined

    return orderedHeadings
      .filter((heading) => {
        if (heading.afterIdeaId === null) return true
        const headingIndex = importantIdeas.findIndex(
          (idea) => idea.id === heading.afterIdeaId,
        )
        return headingIndex < ideaIndex
      })
      .at(-1)
  }

  function addHeading(event: FormEvent) {
    event.preventDefault()
    const title = headingTitle.trim()
    if (!title) return

    const afterIdeaId = headingTarget ?? null
    if (headings.some((heading) => heading.afterIdeaId === afterIdeaId)) {
      setHeadingTarget(undefined)
      setHeadingTitle('')
      setHeadingColor(headingColors[0])
      return
    }

    setHeadings((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title,
        color: headingColor,
        afterIdeaId,
      },
    ])
    setHeadingTarget(undefined)
    setHeadingTitle('')
    setHeadingColor(headingColors[0])
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
              ideas={ideas.filter((idea) => !idea.important)}
              onDeleteIdea={deleteIdea}
              onEditIdea={startEditIdea}
              onToggleImportant={toggleImportant}
            />
          ) : (
            <ConnectTab
              headingForIdea={headingForIdea}
              headings={orderedHeadings}
              ideas={importantIdeas}
              onEditIdea={startEditIdea}
              onMoveIdea={moveConnectIdea}
              onOpenHeading={(afterIdeaId) => setHeadingTarget(afterIdeaId)}
              onReturnIdea={toggleImportant}
              onStartReorder={setReorderingIdeaId}
              onStopReorder={() => setReorderingIdeaId(null)}
              reorderingIdeaId={reorderingIdeaId}
            />
          )}
        </div>

        {headingTarget !== undefined ? (
          <form className="heading-composer" onSubmit={addHeading}>
            <input
              autoFocus
              onChange={(event) => setHeadingTitle(event.target.value)}
              placeholder="見出し"
              value={headingTitle}
            />
            <div className="heading-color-row" aria-label="見出しの色">
              {headingColors.map((color) => (
                <button
                  aria-label={`見出し色 ${color}`}
                  className={headingColor === color ? 'selected' : ''}
                  key={color}
                  onClick={() => setHeadingColor(color)}
                  style={{ background: color }}
                  type="button"
                />
              ))}
            </div>
            <div className="heading-actions">
              <button
                onClick={() => {
                  setHeadingTarget(undefined)
                  setHeadingTitle('')
                  setHeadingColor(headingColors[0])
                }}
                type="button"
              >
                閉じる
              </button>
              <button type="submit">追加</button>
            </div>
          </form>
        ) : null}

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
  ideas,
  onDeleteIdea,
  onEditIdea,
  onToggleImportant,
}: {
  ideas: Idea[]
  onDeleteIdea: (id: string) => void
  onEditIdea: (idea: Idea) => void
  onToggleImportant: (id: string) => void
}) {
  return (
    <div className="idea-list">
      {ideas.map((idea) => (
        <SwipeCard
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
  idea,
  onDelete,
  onEdit,
  onSwipe,
}: {
  idea: Idea
  onDelete: () => void
  onEdit: () => void
  onSwipe: () => void
}) {
  const [startX, setStartX] = useState(0)
  const [offsetX, setOffsetX] = useState(0)

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    setStartX(event.clientX)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!startX) return
    setOffsetX(Math.max(-86, Math.min(86, event.clientX - startX)))
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const finalOffsetX = Math.max(-86, Math.min(86, event.clientX - startX))
    if (finalOffsetX > 54) onSwipe()
    else if (finalOffsetX < -54) onDelete()
    else if (Math.abs(finalOffsetX) < 8) onEdit()
    setStartX(0)
    setOffsetX(0)
  }

  return (
    <article
      className={`idea-card ${idea.important ? 'important' : ''}`}
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
  headingForIdea,
  headings,
  ideas,
  onEditIdea,
  onMoveIdea,
  onOpenHeading,
  onReturnIdea,
  onStartReorder,
  onStopReorder,
  reorderingIdeaId,
}: {
  headingForIdea: (id: string) => Heading | undefined
  headings: Heading[]
  ideas: Idea[]
  onEditIdea: (idea: Idea) => void
  onMoveIdea: (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after',
  ) => void
  onOpenHeading: (afterIdeaId: string | null) => void
  onReturnIdea: (id: string) => void
  onStartReorder: (id: string) => void
  onStopReorder: () => void
  reorderingIdeaId: string | null
}) {
  const headingByGap = new Map(
    headings.map((heading) => [heading.afterIdeaId, heading]),
  )

  return (
    <div className="connect-list">
      {ideas.map((idea, index) => {
        const gapId = index === 0 ? null : ideas[index - 1].id
        const heading = headingByGap.get(gapId)
        const activeHeading = headingForIdea(idea.id)

        return (
          <div className="connect-block" key={idea.id}>
            {heading ? (
              <div
                className="heading-label"
                style={{ background: heading.color }}
              >
                {heading.title}
              </div>
            ) : (
              <button
                aria-label="見出しを追加"
                className="insert-heading-button"
                onClick={() => onOpenHeading(gapId)}
                type="button"
              >
                +
              </button>
            )}
            <ConnectSwipeCard
              barColor={activeHeading?.color ?? '#000002'}
              idea={idea}
              onEdit={() => onEditIdea(idea)}
              onMoveIdea={onMoveIdea}
              onSwipeLeft={() => onReturnIdea(idea.id)}
              onStartReorder={() => onStartReorder(idea.id)}
              onStopReorder={onStopReorder}
              reorderingIdeaId={reorderingIdeaId}
            />
          </div>
        )
      })}
    </div>
  )
}

function ConnectSwipeCard({
  barColor,
  idea,
  onEdit,
  onMoveIdea,
  onSwipeLeft,
  onStartReorder,
  onStopReorder,
  reorderingIdeaId,
}: {
  barColor: string
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
  const isThisReordering = reorderingIdeaId === idea.id

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    setStartX(event.clientX)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!startX) return
    setOffsetX(Math.min(0, Math.max(-86, event.clientX - startX)))
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const finalOffsetX = Math.min(0, Math.max(-86, event.clientX - startX))
    if (finalOffsetX < -54) onSwipeLeft()
    if (finalOffsetX > -8) onEdit()
    setStartX(0)
    setOffsetX(0)
  }

  function onHandlePointerDown(event: PointerEvent<HTMLElement>) {
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
      className={`idea-card connect-card ${isThisReordering ? 'reordering' : ''}`}
      data-connect-idea-id={idea.id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
    >
      <span
        aria-hidden="true"
        className="connect-color-bar"
        style={{ background: barColor }}
      />
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
