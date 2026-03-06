# Telegram Corp v0.5.0

Корпоративный Telegram-клиент с админ-панелью, политиками управления и Agent Factory.

> **Ревизия ТЗ v3.0 vs Реализация — Rev 2** | 06.03.2026

---

## Общий прогресс

| Метрика | Значение |
|---------|----------|
| Общий прогресс | **~78%** |
| Фазы завершены | **5 / 11** |
| API Routes | **41** (admin: 36, service: 4, corporate: 1) |
| Zustand Stores | **12** |
| SQL миграции | **4** |

### Изменения Rev 1 → Rev 2 (06.03.2026)

- **Фаза 5 ↑ 60% → 90%** — WorkspaceSwitcher активирован, Shield иконка, teal accent, папки по workspace
- **Клиент ↑ 95% → 98%** — Forum topics (inline + mobile), realtime message updates
- **Общий прогресс ↑ 72% → 78%**
- Новый эндпоинт `/api/corporate/config` (вне RBAC scope)
- Новая миграция `004_corporate_seed.sql`
- Новые компоненты: TopicListItem, TopicsList
- Новые хуки: useForumTopics, useRealtimeUpdates (расширен)
- Новый store: topics.ts
- Последний коммит: 24 файла изменено, +1 382 строк

---

## Фаза 1: Инфраструктура — 90%

БД, типы, серверный Supabase, GramJS-клиенты, RBAC middleware, API скелеты, admin layout

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| Миграция `002_admin_panel.sql` (8 таблиц) | ✅ Готово | policy_templates, chat_templates, admin_audit_log, chat_event_log, chat_archive_state |
| Миграция `003_agent_factory.sql` (6 таблиц) | ✅ Готово | automation_patterns, agents, agent_metrics, agent_feedback, agent_audit_log, monitored_chats |
| Миграция `004_corporate_seed.sql` 🆕 | ✅ Готово | Дефолтный шаблон политик + привязка TSUM corp, UNICORN SPACE |
| `src/types/admin.ts` (176 строк) | ✅ Готово | AdminRole, PolicyConfig, ChatBannedRights, AuditLogEntry, TemplateDriftEvent |
| `src/types/agents.ts` (127 строк) | ✅ Готово | Agent, AgentStatus, AutomationPattern, AgentMetrics, AgentFeedback |
| `src/types/telegram.ts` (227 строк) 🔄 | ✅ Готово | +TelegramForumTopic, +ForwardInfo, +WebPagePreview, +TelegramReaction |
| `src/types/database.ts` (704 строк) | ✅ Готово | Supabase auto-generated types (Row/Insert/Update) |
| `src/lib/supabase/server.ts` (service_role) | ✅ Готово | createServerSupabase() bypass RLS |
| `src/lib/supabase/middleware.ts` (SSR) | ✅ Готово | createSupabaseMiddleware() + cookie-based auth |
| `src/lib/admin/gramjs-client.ts` | ✅ Готово | withBotClient() + withUserClient() |
| `src/lib/admin/api-helpers.ts` | ✅ Готово | RBAC + аудит хелперы |
| `src/lib/admin/validation.ts` (Zod) | ✅ Готово | Все Zod-схемы валидации |
| `src/middleware.ts` (RBAC) | ✅ Готово | Matcher: /admin/:path\*, /api/admin/:path\* |
| Admin Layout + Dashboard | ✅ Готово | layout.tsx + page.tsx |
| `ADMIN_BOT_TOKEN` env var | ⚠️ Не проверено | Бот создан, токен нужен в Vercel |

---

## Фаза 2: Управление чатами — 95%

ChatManagementService + API routes + Admin UI (таблица чатов, детали, участники)

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| `ChatManagementService` | ✅ Готово | src/lib/admin/services/chat-management.ts |
| API: GET /api/admin/chats (список) | ✅ Готово | route.ts |
| API: GET /api/admin/chats/[chatId] (детали) | ✅ Готово | route.ts |
| API: participants | ✅ Готово | route.ts |
| API: admins | ✅ Готово | route.ts |
| API: ban/unban | ✅ Готово | route.ts |
| API: invite links | ✅ Готово | route.ts |
| API: event-log | ✅ Готово | route.ts |
| UI: ChatTable (таблица чатов) | ✅ Готово | /admin/chats/page.tsx |
| UI: ChatDetails | ✅ Готово | /admin/chats/[chatId]/page.tsx |
| UI: Members | ✅ Готово | /admin/chats/[chatId]/members/page.tsx |
| UI: Settings | ✅ Готово | /admin/chats/[chatId]/settings/page.tsx |
| UI: Events | ✅ Готово | /admin/chats/[chatId]/events/page.tsx |

