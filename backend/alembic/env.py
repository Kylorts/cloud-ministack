from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

from app.config import settings
from app.database import Base

# import all models so Alembic can detect them
import app.models.user            # noqa: F401
import app.models.plan            # noqa: F401
import app.models.subscription    # noqa: F401
import app.models.storage_bucket  # noqa: F401
import app.models.storage_object  # noqa: F401
import app.models.usage_counter   # noqa: F401
import app.models.activity_log     # noqa: F401
import app.models.static_site      # noqa: F401
import app.models.static_site_deployment  # noqa: F401
import app.models.access_key        # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
