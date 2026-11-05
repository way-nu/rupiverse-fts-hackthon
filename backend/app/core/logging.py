"""Logging setup with a redaction filter: emails, tokens, hashes and codes never reach a log line."""

import logging
import re

_PATTERNS = (
    # bcrypt hashes
    (re.compile(r"\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}"), "[hash]"),
    # JWTs
    (re.compile(r"\beyJ[\w-]+\.[\w-]+\.[\w-]+"), "[jwt]"),
    # emails
    (re.compile(r"[^\s@\"'<>(),;:]+@[^\s@\"'<>(),;:]+\.[A-Za-z]{2,}"), "[email]"),
    # opaque tokens and hex digests: 20+ url-safe chars including at least one digit
    (re.compile(r"(?<![\w-])(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{20,}"), "[secret]"),
    # one-time codes
    (re.compile(r"\b\d{6}\b"), "[code]"),
)


def redact(text: str) -> str:
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class RedactionFilter(logging.Filter):
    """Rewrites each record's final message with secrets masked."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        record.msg = redact(message)
        record.args = None
        if record.exc_info and record.exc_text is None:
            record.exc_text = redact(logging.Formatter().formatException(record.exc_info))
        elif record.exc_text:
            record.exc_text = redact(record.exc_text)
        return True


_FILTER = RedactionFilter()


def setup_logging() -> None:
    """Attach the redaction filter to every handler of the root and uvicorn loggers."""
    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    for name in ("", "uvicorn", "uvicorn.error", "uvicorn.access", "sqlalchemy"):
        logger = logging.getLogger(name)
        if _FILTER not in logger.filters:
            logger.addFilter(_FILTER)
        for handler in logger.handlers:
            if _FILTER not in handler.filters:
                handler.addFilter(_FILTER)
