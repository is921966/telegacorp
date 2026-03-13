# Telegram Corp v0.6.0

Корпоративный Telegram-клиент с админ-панелью, политиками управления и Agent Factory.

> **Ревизия ТЗ v3.0 vs Реализация — Rev 4** | 13.03.2026

---

## Общий прогресс

| Метрика | Значение |
|---------|----------|
| Общий прогресс | **~85%** |
| Фазы завершены | **7 / 11** |
| API Routes | **49** (admin: 43, service: 4, corporate: 2) |
| Zustand Stores | **12** |
| SQL миграции | **6** |
| Admin Pages | **19** |
| Hooks | **14** |
| Components | **73** |
| Исходный код | **227 файлов**, ~35 500 строк (TypeScript/TSX) |

### Изменения Rev 3 → Rev 4 (11.03 → 13.03.2026)

- **Фаза 2 ↑ 95% → 98%** — Workspace toggle для чатов (add/remove из рабочего пространства)
- **Фаза 4 ↑ 90% → 95%** — Archive collect API, archive-state toggle, client-side сбор
- **Фаза 6 ↑ 90% → 100%** — Fullscreen Telegram-style chat, document download, native OS preview
- **Общий прогресс ↑ 82% → 85%**
- Fullscreen archive overlay — Telegram-style с message bubbles, day separators, sender colors (8 цветов)
- Document cards с blue download icons, progress %, filename, filesize
- Скачивание через `downloadDocumentFile()` из media-cache (IndexedDB + memory кэш)
- Открытие всех типов файлов в native OS preview (Quick Look на macOS)
- 5 новых API endpoints: archive/collect, archive-state, workspace, register-chat
- ChatTable.tsx: 128 → 900 строк (полная реализация Telegram-style archive)
- 15 файлов изменено, +1 185 строк

### Изменения Rev 2 → Rev 3 (06.03 → 11.03.2026)

- **Фаза 5 ↑ 90% → 95%** — Workspace Time Tracking (live таймеры, Supabase sync)
- **Аналитика сотрудников** — Employee directory, Stats dashboard (16 карточек, 13 запросов)
- Новые миграции: `005_work_companies.sql`, `006_workspace_time.sql`
- Таблица `telegram_users`, photo URL persistence
- Admin sidebar redesign

### Изменения Rev 1 → Rev 2 (06.03.2026)

- **Фаза 5 ↑ 60% → 90%** — WorkspaceSwitcher, Shield иконка, teal accent, папки по workspace
- **Клиент ↑ 95% → 98%** — Forum topics (inline + mobile), realtime message updates
- Новые компоненты: TopicListItem, TopicsList, WorkspaceSwitcher
- Новые хуки: useForumTopics, useRealtimeUpdates (расширен)

---

## Сводная таблица по фазам

| Фаза | Название | % | Статус | Rev 3→4 |
|------|----------|---|--------|---------|
| 1 | Инфраструктура (БД, типы, RBAC, API скелеты) | **92%** | ✅ Завершена | — |
| 2 | Управление чатами (Service + API + UI) | **98%** | ✅ Завершена | **↑ +3%** |
| 3 | Политики и шаблоны (drift detection) | **95%** | ✅ Завершена | — |
| 4 | Аудит + cron + архив сбора | **95%** | ✅ Завершена | **↑ +5%** |
| 5 | Корпоративное пространство + Time Tracking | **95%** | ✅ Завершена | — |
| 6 | Архив переписок (Fullscreen UI) | **100%** | ✅ Завершена | **↑ +10%** |
| — | Аналитика сотрудников | **95%** | ✅ Завершена | — |
| 7 | Message Stream + Redis (VPS) | **30%** | ⚠️ API есть, VPS нет | — |
| 8 | Conversation Intelligence (Python) | **0%** | ❌ Не начата | — |
| 9 | OpenClaw Gateway + MCP | **0%** | ❌ Не начата | — |
| 10 | Agent Design Engine + Sandbox | **10%** | ❌ UI-скелеты | — |
| 11 | Governance Portal + Canary + Self-improvement | **40%** | ⚠️ UI есть, логика нет | — |
| | **Клиентская часть** | **99%** | ✅ Готово | — |

---

## Фаза 1: Инфраструктура — 92%

