import logging
import sys

import structlog

from .config import settings


def get_logger():
    return structlog.get_logger()


class Colors:
    """ANSI color codes for terminal output"""

    # Reset
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"

    # Colors
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    GRAY = "\033[90m"

    # Bright colors
    BRIGHT_RED = "\033[91m"
    BRIGHT_GREEN = "\033[92m"
    BRIGHT_YELLOW = "\033[93m"
    BRIGHT_BLUE = "\033[94m"
    BRIGHT_MAGENTA = "\033[95m"
    BRIGHT_CYAN = "\033[96m"


def colorize_level(level: str) -> str:
    """Apply colors to log levels"""
    level_colors = {
        "DEBUG": f"{Colors.GRAY}{level}{Colors.RESET}",
        "INFO": f"{Colors.BRIGHT_BLUE}{Colors.BOLD}{level}{Colors.RESET}",
        "WARNING": f"{Colors.BRIGHT_YELLOW}{Colors.BOLD}{level}{Colors.RESET}",
        "ERROR": f"{Colors.BRIGHT_RED}{Colors.BOLD}{level}{Colors.RESET}",
        "CRITICAL": f"{Colors.RED}{Colors.BOLD}{level}{Colors.RESET}",
    }
    return level_colors.get(level, level)


def colorize_status_code(status_code) -> str:
    """Apply colors to HTTP status codes"""
    try:
        code = int(status_code)
        if 200 <= code < 300:
            return f"{Colors.BRIGHT_GREEN}{Colors.BOLD}{status_code}{Colors.RESET}"
        elif 300 <= code < 400:
            return f"{Colors.BRIGHT_CYAN}{Colors.BOLD}{status_code}{Colors.RESET}"
        elif 400 <= code < 500:
            return f"{Colors.BRIGHT_YELLOW}{Colors.BOLD}{status_code}{Colors.RESET}"
        elif 500 <= code:
            return f"{Colors.BRIGHT_RED}{Colors.BOLD}{status_code}{Colors.RESET}"
        else:
            return f"{Colors.WHITE}{status_code}{Colors.RESET}"
    except (ValueError, TypeError):
        return f"{Colors.WHITE}{status_code}{Colors.RESET}"


def get_status_color_for_message(status_code) -> str:
    """Get the color (without bold) for status messages based on status code"""
    try:
        code = int(status_code)
        if 200 <= code < 300:
            return Colors.BRIGHT_GREEN
        elif 300 <= code < 400:
            return Colors.BRIGHT_CYAN
        elif 400 <= code < 500:
            return Colors.BRIGHT_YELLOW
        elif 500 <= code:
            return Colors.BRIGHT_RED
        else:
            return Colors.WHITE
    except (ValueError, TypeError):
        return Colors.WHITE


def shorten_request_id(request_id: str) -> str:
    """Create a short, readable request ID for dev environments"""
    if not request_id:
        return request_id

    return str(request_id).replace("-", "")[:6].lower()


def setup_logging():
    """
    Configure logging:
    - JSON logs in prod (to stdout)
    - Pretty console logs in dev
    - Unified log format for uvicorn + app
    """

    timestamper = structlog.processors.TimeStamper(fmt="iso")

    processors = [
        structlog.contextvars.merge_contextvars,
        timestamper,
        structlog.stdlib.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if settings.ENVIRONMENT == "dev":
        # Custom dev renderer for better formatting with colors
        def custom_dev_renderer(logger, name, event_dict):
            level = event_dict.pop("level", "").upper()
            timestamp = event_dict.pop("timestamp", "")
            event = event_dict.pop("event", "")

            # Colorize components
            colored_level = colorize_level(level)
            colored_timestamp = f"{Colors.GRAY}{timestamp}{Colors.RESET}"

            # Handle HTTP request events
            if event in ["http_request", "http_request_error"]:
                method = event_dict.pop("method", "")
                path = event_dict.pop("path", "")
                status_code = event_dict.get("status_code")
                response_message = event_dict.pop("message", "")

                # Both method and path get same bold white styling
                method_and_path = (
                    f"{Colors.BOLD}{Colors.WHITE}{method} {path}{Colors.RESET}"
                    if method and path
                    else ""
                )

                if status_code:
                    colored_status = colorize_status_code(event_dict.pop("status_code"))
                    event_display = f"{method_and_path} → {colored_status}"
                else:
                    event_display = method_and_path

                # Add response message if present, styled with status code color
                if response_message and status_code:
                    status_color = get_status_color_for_message(status_code)
                    colored_message = f" {status_color}{response_message}{Colors.RESET}"
                    event_display += colored_message
                elif response_message:
                    colored_message = f"{Colors.CYAN}{response_message}{Colors.RESET}"
                    event_display += f"{colored_message}"

                message = f"{colored_timestamp} [{colored_level}] {event_display}"
            else:
                # Style other events with same bold white
                colored_event = f"{Colors.BOLD}{Colors.WHITE}{event}{Colors.RESET}"
                message = f"{colored_timestamp} [{colored_level}] {colored_event}"

            if event_dict:
                extras = []
                for k, v in event_dict.items():
                    if k == "error":
                        # Highlight errors
                        extras.append(
                            f"{Colors.RED}{k}={Colors.BRIGHT_RED}{v}{Colors.RESET}"
                        )
                    elif k == "duration_ms":
                        # Color duration based on speed
                        try:
                            duration = float(v)
                            if duration < 200:
                                color = Colors.BRIGHT_GREEN
                            elif duration < 500:
                                color = Colors.YELLOW
                            else:
                                color = Colors.BRIGHT_RED
                            extras.append(
                                f"{Colors.GRAY}{k}={color}{v}ms{Colors.RESET}"
                            )
                        except (ValueError, TypeError):
                            extras.append(
                                f"{Colors.GRAY}{k}={Colors.WHITE}{v}{Colors.RESET}"
                            )
                    elif k == "request_id":
                        # Short request ID in dev for readability
                        short_id = shorten_request_id(str(v))
                        extras.append(
                            f"{Colors.GRAY}{k}={Colors.WHITE}{short_id}{Colors.RESET}"
                        )
                    else:
                        extras.append(
                            f"{Colors.GRAY}{k}={Colors.WHITE}{v}{Colors.RESET}"
                        )

                if extras:
                    message += f" {' '.join(extras)}"

            return message

        processors.append(custom_dev_renderer)
    else:
        processors.append(structlog.processors.JSONRenderer())

    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )

    # Silence uvicorn's access logs since we handle HTTP logging in middleware
    logging.getLogger("uvicorn.access").disabled = True

    uvicorn_logger = logging.getLogger("uvicorn")
    if settings.ENVIRONMENT == "dev":
        uvicorn_logger.setLevel(logging.INFO)
    else:
        uvicorn_logger.setLevel(logging.WARNING)


# instantiate logger globally
setup_logging()
logger = get_logger()