---

## Фаза 3: Политики и шаблоны — 95%

TemplateService + drift detection + UI шаблонов

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| `TemplateService` | ✅ Готово | src/lib/admin/services/template-service.ts |
| API: templates CRUD | ✅ Готово | route.ts + [templateId]/route.ts |
| API: apply template | ✅ Готово | [templateId]/apply/route.ts |
| API: drift detection | ✅ Готово | [templateId]/drift/route.ts |
| Cron: check-drift | ✅ Готово | /api/admin/cron/check-drift/route.ts |
| UI: Templates list | ✅ Готово | /admin/templates/page.tsx |
| UI: Create template | ✅ Готово | /admin/templates/new/page.tsx |
| UI: Edit template | ✅ Готово | /admin/templates/[id]/page.tsx |

---

## Фаза 4: Аудит и мониторинг + Архив — 90%

AuditService + cron jobs + UI аудита + cron сбора сообщений

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| `AuditService` | ✅ Готово | src/lib/admin/services/audit-service.ts |
| API: audit search | ✅ Готово | /api/admin/audit/route.ts |
| API: audit export CSV | ✅ Готово | /api/admin/audit/export/route.ts |
| Cron: collect-messages | ✅ Готово | /api/admin/cron/collect-messages/route.ts |
| Cron: collect-events | ✅ Готово | /api/admin/cron/collect-events/route.ts |
| UI: Audit page | ✅ Готово | /admin/audit/page.tsx |
| Cron schedule в vercel.json | ❌ Нет | Требует Vercel Pro. Эндпоинты работают, нет автовызова |

---

## Фаза 5: Корпоративное пространство — 90% 🔥 MAJOR UPDATE

Corporate config API + useCorporateStore + переключатель пространств + корп. политики

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| Corporate Config API 🆕 | ✅ Готово | `/api/corporate/config` — вне RBAC scope, доступен любому auth-пользователю |
| Admin Config API (legacy) | ✅ Готово | `/api/admin/config` — по-прежнему работает через RBAC |
| `useCorporateStore` (Zustand) 🔄 | ✅ Готово | loadConfig() → /api/corporate/config; switchWorkspace() устанавливает data-workspace DOM attr |
| `WorkspaceSwitcher` компонент 🔧 | ✅ Готово | Сегментированный контрол [💬 Личное \| 🏢 Рабочее], teal accent для work |
| **Переключатель видим в UI** 🔧 | ✅ Готово | Seed данные в Supabase: TSUM corp + UNICORN SPACE привязаны к шаблону |
| Фильтрация диалогов по workspace | ✅ Готово | work → только managed; personal → только НЕ-managed (эксклюзивно) |
| Shield иконка для корп. чатов 🆕 | ✅ Готово | Teal Shield (lucide) после названия чата в ChatListItem |
| Accent color для рабочего пространства 🆕 | ✅ Готово | CSS vars [data-workspace="work"]: teal selection, badges, sidebar accent (OKLCh) |
| Корпоративные папки 🆕 | ✅ Готово | Папки фильтруются по workspace через dialogMatchesFolder(); смешанные → в обоих |
| Фильтрация папок в FolderSidebar 🆕 | ✅ Готово | Desktop sidebar: workspace-aware + teal accents + teal settings button |
| Фильтрация папок в FolderTabs 🆕 | ✅ Готово | Mobile tabs: workspace-aware + dynamic accent color |
| Сброс папки при смене workspace 🆕 | ✅ Готово | useEffect: selectedFolder → 0 при смене workspace |
| `loadConfig()` при монтировании | ✅ Готово | ChatLayoutClient вызывает в useEffect |
| Seed миграция `004_corporate_seed.sql` 🆕 | ✅ Готово | Шаблон «Стандартная корпоративная» + chat_templates для 2 чатов |
| Блокировка пересылки (protected content) | ⚠️ Частично | isContentProtected() есть в store, не применяется в UI |

