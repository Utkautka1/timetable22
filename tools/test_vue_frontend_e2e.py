"""
Сквозной интеграционный тест нового Vue 3 фронтенда и API бэкенда.
Проверяет:
1. Раздачу статики Vue 3 (index.html, JS-бандлы, CSS).
2. Работу публичных API (public-index, public-schedule, public-status).
3. Работу эндпоинтов авторизации (auth/session, auth/me, auth/login, auth/logout).
4. Безопасность storage (отсутствие passwordHash в ответе get_key).
5. Работу замен и расписания звонков.
"""
import unittest
import json
import os
import sys

# Добавляем корневую директорию проекта в sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
from editor_transport import sanitize_users

class TestVueFrontendE2E(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_01_static_index_serves_vue(self):
        """Проверяет, что корневой URL / отдаёт скомпилированный Vue 3 index.html."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        html = response.data.decode("utf-8")
        self.assertIn('<div id="app"></div>', html)
        self.assertIn("Расписание — КТМУ", html)

    def test_02_public_index_api(self):
        """Проверяет корректность ответа /api/public-index."""
        response = self.client.get("/api/public-index")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn("data", data)
        self.assertIn("groups", data["data"])
        self.assertIn("teachers", data["data"])
        self.assertIn("rooms", data["data"])

    def test_03_auth_session_and_me_endpoints(self):
        """Проверяет, что оба эндпоинта /api/auth/session и /api/auth/me отвечают корректно."""
        res_session = self.client.get("/api/auth/session")
        self.assertEqual(res_session.status_code, 200)
        data_session = json.loads(res_session.data)
        self.assertIn("user", data_session)

        res_me = self.client.get("/api/auth/me")
        self.assertEqual(res_me.status_code, 200)
        data_me = json.loads(res_me.data)
        self.assertEqual(data_session, data_me)

    def test_04_storage_password_hash_not_leaked(self):
        """Проверяет, что при запросе schedule-data-v2?full=1 хэши паролей удаляются."""
        # Аутентифицируем тестовую сессию администратора
        with self.client.session_transaction() as sess:
            sess["user"] = {"id": "test_admin", "login": "admin", "role": "admin"}
            sess["sid"] = "test_sid_123"

        response = self.client.get("/api/storage/schedule-data-v2?full=1")
        if response.status_code == 200:
            data = json.loads(response.data)
            val = data.get("value")
            if isinstance(val, str):
                val = json.loads(val)
            if isinstance(val, dict) and "users" in val:
                for u in val["users"]:
                    self.assertNotIn("passwordHash", u, "Обнаружена утечка passwordHash в API!")

    def test_05_public_status_and_availability(self):
        """Проверяет доступность эндпоинтов статуса и аудиторий."""
        res_status = self.client.get("/api/public-status")
        self.assertIn(res_status.status_code, [200, 304])

        res_avail = self.client.get("/api/public-room-availability?date=2026-11-08&period=1")
        self.assertEqual(res_avail.status_code, 200)

    def test_06_public_schedule_shard_from_backup_data(self):
        """Проверяет получение расписания для группы из резервной копии."""
        res_idx = self.client.get("/api/public-index")
        idx_data = json.loads(res_idx.data).get("data", {})
        groups = idx_data.get("groups", [])
        self.assertGreater(len(groups), 0, "Список групп в резервной копии не должен быть пустым")

        first_group_id = groups[0]["id"]
        res_sched = self.client.get(f"/api/public-schedule/group/{first_group_id}?week=10")
        self.assertEqual(res_sched.status_code, 200)
        sched_data = json.loads(res_sched.data)
        self.assertIn("schedule", sched_data)
        self.assertIn("instances", sched_data["schedule"])

    def test_07_substitutions_feed_from_backup_data(self):
        """Проверяет наличие и корректность структуры замен из резервной копии."""
        res_idx = self.client.get("/api/public-index")
        idx_data = json.loads(res_idx.data).get("data", {})
        subs = idx_data.get("substitutions", [])
        self.assertIsInstance(subs, list)
        if subs:
            sample = subs[0]
            self.assertTrue("day" in sample or "instId" in sample or "type" in sample)

    def test_08_spa_direct_routes_serve_index(self):
        """Проверяет, что прямые ссылки /group/..., /teacher/..., /room/... отдают SPA index.html."""
        for path in ["/group/test_group", "/teacher/test_teacher", "/room/test_room"]:
            res = self.client.get(path)
            self.assertEqual(res.status_code, 200)
            self.assertIn('<div id="app"></div>', res.data.decode("utf-8"))

if __name__ == "__main__":
    unittest.main()
