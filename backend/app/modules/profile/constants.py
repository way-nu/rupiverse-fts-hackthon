"""Profile rules (Spec §7, §8). The DB check constraints in models.py mirror these."""

import re
from typing import Final

NAME_MIN_CHARS: Final = 3
NAME_MAX_CHARS: Final = 80
AGE_MIN: Final = 18
AGE_MAX: Final = 120
GENDERS: Final = frozenset({"male", "female", "other"})
PHONE_PATTERN: Final = re.compile(r"[0-9]{10}")  # used with fullmatch: exactly 10 ASCII digits, no +91