> **Фаза 5 — основная работа завершена.** Все ключевые компоненты корпоративного пространства реализованы и работают. WorkspaceSwitcher отображается, рабочее пространство показывает только корп. чаты с Shield иконкой и teal акцентом, личное — скрывает корп. чаты. Папки фильтруются через dialogMatchesFolder(). Осталось: применить isContentProtected() для блокировки пересылки в UI.

---

## Фаза 6: Архив переписок (UI) — 90%

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| Страница `/admin/archive` | ✅ Готово | page.tsx — поиск по message_archive |
| Фильтры: чат, отправитель, дата, тип медиа | ✅ Готово | Full-text search на русском |
| Export в CSV | ✅ Готово | /api/admin/archive/export/route.ts |
| RBAC: compliance_officer + super_admin | ✅ Готово | requirePermission() |

---

## Фазы 7-11: Agent Factory (OpenClaw) — 40%

### Vercel-часть (UI + API) — реализовано:

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| API: agents CRUD (list, create, get, patch, delete) | ✅ Готово | agents/route.ts + [agentId]/route.ts |
| API: agent approve, metrics, feedback, audit | ✅ Готово | 4 route.ts |
| API: patterns CRUD + approve | ✅ Готово | 3 route.ts |
| API: monitoring toggle (per-chat) | ✅ Готово | 2 route.ts |
| API: governance dashboard, budget, settings | ✅ Готово | 3 route.ts |
| Service API: send, history, create, monitored | ✅ Готово | 4 route.ts (SERVICE_API_TOKEN) |
| UI: Governance dashboard | ✅ Готово | /admin/governance/page.tsx |
| UI: Agents list + details | ✅ Готово | page.tsx + [agentId]/page.tsx |
| UI: Governance settings | ✅ Готово | /admin/governance/settings/page.tsx |
| UI: AgentBadge, FeedbackButtons, AgentInfoPanel | ✅ Готово | Компоненты в src/components/chat/ |
| UI: MonitoringToggle | ✅ Готово | src/components/chat/MonitoringToggle.tsx |
| UI: Agent sandbox | ⚠️ Скелет | Навигация есть, функционал нет |
| UI: Patterns page | ⚠️ Скелет | Базовая страница |
| UI: Governance audit | ⚠️ Скелет | TODO: dedicated endpoint |

### VPS-часть — НЕ реализовано:

| Пункт ТЗ | Статус | Комментарий |
|-----------|--------|-------------|
| VPS: Message Stream Service (GramJS long-running) | ❌ Нет | Node.js + GramJS consumer не создан |
| VPS: Redis Streams (corp:messages) | ❌ Нет | Redis не развёрнут |
| VPS: Conversation Intelligence (Python) | ❌ Нет | Intent Classifier, Pattern Miner, Interaction Graph, ROI Estimator |
| VPS: Qdrant (Vector DB) | ❌ Нет | Embeddings хранилище |
| VPS: OpenClaw Gateway | ❌ Нет | Observer + Orchestrator + Specialists |
| VPS: MCP-мост (OpenClaw ↔ Telegram) | ❌ Нет | send_corporate_message, get_chat_history |
| VPS: Docker sandbox для агентов | ❌ Нет | Изолированное тестирование |
| Реальное выполнение агентов (inference) | ❌ Нет | Нет engine для запуска |
| Pattern auto-detection (ML) | ❌ Нет | Нет ML-анализа |
| Shadow Mode / Canary Deployment | ❌ Нет | Статусы в БД, исполнение нет |
| Self-improvement Loop | ❌ Нет | Метрики собираются, автооптимизации нет |

---

## Клиентская часть (Telegram-мессенджер) — 98% 🔄

Не входит в ТЗ v3.0, но является основой приложения

