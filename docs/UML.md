# UML проекта timetable22

Обновлено: 2026-11-06 — разделение 50+ МБ проекта на легкий bootstrap, частичную загрузку разделов и потоковый экспорт.

## Компоненты

```mermaid
flowchart LR
    Browser[frontend/src/App.jsx] --> AuthClient[frontend/src/auth.js]
    Browser --> StorageClient[frontend/src/storage.js]
    Browser --> EditorClient[frontend/src/editorTransport.js]
    AuthClient --> Auth[auth.py]
    StorageClient --> API[app.py]
    EditorClient --> API
    API --> EditorTransport[editor_transport.py]
    API --> EditorState[editor_state.py]
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
    Session --> EditorTransportRoutes[Editor bootstrap sections schedule export]
    Session --> Superadmin[Superadmin user changes and backup restore]
    Private --> PartialCheck[partial_write_error and complete_project]
    PartialCheck --> Writes[Atomic storage writes]
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
| GET /api/editor/\<key\>?section=bootstrap | Быстрый bootstrap (~71 КБ gzip) без тяжёлых разделов |
| GET /api/editor/\<key\>?section=\<s\>&token=\<t\> | Посекционная загрузка (loads, schedule, graphState и др.) |
| GET /api/editor/\<key\>/schedule?groupId=\<id\>&week=\<w\> | Рабочие occurrences конкретной группы/недели |
| GET /api/editor/\<key\>/export | Потоковая выгрузка полного переносимого проекта |
| /api/storage* | Закрытый редакторский контур (защита от неполной перезаписи) |
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

## Производительность и шардирование хранилища

### Точки выдачи и оптимизация Scope Matching

```mermaid
sequenceDiagram
    autonumber
    actor User as Браузер / Бот
    participant API as app.py
    participant FastMatch as _instance_has_group
    participant Scope as _editor_matches_scope
    participant Transport as editor_transport.py
    participant DB as SQLite kv_store

    User->>API: GET /api/editor/schedule-data-v2/schedule?groupId=9b28grdj
    activate API
    API->>Transport: schedule_response(groupId=9b28grdj)
    activate Transport
    Transport->>DB: Чтение снимка проекта
    DB-->>Transport: Полный проект (22882 пар)
    loop Для каждой из 22882 пар
        Transport->>FastMatch: _instance_has_group(inst, groupId)
        alt Группа не совпадает (98.7% пар)
            FastMatch-->>Transport: False (ранний выход без вычисления 20 недель)
        else Группа совпадает (295 пар)
            Transport->>Scope: Полная проверка недель нагрузки и потоков
            Scope-->>Transport: True/False
        end
    end
    Transport-->>API: Срез группы (314 KB raw / 15.9 KB gzip, ~136 ms)
    deactivate Transport
    API-->>User: HTTP 200 OK
    deactivate API
```

| Эндпоинт | Raw Size | Gzip Size | Экономия сжатия | Latency (avg) |
| --- | --- | --- | --- | --- |
| `/api/storage/schedule-data-v2?full=1` | 56160.2 KB | 2916.5 KB | 94.8% | 349.6 ms |
| `/api/editor/schedule-data-v2?section=bootstrap` | 659.8 KB | 68.6 KB | 89.6% | 19.0 ms |
| `/api/editor/schedule-data-v2/schedule?groupId=9b28grdj` | 314.2 KB | 15.9 KB | 94.9% | 136.6 ms |
| `/api/editor/schedule-data-v2/schedule?groupId=9b28grdj&week=1` | 19.7 KB | 2.2 KB | 88.6% | 44.9 ms |
| `/api/editor/schedule-data-v2?section=loads` | 1651.0 KB | 87.3 KB | 94.7% | 24.9 ms |
| `/api/editor/schedule-data-v2?section=graphState` | 1003.2 KB | 61.1 KB | 93.9% | 21.0 ms |
| `/api/public-index` | 201.4 KB | 21.9 KB | 89.1% | 1.5 ms |
| `/api/public-schedule/group/9b28grdj` | 361.5 KB | 19.8 KB | 94.5% | 5.0 ms |

### Гранулярная гидратация вкладок (Client-Side Routing)

14 из 21 вкладок панели администратора (`lists`, `constraints`, `announcements`, `consultations`, `curriculum`, `substitutions`, `scenarios`, `attestation`, `practices`, `history`, `versions`, `config`, `users`, `semester`) являются легковесными и отображаются мгновенно (0 мс) из уже полученного `bootstrap` без фоновых запросов к сети. Тяжёлые разделы (`loads`, `graphState`, `schedule`) запрашиваются инкрементально только при переходе на соответствующие специализированные вкладки, исключая повторную загрузку уже имеющихся в памяти данных.

Архивные исходники в `tools/frontend/` не участвуют в основной Docker-сборке.