БД, типы, серверный Supabase, GramJS-клиенты, RBAC middleware, API скелеты, admin layout

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| Миграция `002_admin_panel.sql` (8 таблиц) | ✅ Готово | policy_templates, chat_templates, admin_audit_log, chat_event_log, chat_archive_state |
| Миграция `003_agent_factory.sql` (6 таблиц) | ✅ Готово | automation_patterns, agents, agent_metrics, agent_feedback, agent_audit_log, monitored_chats |
| Миграция `004_corporate_seed.sql` | ✅ Готово | Дефолтный шаблон политик + привязка TSUM corp, UNICORN SPACE |
| Миграция `005_work_companies.sql` | ✅ Готово | Таблица work_companies (telegram_id, company, email, domain) |
| Миграция `006_workspace_time.sql` | ✅ Готово | Таблица workspace_time (personal_seconds, work_seconds) |
| Таблица `telegram_users` | ✅ Готово | Справочник пользователей, auto-populated on login |
| `src/types/admin.ts` | ✅ Готово | AdminRole, PolicyConfig, ChatBannedRights, +archiveEnabled, +driftDetails |
| `src/types/agents.ts` | ✅ Готово | Agent, AgentStatus, AutomationPattern, AgentMetrics, AgentFeedback |
| `src/types/telegram.ts` | ✅ Готово | +TelegramForumTopic, +ForwardInfo, +WebPagePreview, +TelegramReaction |
| `src/types/database.ts` | ✅ Готово | Supabase auto-generated types (Row/Insert/Update) |
| Supabase server/middleware, GramJS client, RBAC | ✅ Готово | Всё работает |
| Admin Layout + Dashboard | ✅ Готово | EmployeeStats, mobile-responsive |
| `ADMIN_BOT_TOKEN` env var | ⚠️ Не проверено | Бот создан, токен нужен в Vercel |

---

## Фаза 2: Управление чатами — 98%

ChatManagementService + API routes + Admin UI + workspace toggle + archive toggle

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| `ChatManagementService` + все API endpoints (9) | ✅ Готово | chats, details, participants, admins, ban, invite, event-log, workspace, archive-state |
| UI: ChatTable (900 строк) 🔥 | ✅ Готово | Fullscreen archive overlay, Telegram-style, document download |
| UI: ChatDetails, Members, Settings, Events | ✅ Готово | Все подстраницы работают |
| Workspace toggle (add/remove) 🆕 | ✅ Готово | PUT/DELETE /api/admin/chats/[chatId]/workspace |
| Archive toggle (enable/disable) 🆕 | ✅ Готово | PATCH /api/admin/chats/[chatId]/archive-state |
| Drift badge + inline details | ✅ Готово | Drift/OK badge, expandable drift details |

---

## Фаза 3: Политики и шаблоны — 95%

TemplateService + drift detection + UI шаблонов

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| `TemplateService` + CRUD API + apply + drift | ✅ Готово | Полный цикл |
| Cron: check-drift | ✅ Готово | Эндпоинт готов |
| UI: Templates list + create + edit | ✅ Готово | Mobile-responsive |

---

## Фаза 4: Аудит и мониторинг + Архив — 95%

AuditService + cron jobs + UI аудита + cron сбора + client-side collection

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| `AuditService` + API + export + crons | ✅ Готово | Всё работает |
| UI: Audit page | ✅ Готово | Mobile-responsive |
| Archive collect API 🆕 | ✅ Готово | POST /api/admin/archive/collect — batch save из user session |
| Client-side collection fallback 🆕 | ✅ Готово | GramJS getMessages → server archive при пустом архиве |
| Cron schedule в vercel.json | ❌ Нет | Требует Vercel Pro. Эндпоинты работают, нет автовызова |

---

## Фаза 5: Корпоративное пространство — 95%

Corporate config API + useCorporateStore + переключатель пространств + workspace time tracking

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| Corporate Config API + useCorporateStore | ✅ Готово | /api/corporate/config, Zustand store |
| WorkspaceSwitcher + live timers | ✅ Готово | Live таймеры (Xч Yм Zс), тикают каждую секунду |
| Фильтрация диалогов + папок по workspace | ✅ Готово | Эксклюзивная фильтрация, смешанные папки в обоих |
| Workspace Time Tracking | ✅ Готово | localStorage + 60с sync в Supabase + sendBeacon |
| Register Chat API 🆕 | ✅ Готово | POST /api/corporate/register-chat |
| Shield иконка + teal accent | ✅ Готово | CSS variables, OKLCh, teal selection/badges/sidebar |
| Блокировка пересылки (protected content) | ⚠️ Частично | isContentProtected() есть в store, не применяется в UI |

---

## Фаза 6: Архив переписок (UI) — 100% ✅