| Функция | Статус | Комментарий |
|---------|--------|-------------|
| Авторизация (Phone + QR + 2FA) | ✅ Готово | Все три метода, AUTH_TOKEN_EXPIRED обработка |
| Список чатов + real-time обновления 🔄 | ✅ Готово | Live polling updates, new messages / edits / deletes / read states |
| Отправка / редактирование / ответы | ✅ Готово | Reply-to, edit, delete |
| Медиа: фото, видео, документы, голос, стикеры | ✅ Готово | IndexedDB кэш, FFmpeg транскодинг, chunked upload |
| Контакты | ✅ Готово | Online-статус, last seen, avatar loading |
| История звонков | ✅ Готово | Входящие/исходящие, video/voice |
| Поиск (глобальный, full-text) | ✅ Готово | Контакты + сообщения |
| Папки Telegram 🔄 | ✅ Готово | Sidebar (desktop) + tabs (mobile) + workspace filtering + teal accent |
| Forum Topics 🆕 | ✅ Готово | Inline expansion на десктопе, отдельный TopicsList на мобильном. Emoji иконки. |
| Realtime message updates 🆕 | ✅ Готово | useRealtimeUpdates: polling, new messages, edits, deletes, read states, unread counts |
| Workspace switching 🆕 | ✅ Готово | WorkspaceSwitcher: Личное/Рабочее, диалоги и папки фильтруются по workspace |
| PWA + offline | ✅ Готово | Service Worker (sw.js), stale-while-revalidate, offline.html |
| Комментарии к постам каналов | ✅ Готово | Discussion groups |
| Настройки (тема, шрифт, уведомления, язык) | ✅ Готово | Supabase user_settings |
| Multi-tab sync | ✅ Готово | Leader election (useSyncStore), одна вкладка слушает updates |

### Zustand Stores (12 шт.)

| Store | Строк | Описание |
|-------|-------|----------|
| `auth.ts` | 62 | Supabase + Telegram auth state |
| `chats.ts` | 248 | Dialogs: setDialogs, mergeDialogs, syncDialogs, bumpDialog, updateReadState |
| `messages.ts` | 167 | Per-chat messages (max 50/chat persist), addMessage, updateMessage, deleteMessages |
| `topics.ts` 🆕 | 87 | Forum topics per chat: setTopics, updateTopicUnread, updateTopicLastMessage |
| `corporate.ts` 🔄 | 117 | Workspace: switchWorkspace (+ DOM attr), loadConfig (/api/corporate/config), isManagedChat |
| `folders.ts` | 21 | Telegram folder list, selectedFolder |
| `ui.ts` 🔄 | 178 | +selectTopic, +expandForum, +expandedForumChatId, +selectedTopicId |
| `contacts.ts` | 39 | Contact list with persistence |
| `calls.ts` | 46 | Call records with persistence |
| `avatars.ts` | 48 | Avatar LRU cache (max 500) |
| `upload.ts` | 175 | Video upload queue + metrics |
| `sync.ts` | 25 | Multi-tab leader election |

### Hooks (14 шт.)

| Hook | Описание |
|------|----------|
| `useTelegramClient` | Telegram client init + connection state |
| `useDialogs` | Load/paginate dialogs with infinite scroll |
| `useMessages` 🔄 | Load/paginate messages + reply context + topic support |
| `useForumTopics` 🆕 | Fetch forum topics for a chat (with caching) |
| `useRealtimeUpdates` 🔄 | Telegram polling: new messages, edits, deletes, read states |
| `useContacts` | Load contacts list |
| `useCalls` | Load call history |
| `useLazyAvatar` | IntersectionObserver-based lazy avatar loading |
| `useMediaDownload` | Download media from messages (photos, docs, etc.) |
| `useGlobalSearch` | Global message/chat search |
| `useViewUrlSync` | Sync view state ↔ URL hash |
| `useLeaderElection` | Multi-tab leader election via BroadcastChannel |

---

## Полный список API Routes (41)

| Группа | Кол-во | Routes |
|--------|--------|--------|
| Admin — Chats | 7 | chats, chats/[id], participants, admins, ban, invite, event-log |
| Admin — Templates | 4 | templates, templates/[id], apply, drift |
| Admin — Audit | 2 | audit, audit/export |
| Admin — Archive | 2 | archive, archive/export |
| Admin — Cron | 3 | collect-messages, collect-events, check-drift |
| Admin — Agents | 6 | agents, agents/[id], approve, metrics, feedback, audit |
| Admin — Patterns | 3 | patterns, patterns/[id], approve |
| Admin — Monitoring | 2 | monitoring, monitoring/[chatId] |
| Admin — Governance | 3 | dashboard, budget, settings |
| Admin — Other | 3 | config, roles, roles/[userId], stats |
| Service | 4 | send, history, monitored, create |
| Corporate 🆕 | 1 | config |
| **Итого** | **41** | |

