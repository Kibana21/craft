"""
Celery application instance for CRAFT.

Broker + result backend: Redis (already running via docker-compose).
All video generation tasks are routed to the "video" queue so they can
be scaled independently from the web process.

Start a worker:
    make worker

Monitor via Flower dashboard:
    make flower   →  http://localhost:5555
"""
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "craft",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.services.video_generation_worker",
        "app.services.poster_generation_worker",
    ],
)

celery_app.conf.update(
    # Serialisation
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Reliability
    task_acks_late=True,           # don't ack until the task finishes (crash-safe)
    worker_prefetch_multiplier=1,  # one task per worker slot at a time

    # Routing — video tasks go to a dedicated queue; poster tasks go to "poster"
    task_routes={
        "video.generate": {"queue": "video"},
        "poster.generate": {"queue": "poster"},
    },

    # Timezone
    timezone="Asia/Singapore",
    enable_utc=True,

    # Results expire after 24 h (we track status in the DB, not in Redis)
    result_expires=86400,
)
