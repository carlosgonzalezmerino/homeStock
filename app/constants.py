"""Domain constants shared by the models, the schemas and the services."""

PANTRY_LOCATION = "pantry"
FREEZER_LOCATION = "freezer"

DEFAULT_UNIT = "units"

FREEZER_DRAWER_MIN = 1
FREEZER_DRAWER_MAX = 4

NOTES_MAX_LENGTH = 500
MAX_QUANTITY_DECIMALS = 2

# Movement reasons: why the stock of a product changed.
REASON_INITIAL = "initial"
REASON_PURCHASE = "purchase"
REASON_CONSUME = "consume"
REASON_WASTE = "waste"
REASON_ADJUST = "adjust"
REASON_REMOVED = "removed"
MOVEMENT_REASONS = (
    REASON_INITIAL,
    REASON_PURCHASE,
    REASON_CONSUME,
    REASON_WASTE,
    REASON_ADJUST,
    REASON_REMOVED,
)
# Reasons a client may send. `initial` and `removed` are decided by the service.
CLIENT_REASONS = (REASON_PURCHASE, REASON_CONSUME, REASON_WASTE, REASON_ADJUST)

# Movement sources: where the change came from.
SOURCE_APP = "app"
SOURCE_SCAN = "scan"
SOURCE_SHOPPING_LIST = "shopping_list"
SOURCE_DEVICE = "device"
SOURCE_TICKET = "ticket"
SOURCE_MIGRATION = "migration"
SOURCE_REVIEW = "review"
SOURCE_UNDO = "undo"
MOVEMENT_SOURCES = (
    SOURCE_APP,
    SOURCE_SCAN,
    SOURCE_SHOPPING_LIST,
    SOURCE_DEVICE,
    SOURCE_TICKET,
    SOURCE_MIGRATION,
    SOURCE_REVIEW,
    SOURCE_UNDO,
)
# Sources a client may send. `migration` and `undo` are written by the server itself.
CLIENT_SOURCES = (
    SOURCE_APP,
    SOURCE_SCAN,
    SOURCE_SHOPPING_LIST,
    SOURCE_DEVICE,
    SOURCE_TICKET,
    SOURCE_REVIEW,
)
SOURCE_HEADER = "X-HomeStock-Source"

# Movement listing.
MOVEMENT_DEFAULT_LIMIT = 50
MOVEMENT_MAX_LIMIT = 200

# Scanning.
SCAN_MODE_PURCHASE = "purchase"
SCAN_MODE_CONSUME = "consume"
SCAN_STEP = 1.0
SCAN_DEFAULT_QUANTITY = 1.0
DEFAULT_THRESHOLD = 2.0

# Weekly review.
RATE_WINDOW_DAYS = 90
MIN_OBSERVED_DAYS = 7
MIN_CONSUME_EVENTS = 3
STALE_DAYS = 60
MAX_REVIEW_CARDS = 10
REVIEW_OVERDUE = "overdue"
REVIEW_STALE = "stale"