---

## Сводная таблица по фазам

| Фаза | Название | % | Статус | Изменение |
|------|----------|---|--------|-----------|
| 1 | Инфраструктура (БД, типы, RBAC, API скелеты) | **90%** | ✅ Завершена | — |
| 2 | Управление чатами (Service + API + UI) | **95%** | ✅ Завершена | — |
| 3 | Политики и шаблоны (drift detection) | **95%** | ✅ Завершена | — |
| 4 | Аудит + cron + архив сбора | **90%** | ✅ Завершена | — |
| 5 | Корпоративное пространство (Личное / Рабочее) | **90%** | ✅ Завершена | **↑ +30%** |
| 6 | Архив переписок (UI) | **90%** | ✅ Завершена | — |
| 7 | Message Stream + Redis (VPS) | **30%** | ⚠️ API есть, VPS нет | — |
| 8 | Conversation Intelligence (Python) | **0%** | ❌ Не начата | — |
| 9 | OpenClaw Gateway + MCP | **0%** | ❌ Не начата | — |
| 10 | Agent Design Engine + Sandbox | **10%** | ❌ UI-скелеты | — |
| 11 | Governance Portal + Canary + Self-improvement | **40%** | ⚠️ UI есть, логика нет | — |
| | **Клиентская часть** | **98%** | ✅ Готово | **↑ +3%** |

---

## Приоритетные задачи

### ✅ Выполнено сегодня (Rev 1 → Rev 2)

1. ~~Активировать WorkspaceSwitcher~~ — ✅ /api/corporate/config + seed data
2. ~~Shield иконка~~ — ✅ Teal Shield в ChatListItem
3. ~~Accent color~~ — ✅ CSS variables, teal selection/badges/sidebar
4. ~~Корпоративные папки~~ — ✅ Фильтрация через dialogMatchesFolder()
5. ~~Forum Topics~~ — ✅ Inline (desktop) + TopicsList (mobile)
6. ~~Realtime updates~~ — ✅ Polling + message/edit/delete/read sync

### ⚡ Быстрые победы (следующие)

1. **Блокировка пересылки** — применить isContentProtected() в MessageItem (disable copy/forward)
2. **Vercel Cron** — перейти на Pro или использовать внешний scheduler (cron-job.org)
3. **ADMIN_BOT_TOKEN** — проверить, что бот создан и токен в Vercel env vars

### 🚀 Следующие большие шаги

1. **VPS развёртывание** — Docker Compose (Redis 7, Qdrant, Node.js Message Stream)
2. **Message Stream Service** — GramJS long-running consumer → Redis Streams
3. **Conversation Intelligence** — Python микросервис (intent classifier, pattern miner)
4. **OpenClaw Gateway** — Observer + Orchestrator конфигурация
5. **MCP-мост** — telegram-corporate bridge tools

---

## Технический стек

| Категория | Технологии |
|-----------|-----------|
| Frontend Framework | Next.js 15 (App Router) + React 18 + TypeScript |
| State Management | Zustand (12 stores) + persist middleware |
| Styling | Tailwind CSS + shadcn/ui + OKLCh CSS variables |
| Telegram MTProto | gram.js (клиентские подключения) + GramJS (admin bot) |
| Backend / Auth | Supabase (PostgreSQL + Auth + RLS + Storage) |
| Caching | IndexedDB (media), localStorage (stores), LRU (avatars, 500 items) |
| Video Processing | FFmpeg.wasm (browser-side transcoding) |
| Virtual List | @tanstack/react-virtual (chat list + messages) |
| PWA | Service Worker (sw.js) + Web App Manifest |
| Deployment | Vercel (serverless, edge middleware) |
| DB Migrations | 4 SQL файла (382 строк) |

---

<sub>Telegram Corp v0.5.0 | Ревизия ТЗ v3.0 Rev 2 | 06.03.2026 | Claude Code</sub>
