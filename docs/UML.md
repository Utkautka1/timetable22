# UML проекта timetable22

Обновлено: 2026-11-06 — серверная авторизация и единая точка входа API.

## Компоненты

```mermaid
flowchart LR
    Browser[frontend/src/App.jsx] --> AuthClient[frontend/src/auth.js]
    Browser --> StorageClient[frontend/src/storage.js]
    AuthClient --> Auth[auth.py]
    StorageClient --> API[app.py]
    Legacy[tools/app.py] --> API
    API --> Auth
    Auth --> Key[DATA_DIR session signing key]
    API --> SQLite[(SQLite)]
    API --> PgCompat[pg_compat.py]
    PgCompat --> Postgres[(PostgreSQL)]
    API --> Backups[DATA_DIR backups]
    API --> Public[Public snapshot shards]
    API --> Scheduler[server_scheduler.mjs]
    API --> GraphScheduler[server_graph_scheduler.mjs]
    Browser --> ClientScheduler[Browser scheduler in App.jsx]
```

## Хранение

```mermaid
erDiagram
    kv_store {
        text key PK
        text value_json
        real updated_at
    }
    publication_snapshots {
        text store_key
        text version_id
        text snapshot_json
    }
```

Рабочий проект и пользователи находятся внутри JSON `schedule-data-v2`.
Точные дополнительные поля и индексы определяются инициализацией в `app.py`.
SQLite и PostgreSQL используют совместимый слой `pg_compat.py`.

## API и контроль доступа

```mermaid
flowchart TD
    Request[API request] --> Guard[guard_api]
    Guard --> PublicGet[Allowlisted public GET and HEAD]
    Guard --> AuthRoutes[auth session login logout setup]
    Guard --> Session[current_user]
    Session --> Private[Storage presence generators diagnostics]
    Session --> Superadmin[Superadmin user changes and backup restore]
    Private --> Writes[Atomic storage writes]
    Superadmin --> Writes
```

| Маршрут | Назначение |
| --- | --- |
| GET /api/auth/session | Состояние входа без списка пользователей |
| POST /api/auth/login | Серверная проверка пароля |
| POST /api/auth/logout | Удаление cookie входа |
| POST /api/auth/setup | Первый администратор по AUTH_SETUP_TOKEN |
| POST /api/auth/password | Смена собственного пароля |
| GET /api/public-* | Опубликованные данные по явному списку |
| /api/storage* | Закрытый редакторский контур |
| /api/schedule/*, /api/graphs/* | Закрытые серверные планировщики |

Сессия подписана постоянным ключом. Пароль и роль сверяются с хранилищем на
каждом закрытом запросе. Клиентский ID пользователя не даёт полномочий.

## Классы

```mermaid
classDiagram
    class _PersistentSchedulerWorker {
        +request(payload, cache_key, data, timeout)
    }
    class PgConnection {
        +execute(sql, params)
        +commit()
        +rollback()
        +close()
    }
```

Архивные исходники в `tools/frontend/` не участвуют в основной Docker-сборке.
