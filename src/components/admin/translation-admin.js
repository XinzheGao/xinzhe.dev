'use client'

import {
  ADMIN_CATEGORIES,
  getAdminCategory,
  taskCategoryLabel,
  translationPreviewPath
} from '@/lib/translation-admin/categories.mjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Languages,
  UnlockKeyhole
} from 'lucide-react'

const button =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800'
const input =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:ring-zinc-800'
const kinds = Object.fromEntries(ADMIN_CATEGORIES.map(({ id, label }) => [id, label]))
const labels = {
  missing: '未翻译',
  queued: '等待中',
  running: '翻译中',
  succeeded: '已完成',
  outdated: '原文已更新',
  failed: '失败',
  locked: '已锁定',
  'needs-review': '待人工复核',
  completed: '已结束',
  in_progress: '执行中',
  success: '成功',
  failure: '失败',
  cancelled: '已取消',
  skipped: '已跳过',
  waiting: '等待中',
  pending: '等待中'
}
const date = (value) =>
  value
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(value))
    : '—'
function Status({ state }) {
  const color = ['succeeded', 'success'].includes(state)
    ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300'
    : ['failed', 'failure', 'needs-review'].includes(state)
      ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
      : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300'
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs whitespace-nowrap ${color}`}>
      {labels[state] || state}
    </span>
  )
}
async function request(path, body, method) {
  const response = await fetch(path, {
    method: method || (body ? 'POST' : 'GET'),
    cache: 'no-store',
    ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  })
  const result = await response.json()
  if (!response.ok) {
    const error = new Error(result.error || '请求失败，请稍后重试。')
    error.status = response.status
    throw error
  }
  return result
}

export function TranslationAdmin({ initialAuthenticated, configured }) {
  const [signedIn, setSignedIn] = useState(initialAuthenticated)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function login(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await request('/api/admin/session', { password })
      setPassword('')
      setSignedIn(true)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  async function logout() {
    try {
      await request('/api/admin/session', null, 'DELETE')
      setSignedIn(false)
    } catch (error) {
      setError(error.message)
    }
  }
  return (
    <section
      lang="zh-CN"
      className="h-dvh w-full min-w-0 overflow-y-auto px-5 py-8 text-gray-900 md:px-8 lg:px-10 dark:text-zinc-100"
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex items-start justify-between gap-4 border-b pb-6">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs text-gray-500">
              <Languages size={14} />
              内容管理
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">翻译管理</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">维护中文原文，检查与管理英文、日文译文。</p>
          </div>
          {signedIn && (
            <button className={button} onClick={logout}>
              <LogOut size={14} />
              退出
            </button>
          )}
        </header>
        {!signedIn ? (
          <form onSubmit={login} className="mx-auto mt-16 max-w-sm rounded-xl border p-6">
            <LockKeyhole className="mb-4 text-gray-400" size={20} />
            <h2 className="mb-2 font-medium">登录管理后台</h2>
            <p className="mb-5 text-sm leading-6 text-gray-500">使用专用管理口令登录。翻译 API 密钥无需在这里填写。</p>
            {!configured && (
              <p role="status" className="mb-4 text-sm text-amber-700">
                尚未配置管理口令，请在服务器设置 TRANSLATION_ADMIN_PASSWORD（至少 24 位随机字符）。
              </p>
            )}
            <label htmlFor="admin-password" className="mb-2 block text-sm">
              管理口令
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              maxLength={512}
              className={input}
            />
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              disabled={busy || !configured}
              className={`${button} mt-4 w-full bg-gray-900 text-white hover:bg-gray-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300`}
            >
              {busy ? '正在登录…' : '登录'}
            </button>
          </form>
        ) : (
          <Dashboard onSessionExpired={() => setSignedIn(false)} />
        )}
      </div>
    </section>
  )
}

function Dashboard({ onSessionExpired }) {
  const [categoryId, setCategoryId] = useState('home')
  const kind = getAdminCategory(categoryId).kind
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState('')
  const [editor, setEditor] = useState(null)
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState({})
  const editorRef = useRef(null)
  const kindRef = useRef(categoryId)
  const refresh = useCallback(async () => {
    const current = categoryId
    try {
      const result = await request(`/api/admin/translations?category=${current}`)
      if (kindRef.current === current) {
        setData(result)
        setError('')
      }
    } catch (error) {
      if (error.status === 401) onSessionExpired()
      else setError(error.message)
    } finally {
      if (kindRef.current === current) setLoading(false)
    }
  }, [categoryId, onSessionExpired])
  useEffect(() => {
    kindRef.current = categoryId
    const initial = setTimeout(refresh, 0)
    const timer = setInterval(() => {
      if (!document.hidden) refresh()
    }, 10000)
    return () => {
      clearTimeout(initial)
      clearInterval(timer)
    }
  }, [refresh, categoryId])
  const canTranslate = data?.config?.configured && (data.config.mode === 'github' || data.worker?.online)
  async function translate(slug, locale) {
    const key = `${slug}:${locale}`
    setPending(key)
    setNotice('')
    setError('')
    try {
      const result = await request('/api/admin/translations', { action: 'translate', kind, slug, locale })
      setNotice(result.duplicate ? '任务已在队列中，无需重复提交。' : '翻译任务已提交，完成后会自动更新状态。')
      await refresh()
    } catch (error) {
      if (error.status === 401) onSessionExpired()
      else setError(error.message)
    } finally {
      setPending('')
    }
  }
  async function openEditor(slug, locale) {
    setPending(`${slug}:${locale}`)
    setError('')
    try {
      const result = await request(`/api/admin/translations?kind=${kind}&slug=${slug}&locale=${locale}`)
      setEditor({ ...result, kind, slug, locale })
      setDrafts({})
      requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (error) {
      setError(error.message)
    } finally {
      setPending('')
    }
  }
  async function reloadEditor() {
    setPending('reload')
    setError('')
    try {
      const updated = await request(
        `/api/admin/translations?kind=${editor.kind}&slug=${editor.slug}&locale=${editor.locale}`
      )
      setEditor({ ...updated, kind: editor.kind, slug: editor.slug, locale: editor.locale })
      setNotice('已读取最新对照，未保存草稿已保留。请核对后再保存。')
    } catch (error) {
      setError(error.message)
    } finally {
      setPending('')
    }
  }
  async function save(action, extra = {}) {
    setPending(extra.segment || 'review')
    setError('')
    setNotice('')
    try {
      const result = await request('/api/admin/translations', {
        action,
        kind: editor.kind,
        slug: editor.slug,
        locale: editor.locale,
        revision: editor.revision,
        sourceHash: editor.source.sourceHash,
        ...extra
      })
      const updated = await request(
        `/api/admin/translations?kind=${editor.kind}&slug=${editor.slug}&locale=${editor.locale}`
      )
      setEditor({ ...updated, kind: editor.kind, slug: editor.slug, locale: editor.locale })
      if (action === 'edit')
        setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== extra.segment)))
      setNotice(
        result.deployment === 'local'
          ? '已保存，本地页面已更新。'
          : result.deployment === 'requested'
            ? '已写回仓库并提交部署，线上页面将在部署成功后更新。'
            : result.deployment === 'failed'
              ? '已写回仓库，但部署触发失败，请检查部署连接。'
              : '已写回仓库；尚未配置部署连接，线上页面仍需重新部署。'
      )
      await refresh()
    } catch (error) {
      if (error.status === 401) onSessionExpired()
      else setError(error.message)
    } finally {
      setPending('')
    }
  }
  const documents = (data?.documents || []).filter((item) =>
    `${item.title} ${item.slug} ${item.date || ''}`.toLowerCase().includes(query.toLowerCase())
  )
  const completed = (data?.documents || []).reduce(
    (sum, item) => sum + Object.values(item.locales).filter((record) => record.published).length,
    0
  )
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <p>
          {data?.config?.mode === 'local'
            ? `本机模式 · 工作进程${data.worker?.online ? '在线' : '离线'}`
            : 'GitHub Actions 模式'}
          <span className="mx-2">·</span>
          {data?.documents?.length || 0} {kind === 'journey' ? '条记录' : '篇内容'}
          <span className="mx-2">·</span>
          {completed} 份译文
        </p>
        <button
          className={button}
          onClick={() => {
            setLoading(true)
            refresh()
          }}
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          刷新状态
        </button>
      </div>
      {data?.setupRequired && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-amber-200 p-4 text-sm leading-6 dark:border-amber-900"
        >
          线上管理尚未连接。请配置 TRANSLATION_GITHUB_TOKEN、TRANSLATION_GITHUB_REPOSITORY 和
          TRANSLATION_GITHUB_BRANCH。配置方法见项目的管理后台说明。
        </div>
      )}
      {data?.config?.mode === 'local' && !data.worker?.online && (
        <div role="status" className="mb-5 rounded-lg border p-4 text-sm leading-6 text-gray-600 dark:text-zinc-400">
          翻译工作进程未运行。请在项目终端执行{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-zinc-800">npm run translate:worker</code>
          ；已保存的译文仍可查看和修订。
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-red-200 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-5 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
          <Check size={16} className="mt-0.5 shrink-0" />
          {notice}
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 dark:bg-zinc-900" aria-label="内容类型">
          {Object.entries(kinds).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={categoryId === value}
              disabled={Boolean(pending) || Object.keys(drafts).length > 0}
              onClick={() => {
                if (value === categoryId) return
                setCategoryId(value)
                setLoading(true)
                setData(null)
                setEditor(null)
                setNotice('')
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${categoryId === value ? 'bg-white font-medium shadow-xs dark:bg-zinc-800' : 'text-gray-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label="搜索标题或链接名"
          placeholder="搜索标题或链接名…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${input} max-w-xs`}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs text-gray-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">中文原文</th>
              <th className="px-4 py-3 font-medium">英文</th>
              <th className="px-4 py-3 font-medium">日文</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((item) => (
              <tr key={item.slug} className="border-b last:border-0">
                <td className="max-w-xs px-4 py-5 align-top">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-xs break-all text-gray-400">{kind === 'journey' ? item.date : item.slug}</p>
                  <p className="mt-2 text-xs text-gray-500">原文更新 {date(item.updatedAt)}</p>
                </td>
                {['en', 'ja'].map((locale) => {
                  const record = item.locales[locale]
                  const working = ['queued', 'running'].includes(record.state)
                  return (
                    <td key={locale} className="px-4 py-5 align-top">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Status state={record.state} />
                        {record.segmentLocks > 0 && (
                          <span className="text-xs text-gray-400">{record.segmentLocks} 段锁定</span>
                        )}
                      </div>
                      <p className="mb-3 text-xs text-gray-400">
                        {record.generatedAt ? `生成于 ${date(record.generatedAt)}` : '尚未生成'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={button}
                          disabled={!canTranslate || working || Boolean(pending) || record.locked}
                          onClick={() => translate(item.slug, locale)}
                        >
                          {pending === `${item.slug}:${locale}`
                            ? '处理中…'
                            : record.state === 'failed'
                              ? '重试'
                              : record.published
                                ? '检查更新'
                                : '生成译文'}
                        </button>
                        <button
                          className={button}
                          disabled={Boolean(pending) || Object.keys(drafts).length > 0}
                          onClick={() => openEditor(item.slug, locale)}
                        >
                          对照{record.published ? '与修订' : '原文'}
                        </button>
                      </div>
                      {record.error && (
                        <p className="mt-2 max-w-xs text-xs leading-5 text-amber-700 dark:text-amber-300">
                          {record.error}
                        </p>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!documents.length && (
          <p className="p-8 text-center text-sm text-gray-500">
            {loading
              ? '正在读取内容…'
              : query
                ? '没有匹配的内容。'
                : data?.setupRequired
                  ? '连接后台后即可查看内容。'
                  : '这里还没有已发布的中文内容。'}
          </p>
        )}
      </div>
      {editor && (
        <section ref={editorRef} aria-label="原文与译文对照" className="mt-8 scroll-mt-5 rounded-xl border p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500">{editor.locale === 'en' ? '英文' : '日文'}对照与修订</p>
              <h2 className="mt-2 text-lg font-medium">{editor.source.title}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={Boolean(pending)} className={button} onClick={reloadEditor}>
                重新载入对照
              </button>
              {editor.published && (
                <button
                  disabled={Boolean(pending)}
                  className={button}
                  onClick={() => save('lock', { locked: !editor.locked })}
                >
                  {editor.locked ? <UnlockKeyhole size={13} /> : <LockKeyhole size={13} />}
                  {editor.locked ? '解锁整篇' : '锁定整篇'}
                </button>
              )}
              <button
                disabled={Boolean(pending)}
                className={button}
                onClick={() => {
                  setEditor(null)
                  setDrafts({})
                }}
              >
                {Object.keys(drafts).length ? '放弃未保存修改并关闭' : '关闭对照'}
              </button>
            </div>
          </div>
          <p className="mb-5 text-xs leading-6 text-gray-500">
            修订按段保存并自动锁定。模型不会覆盖人工修订；解锁后可重新检查更新。代码和链接目标需要保留。
          </p>
          {editor.sourceChanged && (
            <p role="status" className="mb-5 text-sm text-amber-700 dark:text-amber-300">
              原文已更新。请先生成新版本，再修订译文；当前仍保留上一份完整译文。
            </p>
          )}
          {!editor.published && (
            <p className="mb-5 text-sm text-gray-500">译文尚未生成。你可以先查看中文原文，再在列表中提交翻译。</p>
          )}
          <div className="mb-3 hidden grid-cols-2 gap-6 text-xs font-medium text-gray-500 md:grid">
            <span>中文原文</span>
            <span>{editor.locale === 'en' ? '英文译文' : '日文译文'}</span>
          </div>
          <div className="space-y-5">
            {editor.segments.map((segment, index) => (
              <SegmentEditor
                key={`${editor.slug}:${editor.locale}:${segment.key}`}
                texts={drafts[segment.key] || segment.texts}
                onChange={(texts) =>
                  setDrafts((current) => {
                    const next = { ...current }
                    if (JSON.stringify(texts) === JSON.stringify(segment.texts)) delete next[segment.key]
                    else next[segment.key] = texts
                    return next
                  })
                }
                segment={segment}
                kind={editor.kind}
                index={index}
                disabled={Boolean(pending) || editor.sourceChanged || editor.locked}
                onSave={(texts) => save('edit', { segment: segment.key, texts })}
                onLock={() => save('segment-lock', { segment: segment.key, locked: !segment.locked })}
              />
            ))}
          </div>
          {editor.published && (
            <a
              className={`${button} mt-5`}
              target="_blank"
              rel="noopener noreferrer"
              href={translationPreviewPath(editor.kind, editor.slug, editor.locale)}
            >
              打开译文页面
              <ArrowUpRight size={13} />
            </a>
          )}
        </section>
      )}
      <details className="mt-8 rounded-xl border p-4" open>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
          <ChevronDown size={15} />
          最近任务
        </summary>
        <p className="mt-2 text-xs leading-6 text-gray-500">
          任务由后台独立执行。页面每 10 秒刷新状态，关闭页面不会中断翻译。
        </p>
        <ul className="mt-3 divide-y">
          {(data?.tasks || []).map((task) => (
            <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
              <div className="min-w-0">
                <p className="break-all">
                  {task.title ||
                    `${taskCategoryLabel(task)} / ${task.slug} / ${task.locale === 'en' ? '英文' : '日文'}`}
                </p>
                <p className="mt-1 text-gray-400">
                  {date(task.createdAt)}
                  {task.error && ` · ${task.error}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Status state={task.state} />
                {task.url && (
                  <a href={task.url} target="_blank" rel="noopener noreferrer" className={button}>
                    查看执行日志
                    <ArrowUpRight size={12} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!data?.tasks?.length && <p className="mt-4 text-xs text-gray-400">暂无通过管理界面提交的任务。</p>}
        {data?.errors?.length > 0 && (
          <div className="mt-5 border-t pt-4">
            <h3 className="mb-2 text-xs font-medium">最近错误</h3>
            {data.errors.map((item, index) => (
              <p
                key={`${item.key}:${item.at}:${index}`}
                className="mb-2 text-xs break-words text-amber-700 dark:text-amber-300"
              >
                {date(item.at)} · {item.key} · {item.message}
              </p>
            ))}
          </div>
        )}
      </details>
    </>
  )
}
function SegmentEditor({ segment, kind, index, texts, onChange, disabled, onSave, onLock }) {
  const changed = JSON.stringify(texts) !== JSON.stringify(segment.texts)
  const label =
    {
      title: '标题',
      seoTitle: 'SEO 标题',
      description: kind === 'journey' ? '简述' : '摘要',
      defaultDescription: '全站描述',
      imageDescription: '图片说明'
    }[segment.key] || `正文段落 ${index + 1}`
  return (
    <div className="border-t pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">{label}</span>
        {segment.locked && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <LockKeyhole size={12} />
            人工锁定
          </span>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm leading-7 whitespace-pre-wrap dark:bg-zinc-900">
          {segment.original.length ? (
            segment.original.map((text, index) => (
              <p key={index} lang="zh-CN">
                {text}
              </p>
            ))
          ) : (
            <p className="text-gray-400">该段落已从原文移除。</p>
          )}
        </div>
        <div>
          {texts.length ? (
            <>
              <div className="space-y-2">
                {texts.map((text, index) => (
                  <textarea
                    key={index}
                    aria-label={`${label}译文 ${index + 1}`}
                    value={text}
                    disabled={disabled}
                    onChange={(event) => onChange(texts.map((item, n) => (n === index ? event.target.value : item)))}
                    rows={Math.min(8, Math.max(2, Math.ceil(text.length / 50)))}
                    className={`${input} resize-y leading-7`}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className={button}
                  disabled={disabled || !changed || texts.some((text) => !text.trim())}
                  onClick={() => onSave(texts)}
                >
                  保存并锁定此段
                </button>
                <button className={button} disabled={disabled} onClick={onLock}>
                  {segment.locked ? '解锁此段' : '锁定此段'}
                </button>
              </div>
            </>
          ) : (
            <p className="py-3 text-sm text-gray-400">尚无译文</p>
          )}
        </div>
      </div>
    </div>
  )
}
