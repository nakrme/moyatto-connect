import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChangeEvent,
  FormEvent,
  PointerEvent,
  ReactNode,
  RefObject,
} from 'react'
import {
  AiOutlineCamera,
  AiOutlineDelete,
  AiOutlinePicture,
} from 'react-icons/ai'
import './App.css'

type Tab = 'idea' | 'connect'

type Idea = {
  id: string
  text: string
  imageUrl?: string
  important: boolean
  groupId?: string
  createdAt: number
}

type ConnectMove = 'before' | 'after' | 'dock'

const STORAGE_KEY = 'moyatto-connect-v1'

function savedData() {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved ? JSON.parse(saved) : null
}

function blockIdsInOrder(
  order: string[],
  sourceId: string,
  ideaById: Map<string, Idea>,
) {
  const groupId = ideaById.get(sourceId)?.groupId
  if (!groupId) return [sourceId]

  return order.filter((id) => ideaById.get(id)?.groupId === groupId)
}

function App() {
  const [tab, setTab] = useState<Tab>('idea')
  const [appTitle, setAppTitle] = useState(() => savedData()?.appTitle ?? 'タイトル')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(appTitle)
  const [ideas, setIdeas] = useState<Idea[]>(() => {
    const saved = savedData()
    return saved?.ideas ?? []
  })
  const [connectOrder, setConnectOrder] = useState<string[]>(() => {
    const saved = savedData()
    return saved?.connectOrder ?? []
  })
  const [trashedIdeas, setTrashedIdeas] = useState<Idea[]>(() => {
    const saved = savedData()
    return saved?.trashedIdeas ?? []
  })
  const [draft, setDraft] = useState('')
  const [addingIdea, setAddingIdea] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [editingImageUrl, setEditingImageUrl] = useState('')
  const [reorderingIdeaId, setReorderingIdeaId] = useState<string | null>(null)
  const [reorderingBlockIds, setReorderingBlockIds] = useState<string[]>([])
  const [dragOffsetY, setDragOffsetY] = useState(0)
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
      JSON.stringify({ appTitle, connectOrder, ideas, trashedIdeas }),
    )
  }, [appTitle, connectOrder, ideas, trashedIdeas])

  useEffect(() => {
    if (ideas.some((idea) => idea.important)) return
    if (connectOrder.length === 0) return

    setConnectOrder([])
  }, [connectOrder.length, ideas])

  const importantIdeas = useMemo(() => {
    const currentIdeas = ideas.filter((idea) => idea.important)
    const currentIds = currentIdeas.map((idea) => idea.id)
    const ideaById = new Map(currentIdeas.map((idea) => [idea.id, idea]))

    return connectOrder
      .filter((id) => currentIds.includes(id))
      .concat(currentIds.filter((id) => !connectOrder.includes(id)))
      .map((id) => ideaById.get(id))
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

  function closeEditor() {
    setEditingIdeaId(null)
    setEditingDraft('')
    setEditingImageUrl('')
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
    closeEditor()
  }

  function deleteIdea(id: string) {
    const idea = ideas.find((currentIdea) => currentIdea.id === id)
    if (idea) {
      setTrashedIdeas((current) => [
        { ...idea, groupId: undefined, important: false },
        ...current.filter((currentIdea) => currentIdea.id !== id),
      ])
    }
    setIdeas((current) => current.filter((idea) => idea.id !== id))
    setConnectOrder((current) => current.filter((currentId) => currentId !== id))
    if (editingIdeaId === id) {
      setEditingIdeaId(null)
      setEditingDraft('')
      setEditingImageUrl('')
    }
  }

  function restoreIdea(id: string) {
    const idea = trashedIdeas.find((currentIdea) => currentIdea.id === id)
    if (!idea) return

    setIdeas((current) => [
      ...current,
      { ...idea, groupId: undefined, important: false },
    ])
    setTrashedIdeas((current) =>
      current.filter((currentIdea) => currentIdea.id !== id),
    )
  }

  function deleteTrashedIdea(id: string) {
    setTrashedIdeas((current) =>
      current.filter((currentIdea) => currentIdea.id !== id),
    )
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
            ? { ...currentIdea, important: false, groupId: undefined }
            : currentIdea,
        ),
      )
      setConnectOrder((current) => current.filter((currentId) => currentId !== id))
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
    position: ConnectMove,
  ) {
    if (sourceId === targetId) return

    const connectIds = importantIdeas.map((idea) => idea.id)
    const ideaById = new Map(ideas.map((idea) => [idea.id, idea]))
    const sourceBlock = blockIdsInOrder(connectIds, sourceId, ideaById)
    const targetBlock = blockIdsInOrder(connectIds, targetId, ideaById)
    if (sourceBlock.some((id) => targetBlock.includes(id))) return

    if (position === 'dock') {
      const sourceIdea = ideaById.get(sourceId)
      const targetIdea = ideaById.get(targetId)
      const groupId =
        targetIdea?.groupId ?? sourceIdea?.groupId ?? crypto.randomUUID()
      const groupedIds = new Set([...sourceBlock, ...targetBlock])

      setIdeas((current) =>
        current.map((idea) =>
          groupedIds.has(idea.id) ? { ...idea, groupId } : idea,
        ),
      )
    }

    setConnectOrder((current) => {
      const currentIds = current
        .filter((id) => connectIds.includes(id))
        .concat(connectIds.filter((id) => !current.includes(id)))
      const next = currentIds.filter((id) => !sourceBlock.includes(id))
      const targetIds =
        position === 'dock'
          ? targetBlock
          : blockIdsInOrder(next, targetId, ideaById)
      const targetIndex = next.indexOf(
        position === 'after' || position === 'dock'
          ? targetIds[targetIds.length - 1]
          : targetIds[0],
      )
      if (targetIndex === -1) return current
      next.splice(
        position === 'before' ? targetIndex : targetIndex + 1,
        0,
        ...sourceBlock,
      )
      return next
    })
  }

  function startReorder(id: string) {
    const ideaById = new Map(ideas.map((idea) => [idea.id, idea]))
    setReorderingIdeaId(id)
    setReorderingBlockIds(
      blockIdsInOrder(
        importantIdeas.map((idea) => idea.id),
        id,
        ideaById,
      ),
    )
  }

  function stopReorder() {
    setReorderingIdeaId(null)
    setReorderingBlockIds([])
    setDragOffsetY(0)
  }

  function splitGroupBefore(id: string) {
    const orderedIds = importantIdeas.map((idea) => idea.id)
    const ideaById = new Map(ideas.map((idea) => [idea.id, idea]))
    const groupId = ideaById.get(id)?.groupId
    if (!groupId) return

    const groupIds = orderedIds.filter(
      (currentId) => ideaById.get(currentId)?.groupId === groupId,
    )
    const splitIndex = groupIds.indexOf(id)
    if (splitIndex <= 0) return

    const beforeIds = new Set(groupIds.slice(0, splitIndex))
    const afterIds = new Set(groupIds.slice(splitIndex))
    const nextGroupId = afterIds.size > 1 ? crypto.randomUUID() : undefined

    setIdeas((current) =>
      current.map((idea) => {
        if (beforeIds.has(idea.id)) {
          return beforeIds.size > 1 ? idea : { ...idea, groupId: undefined }
        }
        if (afterIds.has(idea.id)) {
          return { ...idea, groupId: nextGroupId }
        }
        return idea
      }),
    )
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
          <div className="title-area">
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
          </div>
          <button
            aria-label="ゴミ箱"
            className="trash-button"
            onClick={() => setTrashOpen((open) => !open)}
            type="button"
          >
            <AiOutlineDelete />
          </button>
        </header>

        {trashOpen ? (
          <TrashPanel
            ideas={trashedIdeas}
            onClose={() => setTrashOpen(false)}
            onDelete={deleteTrashedIdea}
            onRestore={restoreIdea}
          />
        ) : null}

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
              ideas={importantIdeas}
              dragOffsetY={dragOffsetY}
              onEditIdea={startEditIdea}
              onDragReorder={setDragOffsetY}
              onMoveIdea={moveConnectIdea}
              onReturnIdea={toggleImportant}
              onSplitGroupBefore={splitGroupBefore}
              onStartReorder={startReorder}
              onStopReorder={stopReorder}
              reorderingBlockIds={reorderingBlockIds}
              reorderingIdeaId={reorderingIdeaId}
            />
          )}
        </div>

        {addingIdea ? (
          <IdeaComposer
            cameraInputRef={cameraInputRef}
            imageUrl={draftImageUrl}
            keyboardInset={keyboardInset}
            onChangeImage={handleImageChange}
            onChangeText={setDraft}
            onClose={() => setAddingIdea(false)}
            onSubmit={addIdea}
            pictureInputRef={pictureInputRef}
            text={draft}
          />
        ) : null}

        {editingIdeaId ? (
          <IdeaComposer
            cameraInputRef={cameraInputRef}
            imageUrl={editingImageUrl}
            keyboardInset={keyboardInset}
            onChangeImage={handleImageChange}
            onChangeText={setEditingDraft}
            onClose={closeEditor}
            onSubmit={saveIdea}
            pictureInputRef={pictureInputRef}
            text={editingDraft}
          />
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

function IdeaComposer({
  cameraInputRef,
  imageUrl,
  keyboardInset,
  onChangeImage,
  onChangeText,
  onClose,
  onSubmit,
  pictureInputRef,
  text,
}: {
  cameraInputRef: RefObject<HTMLInputElement | null>
  imageUrl: string
  keyboardInset: number
  onChangeImage: (event: ChangeEvent<HTMLInputElement>) => void
  onChangeText: (text: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
  pictureInputRef: RefObject<HTMLInputElement | null>
  text: string
}) {
  return (
    <form className="idea-composer-screen" onSubmit={onSubmit}>
      <div className="idea-composer-top">
        <button
          aria-label="閉じる"
          className="composer-close"
          type="button"
          onClick={onClose}
        />
        <button className="composer-ok" type="submit">
          OK
        </button>
      </div>
      <div className="idea-composer-body">
        <textarea
          autoFocus
          value={text}
          onChange={(event) => onChangeText(event.target.value)}
          placeholder="思いついたことをなんでも書いてみよう"
        />
        {imageUrl ? (
          <div className="composer-image-preview">
            <img src={imageUrl} alt="" />
          </div>
        ) : null}
      </div>
      <input
        accept="image/*"
        capture="environment"
        className="visually-hidden-file"
        onChange={onChangeImage}
        ref={cameraInputRef}
        type="file"
      />
      <input
        accept="image/*"
        className="visually-hidden-file"
        onChange={onChangeImage}
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
  )
}

function TrashPanel({
  ideas,
  onClose,
  onDelete,
  onRestore,
}: {
  ideas: Idea[]
  onClose: () => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
}) {
  return (
    <section className="trash-panel" aria-label="ゴミ箱">
      <div className="trash-panel-head">
        <p>ゴミ箱</p>
        <button onClick={onClose} type="button">
          閉じる
        </button>
      </div>
      {ideas.length === 0 ? (
        <p className="trash-empty">削除したアイディアはありません</p>
      ) : (
        <div className="trash-list">
          {ideas.map((idea) => (
            <article className="trash-item" key={idea.id}>
              <p>{idea.text}</p>
              <IdeaImage idea={idea} />
              <div className="trash-actions">
                <button onClick={() => onRestore(idea.id)} type="button">
                  戻す
                </button>
                <button
                  className="trash-delete"
                  onClick={() => onDelete(idea.id)}
                  type="button"
                >
                  削除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
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
        <IdeaCard
          idea={idea}
          key={idea.id}
          onSwipeLeft={() => onDeleteIdea(idea.id)}
          onSwipeRight={() => onToggleImportant(idea.id)}
          onTap={() => onEditIdea(idea)}
        />
      ))}
    </div>
  )
}

function IdeaCard({
  children,
  className = '',
  connectIdeaId,
  idea,
  offsetY = 0,
  onSwipeLeft,
  onSwipeRight,
  onTap,
}: {
  children?: ReactNode
  className?: string
  connectIdeaId?: string
  idea: Idea
  offsetY?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onTap: () => void
}) {
  const startPoint = useRef({ x: 0, y: 0 })

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    startPoint.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const diffX = event.clientX - startPoint.current.x
    const diffY = event.clientY - startPoint.current.y
    const absX = Math.abs(diffX)
    const absY = Math.abs(diffY)

    if (absX > 64 && absX > absY * 1.2) {
      if (diffX > 0) onSwipeRight?.()
      else onSwipeLeft?.()
      return
    }

    if (absX < 8 && absY < 8) onTap()
  }

  return (
    <article
      className={`idea-card ${className}`}
      data-connect-idea-id={connectIdeaId}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ transform: `translateY(${offsetY}px)` }}
    >
      <p>{idea.text}</p>
      <IdeaImage idea={idea} />
      {children}
    </article>
  )
}

function IdeaImage({ idea }: { idea: Idea }) {
  if (idea.imageUrl) {
    return <img className="idea-card-image" src={idea.imageUrl} alt="" />
  }

  return null
}

function ConnectTab({
  dragOffsetY,
  ideas,
  onDragReorder,
  onEditIdea,
  onMoveIdea,
  onReturnIdea,
  onSplitGroupBefore,
  onStartReorder,
  onStopReorder,
  reorderingBlockIds,
  reorderingIdeaId,
}: {
  dragOffsetY: number
  ideas: Idea[]
  onDragReorder: (offsetY: number) => void
  onEditIdea: (idea: Idea) => void
  onMoveIdea: (sourceId: string, targetId: string, position: ConnectMove) => void
  onReturnIdea: (id: string) => void
  onSplitGroupBefore: (id: string) => void
  onStartReorder: (id: string) => void
  onStopReorder: () => void
  reorderingBlockIds: string[]
  reorderingIdeaId: string | null
}) {
  const reorderingIndexes = reorderingBlockIds
    .map((id) => ideas.findIndex((idea) => idea.id === id))
    .filter((index) => index >= 0)
  const firstReorderingIndex =
    reorderingIndexes.length > 0 ? Math.min(...reorderingIndexes) : -1
  const lastReorderingIndex =
    reorderingIndexes.length > 0 ? Math.max(...reorderingIndexes) : -1
  const adjacentDockIdeas = [
    ideas[firstReorderingIndex - 1],
    ideas[lastReorderingIndex + 1],
  ].filter(Boolean) as Idea[]
  const adjacentDockIds = adjacentDockIdeas.flatMap((adjacentIdea) => {
    if (!adjacentIdea.groupId) return [adjacentIdea.id]
    return ideas
      .filter((idea) => idea.groupId === adjacentIdea.groupId)
      .map((idea) => idea.id)
  })

  return (
    <div className="connect-list">
      {ideas.map((idea, index) => {
        const previousIdea = ideas[index - 1]
        const nextIdea = ideas[index + 1]
        const hasPreviousGroup =
          idea.groupId && previousIdea?.groupId === idea.groupId
        const hasNextGroup = idea.groupId && nextIdea?.groupId === idea.groupId
        const groupClass = hasPreviousGroup
          ? hasNextGroup
            ? 'group-middle'
            : 'group-end'
          : hasNextGroup
            ? 'group-start'
            : ''

        return (
          <ConnectSwipeCard
            adjacentDockIds={adjacentDockIds}
            canSplitBefore={Boolean(hasPreviousGroup)}
            groupClass={groupClass}
            idea={idea}
            isReordering={reorderingBlockIds.includes(idea.id)}
            key={idea.id}
            offsetY={reorderingBlockIds.includes(idea.id) ? dragOffsetY : 0}
            onDragReorder={onDragReorder}
            onEdit={() => onEditIdea(idea)}
            onMoveIdea={onMoveIdea}
            onSplitBefore={() => onSplitGroupBefore(idea.id)}
            onSwipeLeft={() => onReturnIdea(idea.id)}
            onStartReorder={() => onStartReorder(idea.id)}
            onStopReorder={onStopReorder}
            reorderingBlockIds={reorderingBlockIds}
            reorderingIdeaId={reorderingIdeaId}
          />
        )
      })}
    </div>
  )
}

function ConnectSwipeCard({
  adjacentDockIds,
  canSplitBefore,
  groupClass,
  idea,
  isReordering,
  offsetY,
  onDragReorder,
  onEdit,
  onMoveIdea,
  onSplitBefore,
  onSwipeLeft,
  onStartReorder,
  onStopReorder,
  reorderingBlockIds,
  reorderingIdeaId,
}: {
  adjacentDockIds: string[]
  canSplitBefore: boolean
  groupClass: string | false | undefined
  idea: Idea
  isReordering: boolean
  offsetY: number
  onDragReorder: (offsetY: number) => void
  onEdit: () => void
  onMoveIdea: (sourceId: string, targetId: string, position: ConnectMove) => void
  onSplitBefore: () => void
  onSwipeLeft: () => void
  onStartReorder: () => void
  onStopReorder: () => void
  reorderingBlockIds: string[]
  reorderingIdeaId: string | null
}) {
  const dragStartY = useRef(0)
  const isDragging = useRef(false)
  const isDragHandleActive = reorderingIdeaId === idea.id

  function onHandlePointerDown(event: PointerEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    isDragging.current = true
    dragStartY.current = event.clientY
    onDragReorder(0)
    onStartReorder()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onHandlePointerMove(event: PointerEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!isDragging.current) return
    onDragReorder(event.clientY - dragStartY.current)
  }

  function onHandlePointerUp(event: PointerEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!isDragging.current) return

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('[data-connect-idea-id]'),
    ).filter((card) => {
      const id = card.dataset.connectIdeaId
      return id && !reorderingBlockIds.includes(id)
    })
    const draggedCards = reorderingBlockIds
      .map((id) =>
        document.querySelector<HTMLElement>(`[data-connect-idea-id="${id}"]`),
      )
      .filter(Boolean) as HTMLElement[]
    const draggedBounds = draggedCards.reduce(
      (bounds, card) => {
        const rect = card.getBoundingClientRect()
        return {
          bottom: Math.max(bounds.bottom, rect.bottom),
          top: Math.min(bounds.top, rect.top),
        }
      },
      { bottom: -Infinity, top: Infinity },
    )
    const draggedCenterY =
      draggedCards.length > 0
        ? (draggedBounds.top + draggedBounds.bottom) / 2
        : event.clientY
    const dockCard = cards
      .filter((card) => {
        const id = card.dataset.connectIdeaId
        return id ? adjacentDockIds.includes(id) : false
      })
      .map((card) => {
        const rect = card.getBoundingClientRect()
        const overlap =
          Math.min(draggedBounds.bottom, rect.bottom) -
          Math.max(draggedBounds.top, rect.top)
        return { card, overlap }
      })
      .filter(({ overlap }) => overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)[0]

    if (dockCard?.card.dataset.connectIdeaId) {
      onMoveIdea(idea.id, dockCard.card.dataset.connectIdeaId, 'dock')
    } else {
      const beforeCard = cards.find((card) => {
        const rect = card.getBoundingClientRect()
        return draggedCenterY < rect.top + rect.height / 2
      })
      const targetCard = beforeCard ?? cards.at(-1)
      const targetId = targetCard?.dataset.connectIdeaId

      if (targetId) {
        onMoveIdea(idea.id, targetId, beforeCard ? 'before' : 'after')
      }
    }

    isDragging.current = false
    onStopReorder()
    dragStartY.current = 0
    onDragReorder(0)
  }

  function onHandlePointerCancel(event: PointerEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    isDragging.current = false
    onStopReorder()
    dragStartY.current = 0
    onDragReorder(0)
  }

  return (
    <IdeaCard
      className={`connect-card ${groupClass || ''} ${
        isReordering ? 'reordering' : ''
      }`}
      connectIdeaId={idea.id}
      idea={idea}
      offsetY={offsetY}
      onSwipeLeft={onSwipeLeft}
      onTap={onEdit}
    >
      {canSplitBefore ? (
        <button
          aria-label="ここで切り離す"
          className="dock-split"
          onClick={(event) => {
            event.stopPropagation()
            onSplitBefore()
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          type="button"
        />
      ) : null}
      <button
        aria-label="並び替え"
        className={`drag-handle ${isDragHandleActive ? 'active' : ''}`}
        onPointerCancel={onHandlePointerCancel}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        type="button"
      >
        <span />
      </button>
    </IdeaCard>
  )
}

export default App
