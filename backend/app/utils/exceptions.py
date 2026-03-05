class AppException(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: dict | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


class NotFoundException(AppException):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            status_code=404,
            code="NOT_FOUND",
            message=f"{resource} with id '{resource_id}' not found",
        )


class ValidationException(AppException):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(
            status_code=422,
            code="VALIDATION_ERROR",
            message=message,
            details=details,
        )


class ConflictException(AppException):
    def __init__(self, message: str):
        super().__init__(
            status_code=409,
            code="CONFLICT",
            message=message,
        )