Fullscreen Telegram-style chat preview + document download + native OS preview

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| Страница `/admin/archive` + фильтры + export | ✅ Готово | Full-text search, CSV export, RBAC, auto-load chatId from URL |
| Fullscreen archive overlay 🆕 | ✅ Готово | Клик по чату → z-50 fixed overlay, dark Telegram theme (#0e1621) |
| Telegram-style message bubbles 🆕 | ✅ Готово | Colored sender names (8 цветов), grouped messages, bubble rounding |
| Day separators 🆕 | ✅ Готово | «Сегодня», «Вчера», «12 марта» — группировка по дням |
| Document cards 🆕 | ✅ Готово | Blue circle + ArrowDown icon, filename, filesize, progress % |
| Media cards (Photo/Video/Voice/Audio) 🆕 | ✅ Готово | Placeholder cards с иконками для каждого типа |
| Document download via media-cache 🆕 | ✅ Готово | `downloadDocumentFile()` — 2-tier cache (memory + IndexedDB), progress callback |
| Native OS preview 🆕 | ✅ Готово | `window.open(blobUrl)` — Quick Look (macOS) для PDF, xlsx, docx, images |
| Escape / ✕ close overlay 🆕 | ✅ Готово | Keyboard + button, body scroll lock |

---

## Аналитика сотрудников — 95%

Employee directory + stats dashboard + workspace analytics

| Функция | Статус | Комментарий |
|---------|--------|-------------|
| Employee Directory (`/admin/employees`) | ✅ Готово | Таблица с аватарами, компаниями, online-статусом |
| Employee Stats API + Dashboard (16 карточек) | ✅ Готово | 13 запросов, агрегированная статистика |
| Photo URL persistence | ✅ Готово | getMe() → photo_url в telegram_users |

---

## Фазы 7-11: Agent Factory (OpenClaw) — 40%

### Vercel-часть (UI + API) — реализовано:

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| API: agents CRUD + approve + metrics + feedback + audit | ✅ Готово | 10 route.ts |
| API: patterns CRUD + approve | ✅ Готово | 3 route.ts |
| API: monitoring toggle + governance | ✅ Готово | 5 route.ts |
| Service API: send, history, create, monitored | ✅ Готово | 4 route.ts (SERVICE_API_TOKEN) |
| UI: Governance + Agents + Settings | ✅ Готово | Mobile-responsive |
| UI: Agent sandbox / Patterns / Governance audit | ⚠️ Скелеты | Навигация есть, функционал базовый |

### VPS-часть — НЕ реализовано:

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| VPS: Message Stream Service (GramJS long-running) | ❌ Нет | Node.js + GramJS consumer не создан |
| VPS: Redis Streams (corp:messages) | ❌ Нет | Redis не развёрнут |
| VPS: Conversation Intelligence (Python) | ❌ Нет | Intent Classifier, Pattern Miner, Interaction Graph |
| VPS: Qdrant + OpenClaw Gateway + MCP-мост | ❌ Нет | Embeddings, Observer, Orchestrator, Specialists |
| Docker sandbox, inference, auto-detection, canary | ❌ Нет | Нет engine для запуска агентов |

---

## Клиентская часть (Telegram-мессенджер) — 99%

Не входит в ТЗ v3.0, но является основой приложения

| Функция | Статус | Комментарий |
|---------|--------|-------------|
| Авторизация (Phone + QR + 2FA) | ✅ Готово | QR как дефолт, session termination fix |
| Список чатов + real-time обновления | ✅ Готово | Live polling, new/edit/delete/read sync |
| Отправка / редактирование / ответы | ✅ Готово | Reply-to, edit, delete |
| Медиа: фото, видео, документы, голос, стикеры | ✅ Готово | IndexedDB кэш, FFmpeg, chunked upload |
| Контакты + Звонки + Поиск | ✅ Готово | Online-статус, avatars, full-text search |
| Папки Telegram + Forum Topics | ✅ Готово | Desktop sidebar + mobile tabs, emoji иконки |
| Workspace switching + live timers | ✅ Готово | Таймеры ежесекундно, sync в Supabase |
| PWA + offline + Multi-tab sync | ✅ Готово | Service Worker, leader election |
| Настройки (тема, шрифт, уведомления, язык) | ✅ Готово | Supabase user_settings |

### Zustand Stores (12 шт.)

| Store | Описание |
|-------|----------|
| `auth.ts` | Supabase + Telegram auth state |
| `chats.ts` | Dialogs: setDialogs, mergeDialogs, syncDialogs, bumpDialog, updateReadState |
| `messages.ts` | Per-chat messages (max 50/chat persist), addMessage, updateMessage, deleteMessages |
| `topics.ts` | Forum topics per chat: setTopics, updateTopicUnread, updateTopicLastMessage |
| `corporate.ts` | Workspace: switchWorkspace, loadConfig, isManagedChat, live timers |
| `folders.ts` | Telegram folder list, selectedFolder |
| `ui.ts` | selectTopic, expandForum, expandedForumChatId, selectedTopicId |
| `contacts.ts` | Contact list with persistence |
| `calls.ts` | Call records with persistence |
| `avatars.ts` | Avatar LRU cache (max 500) |
| `upload.ts` | Video upload queue + metrics |
| `sync.ts` | Multi-tab leader election |

### Hooks (14 шт.)

| Hook | Описание |
|------|----------|
| `useTelegramClient` | Telegram client init + connection state |
| `useDialogs` | Load/paginate dialogs with infinite scroll |
| `useMessages` | Load/paginate messages + reply context + topic support |
| `useForumTopics` | Fetch forum topics for a chat (with caching) |
| `useRealtimeUpdates` | Telegram polling: new messages, edits, deletes, read states |
| `useContacts` | Load contacts list |
| `useCalls` | Load call history |
| `useLazyAvatar` | IntersectionObserver-based lazy avatar loading |
| `useMediaDownload` | Download media from messages (photos, docs, etc.) |
| `useGlobalSearch` | Global message/chat search |
| `useViewUrlSync` | Sync view state ↔ URL hash |
| `useLeaderElection` | Multi-tab leader election via BroadcastChannel |
| `useAdminRole` | RBAC role check for admin pages |
| `useIsMobile` | Responsive breakpoint detection |

---

## Полный список API Routes (49)

| Группа | Кол-во | Routes |
|--------|--------|--------|
| Admin — Chats | 9 | chats, chats/[id], participants, admins, ban, invite, event-log, **workspace** 🆕, **archive-state** 🆕 |
| Admin — Templates | 4 | templates, templates/[id], apply, drift |
| Admin — Audit | 2 | audit, audit/export |
| Admin — Archive | 3 | archive, archive/export, **archive/collect** 🆕 |
| Admin — Cron | 3 | collect-messages, collect-events, check-drift |
| Admin — Agents | 6 | agents, agents/[id], approve, metrics, feedback, audit |
| Admin — Patterns | 3 | patterns, patterns/[id], approve |
| Admin — Monitoring | 2 | monitoring, monitoring/[chatId] |
| Admin — Governance | 3 | dashboard, budget, settings |
| Admin — Other | 6 | config, roles, roles/[userId], stats, stats/employees, employees |
| Service | 4 | send, history, monitored, create |
| Corporate | 2 | config, **register-chat** 🆕 |
| Other | 2 | workspace-time, bot-info |
| **Итого** | **49** | |

---

## Приоритетные задачи

### ⚡ Быстрые победы (следующие)

1. **Блокировка пересылки** — применить isContentProtected() в MessageItem (disable copy/forward)
2. **Photo/Video preview в архиве** — скачивание и показ фото/видео из архивных сообщений
3. **Vercel Cron** — перейти на Pro или использовать внешний scheduler
4. **ADMIN_BOT_TOKEN** — проверить токен в Vercel env vars
5. **Governance audit endpoint** — доделать dedicated endpoint

### 🚀 Следующие большие шаги

**Вариант A: Углубление Vercel-платформы**
1. Agent Sandbox — UI для тестирования агентов (Claude API)
2. Patterns full UI — полноценный CRUD для automation patterns
3. Dashboard графики — временные ряды, аналитика, экспорт

**Вариант B: VPS-инфраструктура (Agent Factory)**
1. VPS развёртывание — Docker Compose (Redis 7, Qdrant, Node.js)
2. Message Stream Service — GramJS long-running consumer → Redis Streams
3. Conversation Intelligence — Python микросервис
4. OpenClaw Gateway + MCP-мост

**Вариант C: UX/продуктовые улучшения**
1. Push-уведомления — Web Push API
2. Drag&Drop файлы — перетаскивание в чат
3. Реакции на сообщения — emoji reactions
4. Message scheduling — отложенные сообщения

---

## Технический стек

| Категория | Технологии |
|-----------|-----------|
| Frontend Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| State Management | Zustand 5 (12 stores) + persist middleware |
| Styling | Tailwind CSS 4 + shadcn/ui + OKLCh CSS variables |
| Telegram MTProto | gram.js (клиентские подключения) + GramJS (admin bot) |
| Backend / Auth | Supabase (PostgreSQL + Auth + RLS + Storage) |
| Validation | Zod 4 |
| Caching | IndexedDB (media), localStorage (stores), LRU (avatars, 500 items) |
| Video Processing | FFmpeg.wasm (browser-side transcoding) |
| Virtual List | @tanstack/react-virtual (chat list + messages) |
| PWA | Service Worker (sw.js) + Web App Manifest |
| Testing | Vitest + Testing Library + jsdom |
| Deployment | Vercel (serverless, edge middleware) |
| DB Migrations | 6 SQL файлов |
| Admin Pages | 19 страниц (responsive) |
| API Routes | 49 endpoints |

---

<sub>Telegram Corp v0.6.0 | Ревизия ТЗ v3.0 Rev 4 | 13.03.2026 | Claude Code</sub>
